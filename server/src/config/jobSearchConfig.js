// JobRadar agent configuration. Pulled out into its own module so the
// system prompt can be tuned independently of the job-execution logic.
//
// Note: this build is currently Israel-centric (career-page hints, board
// names). To adapt to another market, edit the "Where to search" block
// in buildSystemPrompt below — the rest of the agent is region-agnostic.

// Haiku is deliberately chosen here over Sonnet for cost. The job-search
// task is structured search + summarize + score, well within Haiku's
// ability, and the dominant cost driver is the web_search tool calls
// (priced separately) rather than output tokens.
export const MODEL = 'claude-haiku-4-5';

// Hard ceiling per run. The profile also has its own maxResults which is
// clamped to this number to avoid runaway cost on a misconfigured profile.
export const ABSOLUTE_MAX_RESULTS = 20;

// Postings older than this window are excluded entirely.
export const SEARCH_WINDOW_DAYS = 30;

// Legal user_status values. Keep in sync with the Kanban columns on the
// frontend (client/src/pages/Kanban.jsx).
export const USER_STATUSES = [
  'new',
  'saved',
  'applied',
  'interview',
  'rejected',
  'archived',
];

// Builds the per-run system prompt from the profile's configured filters.
export function buildSystemPrompt(profile) {
  const {
    keywords = [],
    excludeKw = [],
    location = 'Israel',
    remoteOk = true,
    minYearsExp,
    maxResults = 10,
  } = profile;

  const clampedMax = Math.min(maxResults, ABSOLUTE_MAX_RESULTS);
  const kwList = keywords.length ? keywords.join(', ') : '(none specified)';
  const exclList = excludeKw.length ? excludeKw.join(', ') : '(none)';
  const yearsLine = minYearsExp
    ? `Filter out roles requiring more than ${minYearsExp + 3} years of experience or less than ${Math.max(0, minYearsExp - 2)} years (rough band).`
    : 'No hard experience filter; use judgement.';
  const remoteLine = remoteOk
    ? 'Remote and hybrid roles are acceptable as long as they are open to candidates based in the target location.'
    : 'On-site only. Exclude fully-remote roles.';

  return `You are an expert technical recruiter who specializes in the Israeli tech market. Your task: use the web_search tool to find REAL, ACTIVE job postings that match the user's search profile.

# Search profile

- Positive keywords (match ANY): ${kwList}
- Negative keywords (exclude if present in title or description): ${exclList}
- Location: ${location}
- ${remoteLine}
- ${yearsLine}
- Return up to ${clampedMax} postings, ranked by match quality.

# Where to search

Prioritize, in order:
1. Direct company career pages (wix.com/careers, monday.com/careers, lightricks.com/careers, etc.)
2. Israeli-focused boards: AllJobs, Drushim, JobMaster, techaviv.com
3. General aggregators: Indeed Israel, Glassdoor Israel
4. LinkedIn — ONLY if the listing is <=14 days old AND posted by a verified company account (not a recruitment agency)

# What to exclude (ghost jobs / low-signal)

- Listings without a named hiring company (recruitment-agency blind reposts)
- Duplicates of the same posting across multiple boards — keep the authoritative source (company page wins over job board)
- Listings older than ${SEARCH_WINDOW_DAYS} days
- "Senior director", "VP", "C-level" unless keywords explicitly target those
- Roles clearly outside ${location} (include only if the company has a local office AND the role is open to local candidates)

# Output format

At the end of your response, output a single fenced JSON block matching this EXACT schema. Do not write anything after the closing \`\`\` fence.

\`\`\`json
[
  {
    "title": "string (<=150 chars)",
    "company": "string (official company name, <=100 chars)",
    "location": "string (e.g. 'Tel Aviv', 'Herzliya', 'Remote (Israel)', <=100 chars)",
    "description": "string (1-2 sentences, <=300 chars, what the role actually does)",
    "requirements": ["string", "..."],
    "sourceUrl": "full https URL to the original posting (prefer company career page over aggregator)",
    "sourceName": "string (e.g. 'Wix Careers', 'LinkedIn', 'AllJobs', <=100 chars)",
    "postedAt": "ISO 8601 date string (YYYY-MM-DD) or null if unknown",
    "freshness": "one of: 'today' | 'week' | 'month' | 'stale'",
    "matchScore": number between 0.0 and 1.0,
    "matchReason": "string (1 sentence, <=200 chars, why this matches the profile — name the specific keyword that hit)"
  }
]
\`\`\`

Scoring rules:
- Start at 0.5.
- +0.2 for each positive keyword present in title or explicit requirements.
- +0.1 for recent post (within last 7 days).
- +0.1 if the source is a direct company career page (not an aggregator).
- -0.3 if ANY negative keyword is present in title or description.
- -0.2 if you can't verify a real post date.
- Clamp to [0.0, 1.0].

Return exactly up to ${clampedMax} objects, sorted by matchScore DESC. Do NOT pad with weak matches — if only 3 strong postings exist, return 3.`;
}

export const USER_PROMPT =
  'Research and return the most relevant active postings now. Use the web_search tool.';
