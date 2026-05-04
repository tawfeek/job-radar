<div align="center">
  <img src="client/public/logo.svg" alt="JobRadar" width="80" />
  <h1>JobRadar</h1>
  <p><strong>An AI agent that hunts job postings for you while you sleep.</strong></p>
  <p>
    <a href="#what-is-it">What</a> ·
    <a href="#why">Why</a> ·
    <a href="#quick-start-docker">Quick start</a> ·
    <a href="#architecture">Architecture</a> ·
    <a href="#cost">Cost</a> ·
    <a href="#roadmap">Roadmap</a>
  </p>
</div>

---

## What is it

You define a saved search ("QA Automation, Tel Aviv, Playwright/SDET, no fully-remote, ≥3 yrs"). Every morning JobRadar uses **Claude with the built-in `web_search` tool** to scan the live web — company career pages first, then Israeli job boards, then aggregators — and drops a small, scored, deduplicated list of fresh postings into a Kanban board you triage with one click.

Your annotations (saved, applied, interview, rejected, custom notes) **survive across re-runs** — a posting that resurfaces tomorrow keeps yesterday's status. No more reading the same 30 listings five days in a row.

> ⚠️ **Israel-centric by default** — the agent's prompt names Israeli boards and companies. To target another market, edit the "Where to search" block in `server/src/config/jobSearchConfig.js`. Generalisation is on the [roadmap](#roadmap).

## Why

The job-board treadmill is a UX disaster: ghost listings, recruitment-agency reposts, aggressive emailers, and identical postings duplicated across five sites. JobRadar inverts that loop:

| Old flow | JobRadar flow |
|---|---|
| Open 4–5 boards every morning | Look at one Kanban once a day |
| Re-read the same posting on day 2, 3, 4… | Posting auto-deduped on `(profile, sourceUrl)` |
| Copy-paste each link to a personal spreadsheet | Built-in Kanban + free-text notes per posting |
| Manually filter recruitment-agency reposts | Agent excludes them in the system prompt |
| Track "applied where" by hand | `appliedAt` auto-set when you move a card to **Applied** |

## Quick start (Docker)

The fastest path. **Requires Docker, an Anthropic API key, ~2 minutes.**

```bash
git clone https://github.com/tawfeek/job-radar.git
cd job-radar
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY, ADMIN_PASSWORD, JWT_SECRET
docker compose up
```

Open <http://localhost:5173>, sign in with your `ADMIN_PASSWORD`, create a profile, hit **Run**. Done.

## Quick start (without Docker)

Requires Node 22+, a running Postgres 14+, and an Anthropic API key.

```bash
git clone https://github.com/tawfeek/job-radar.git
cd job-radar
cp .env.example .env
# Edit .env. If you don't have Postgres locally:
#   docker run --name jobradar-pg -e POSTGRES_USER=jobradar \
#     -e POSTGRES_PASSWORD=jobradar -e POSTGRES_DB=jobradar \
#     -p 5434:5432 -d postgres:16
# …and set DATABASE_URL=postgresql://jobradar:jobradar@localhost:5434/jobradar

npm run install:all
cd server && npx prisma migrate dev --name init && cd ..
npm run dev
# API on :5173, UI on :5174
```

Then open <http://localhost:5174>.

## Architecture

```
┌──────────────────┐     web_search      ┌──────────────────┐
│ JobSearchProfile │ ─────────────────▶ │ Anthropic        │
│  (your saved     │                    │ claude-haiku-4-5 │
│   keywords)      │ ◀───── JSON ─────  │  + web_search    │
└──────────────────┘                    └──────────────────┘
         │                                       │
         │ scheduled by node-cron                │
         │ or "Run now" button                   │
         ▼                                       ▼
┌──────────────────┐    UPSERT on    ┌──────────────────────┐
│ JobRun           │ ───────────────▶│ JobPosting           │
│  (full history,  │  (profileId,    │  (your annotations   │
│   success/fail)  │   sourceUrl)    │   preserved across   │
└──────────────────┘                 │   re-encounters)     │
                                     └──────────────────────┘
                                               │
                                               ▼
                                     ┌──────────────────────┐
                                     │ React Kanban UI      │
                                     │  6 columns, status   │
                                     │  changes, notes      │
                                     └──────────────────────┘
```

The critical correctness move: **UPSERT on `(profileId, sourceUrl)`**. The agent refreshes its own metadata (freshness, match score, last-seen-at) on re-encounter, but never touches the user's annotations (`userStatus`, `userNotes`, `appliedAt`). That's how a posting found today and again tomorrow keeps "Applied — emailed Tomer on the 4th, follow up Tuesday" intact.

### Stack

- **Server** — Express 5, Prisma 7 (driver-adapter mode via `@prisma/adapter-pg`), PostgreSQL 16, single-password JWT auth, in-process `node-cron`
- **Client** — React 19, Vite 7, Tailwind 4, React Router 7, axios, react-hot-toast
- **Agent** — `@anthropic-ai/sdk` calling `claude-haiku-4-5` with the built-in `web_search_20250305` tool. Prompt enforces a fenced-JSON output the server parses + sanitises before persisting.

## Configuration

| Var | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | required, your API key from <https://console.anthropic.com/> | — |
| `ADMIN_PASSWORD` | the only secret you log in with | — |
| `JWT_SECRET` | signs auth tokens. `openssl rand -hex 64` | dev placeholder |
| `DATABASE_URL` | Postgres connection | compose default |
| `CRON_SCHEDULE` | when to fire daily | `0 9 * * *` |
| `CRON_ENABLED` | disable scheduling, manual runs only | `true` |
| `PORT` | API port | `5173` |

## Cost

`claude-haiku-4-5` + `web_search` runs **~$0.02–0.05 per profile per run** for a typical query (10 results, 5–10 web searches). Two active profiles, scheduled daily, comes to roughly **$0.50–1.50/month**. Bring your own key — JobRadar makes no third-party calls under your account other than Anthropic.

## Roadmap

- [ ] Multi-tenant SaaS (signup, per-user keys, billing)
- [ ] Coverage of more regional boards (EU, US, India)
- [ ] Email digest / Slack delivery of new postings
- [ ] CV-match scoring (upload your CV, agent grades fit beyond keywords)
- [ ] Resume-tuning suggestions per posting

## Acknowledgements

Extracted from a private feature in [tawfeek/portfolio](https://github.com/tawfeek/portfolio) and generalised. The prompt design owes a lot to a few rounds of "Claude found a ghost listing again" debugging.

## License

MIT — see [LICENSE](./LICENSE).
