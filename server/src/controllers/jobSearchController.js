// Profile + Run + Posting controllers. Lifted almost verbatim from the
// portfolio repo's admin/jobSearchController.js — the agent-side logic is
// identical; only the auth layer wrapping it differs (single password
// here, JWT issuer there).

import prisma from '../config/database.js';
import { runJobSearch } from '../jobs/jobSearch.js';
import { isAnthropicConfigured } from '../config/anthropic.js';
import { USER_STATUSES } from '../config/jobSearchConfig.js';

// ========== PROFILES ==========

export async function listProfiles(req, res) {
  try {
    const profiles = await prisma.jobSearchProfile.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { postings: true, runs: true } },
      },
    });
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to list profiles' });
  }
}

export async function getProfile(req, res) {
  try {
    const profile = await prisma.jobSearchProfile.findUnique({
      where: { id: req.params.id },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to load profile' });
  }
}

function sanitizeProfileInput(body) {
  if (!body || typeof body !== 'object') return null;
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
  if (!name) return null;

  const toStringArray = (v) =>
    Array.isArray(v)
      ? v.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, 100))
      : [];

  return {
    name,
    keywords: toStringArray(body.keywords),
    excludeKw: toStringArray(body.excludeKw),
    location: (typeof body.location === 'string' && body.location.trim()) || 'Israel',
    remoteOk: body.remoteOk !== false,
    minYearsExp: Number.isInteger(body.minYearsExp) ? body.minYearsExp : null,
    maxResults: Number.isInteger(body.maxResults)
      ? Math.max(1, Math.min(20, body.maxResults))
      : 10,
    active: body.active !== false,
  };
}

export async function createProfile(req, res) {
  try {
    const data = sanitizeProfileInput(req.body);
    if (!data) return res.status(400).json({ error: 'name is required' });
    if (data.keywords.length === 0) {
      return res.status(400).json({ error: 'at least one keyword is required' });
    }
    const profile = await prisma.jobSearchProfile.create({ data });
    res.status(201).json(profile);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to create profile' });
  }
}

export async function updateProfile(req, res) {
  try {
    const data = sanitizeProfileInput(req.body);
    if (!data) return res.status(400).json({ error: 'invalid payload' });
    const profile = await prisma.jobSearchProfile.update({
      where: { id: req.params.id },
      data,
    });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to update profile' });
  }
}

export async function deleteProfile(req, res) {
  try {
    await prisma.jobSearchProfile.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to delete profile' });
  }
}

// ========== RUNS ==========

export async function runJob(req, res) {
  if (!isAnthropicConfigured()) {
    return res
      .status(503)
      .json({ error: 'ANTHROPIC_API_KEY is not set on the server' });
  }
  try {
    const result = await runJobSearch(req.params.id);
    res.json({
      success: true,
      runId: result.runId,
      profileId: result.profileId,
      found: result.postings.length,
      new: result.newCount,
    });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Job run failed' });
  }
}

export async function listRuns(req, res) {
  try {
    const where = req.query.profileId ? { profileId: req.query.profileId } : undefined;
    const runs = await prisma.jobRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { profile: { select: { id: true, name: true } } },
    });
    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to list runs' });
  }
}

// ========== POSTINGS ==========

export async function listPostings(req, res) {
  try {
    const { profileId, status, freshness } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    const where = {};
    if (profileId) where.profileId = profileId;
    if (status) where.userStatus = status;
    else where.userStatus = { not: 'archived' };
    if (freshness) where.freshness = freshness;

    const postings = await prisma.jobPosting.findMany({
      where,
      orderBy: [{ userStatus: 'asc' }, { matchScore: 'desc' }, { firstSeenAt: 'desc' }],
      take: limit,
      include: { profile: { select: { id: true, name: true } } },
    });
    res.json(postings);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to list postings' });
  }
}

export async function updatePosting(req, res) {
  try {
    const data = {};
    if (typeof req.body?.userStatus === 'string') {
      if (!USER_STATUSES.includes(req.body.userStatus)) {
        return res.status(400).json({
          error: `userStatus must be one of: ${USER_STATUSES.join(', ')}`,
        });
      }
      data.userStatus = req.body.userStatus;
      if (req.body.userStatus === 'applied') {
        const current = await prisma.jobPosting.findUnique({
          where: { id: req.params.id },
          select: { appliedAt: true },
        });
        if (current && !current.appliedAt) data.appliedAt = new Date();
      }
    }
    if (typeof req.body?.userNotes === 'string') {
      data.userNotes = req.body.userNotes.slice(0, 5000) || null;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'no updatable fields in body' });
    }

    const posting = await prisma.jobPosting.update({
      where: { id: req.params.id },
      data,
    });
    res.json(posting);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to update posting' });
  }
}

export async function deletePosting(req, res) {
  try {
    await prisma.jobPosting.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to delete posting' });
  }
}

export async function getStatuses(req, res) {
  res.json({ statuses: USER_STATUSES });
}
