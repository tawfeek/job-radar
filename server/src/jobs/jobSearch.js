// Core agent: one execution = one profile = one Anthropic web_search call →
// fenced-JSON output → sanitize → UPSERT into job_postings.
//
// UPSERT (rather than delete-and-replace) is the critical correctness move —
// it preserves user annotations (userStatus, userNotes, appliedAt) across
// the daily re-encounter of the same posting.
//
// Every attempt creates a JobRun row that's finalized as success or failed,
// so the UI can surface a full history and the operator can debug failures
// without scraping logs.

import prisma from '../config/database.js';
import { getAnthropicClient } from '../config/anthropic.js';
import {
  MODEL,
  ABSOLUTE_MAX_RESULTS,
  USER_STATUSES,
  buildSystemPrompt,
  USER_PROMPT,
} from '../config/jobSearchConfig.js';

const FRESHNESS_BUCKETS = new Set(['today', 'week', 'month', 'stale']);

function extractJsonBlock(text) {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Models with web_search sometimes wrap claims in <cite> tags pointing at
// retrieved sources. We don't store those tags — just the underlying text.
function stripCitationTags(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<\/?cite[^>]*>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampNumber(n, min, max) {
  if (typeof n !== 'number' || Number.isNaN(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function sanitizePosting(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const title = stripCitationTags(raw.title);
  const company = stripCitationTags(raw.company);
  const description = stripCitationTags(raw.description);
  const sourceUrl = typeof raw.sourceUrl === 'string' ? raw.sourceUrl.trim() : '';

  if (!title || !company || !description || !sourceUrl) return null;
  if (!/^https?:\/\//i.test(sourceUrl)) return null;

  let freshness = typeof raw.freshness === 'string' ? raw.freshness.toLowerCase().trim() : '';
  if (!FRESHNESS_BUCKETS.has(freshness)) freshness = 'month';

  const matchScore = clampNumber(raw.matchScore, 0, 1);

  let postedAt = null;
  if (raw.postedAt) {
    const d = new Date(raw.postedAt);
    if (!Number.isNaN(d.getTime())) postedAt = d;
  }

  const requirements = Array.isArray(raw.requirements)
    ? raw.requirements
        .filter((r) => typeof r === 'string' && r.trim())
        .map((r) => stripCitationTags(r).slice(0, 200))
        .slice(0, 12)
    : [];

  return {
    title: title.slice(0, 300),
    company: company.slice(0, 200),
    location: stripCitationTags(raw.location || 'Israel').slice(0, 200),
    description: description.slice(0, 800),
    requirements,
    sourceUrl: sourceUrl.slice(0, 500),
    sourceName: stripCitationTags(raw.sourceName || 'Unknown').slice(0, 200),
    postedAt,
    freshness,
    matchScore,
    matchReason: stripCitationTags(raw.matchReason || '').slice(0, 400) || null,
  };
}

/**
 * Run the agent once for a profile.
 * @param {string} profileId
 * @returns {Promise<{runId: string, profileId: string, postings: object[], newCount: number}>}
 */
export async function runJobSearch(profileId) {
  const profile = await prisma.jobSearchProfile.findUnique({
    where: { id: profileId },
  });
  if (!profile) {
    throw new Error(`JobSearchProfile ${profileId} not found`);
  }
  if (!profile.active) {
    throw new Error(`JobSearchProfile ${profileId} is inactive — skipping`);
  }

  const client = getAnthropicClient();
  if (!client) {
    throw new Error('ANTHROPIC_API_KEY is not set — cannot run job search');
  }

  const run = await prisma.jobRun.create({
    data: { profileId: profile.id, status: 'running', model: MODEL },
  });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: buildSystemPrompt(profile),
      messages: [{ role: 'user', content: USER_PROMPT }],
      tools: [{ name: 'web_search', type: 'web_search_20250305' }],
    });

    const fullText = (message.content || [])
      .filter((b) => b?.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const rawPostings = extractJsonBlock(fullText);
    if (!rawPostings) {
      throw new Error('Model response did not contain a parseable JSON block');
    }

    const sanitized = rawPostings
      .map(sanitizePosting)
      .filter(Boolean)
      .slice(0, Math.min(profile.maxResults, ABSOLUTE_MAX_RESULTS));

    if (sanitized.length === 0) {
      // Not an error — perhaps nothing new today. Mark run as success/0.
      await prisma.jobRun.update({
        where: { id: run.id },
        data: { status: 'success', finishedAt: new Date(), postingsFound: 0, postingsNew: 0 },
      });
      return { runId: run.id, profileId: profile.id, postings: [], newCount: 0 };
    }

    // UPSERT each posting. On conflict of (profileId, sourceUrl) we refresh
    // agent-side fields but leave user annotations untouched.
    let newCount = 0;
    for (const p of sanitized) {
      const existing = await prisma.jobPosting.findUnique({
        where: { profileId_sourceUrl: { profileId: profile.id, sourceUrl: p.sourceUrl } },
      });

      if (existing) {
        await prisma.jobPosting.update({
          where: { id: existing.id },
          data: {
            lastRunId: run.id,
            title: p.title,
            company: p.company,
            location: p.location,
            description: p.description,
            requirements: p.requirements,
            sourceName: p.sourceName,
            postedAt: p.postedAt,
            freshness: p.freshness,
            matchScore: p.matchScore,
            matchReason: p.matchReason,
            lastSeenAt: new Date(),
          },
        });
      } else {
        await prisma.jobPosting.create({
          data: {
            profileId: profile.id,
            lastRunId: run.id,
            title: p.title,
            company: p.company,
            location: p.location,
            description: p.description,
            requirements: p.requirements,
            sourceUrl: p.sourceUrl,
            sourceName: p.sourceName,
            postedAt: p.postedAt,
            freshness: p.freshness,
            matchScore: p.matchScore,
            matchReason: p.matchReason,
            userStatus: 'new',
          },
        });
        newCount++;
      }
    }

    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        postingsFound: sanitized.length,
        postingsNew: newCount,
      },
    });

    return {
      runId: run.id,
      profileId: profile.id,
      postings: sanitized,
      newCount,
    };
  } catch (error) {
    await prisma.jobRun
      .update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: (error?.message || String(error)).slice(0, 1000),
        },
      })
      .catch(() => {});
    throw error;
  }
}

export { USER_STATUSES };
