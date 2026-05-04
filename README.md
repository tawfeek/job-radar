# JobRadar

> **An AI-powered personal job-search agent.** Defines saved searches,
> runs Claude with the built-in web_search tool every morning, and
> drops new postings into a Kanban board you can triage with one click.

Built for the Israeli tech market by default — every other market needs
a one-block prompt edit (see `server/src/config/jobSearchConfig.js`).

## Why

The job-board treadmill is a UX disaster: dozens of stale "ghost" listings,
recruitment-agency reposts, and aggressive emailers. JobRadar flips it.
You define what you actually want once. An agent does the daily search.
Every morning you have a small, scored, deduped list — and your annotations
(applied / rejected / interview / notes) **survive across re-runs**, so a
posting that resurfaces tomorrow keeps yesterday's status.

## Status

🚧 **Phase A merged** — server, agent, cron, auth, schema. UI shipping next.

## Setup (local)

> Requires Node 22+, Postgres 14+, an Anthropic API key.

```bash
git clone https://github.com/tawfeek/job-radar.git
cd job-radar
cp .env.example .env          # fill in ANTHROPIC_API_KEY + ADMIN_PASSWORD
npm run install:all
cd server && npx prisma migrate dev && cd ..
npm run dev                   # API on :5173, UI on :5174
```

Open `http://localhost:5174`, log in with your `ADMIN_PASSWORD`, create a
profile, hit "Run now" to verify the agent works end-to-end.

The cron runs all active profiles once a day at `CRON_SCHEDULE`
(default `0 9 * * *`).

## Architecture (one-paragraph)

Express 5 + Prisma 7 + Postgres on the back. React 19 + Vite 7 + Tailwind 4
on the front. The agent in `server/src/jobs/jobSearch.js` calls
`claude-haiku-4-5` with `web_search_20250305`, parses a fenced JSON block
out of the response, and **UPSERTs** each posting on `(profileId, sourceUrl)` —
the critical correctness move that preserves user annotations across
re-encounters. Every run is recorded as a `JobRun` row (running → success
or failed) for full observability.

## Configuration knobs

| Var | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | required, your key | — |
| `ADMIN_PASSWORD` | the only secret to log in | — |
| `JWT_SECRET` | signs auth tokens | dev placeholder |
| `DATABASE_URL` | Postgres connection | local default |
| `CRON_SCHEDULE` | when to fire daily | `0 9 * * *` |
| `CRON_ENABLED` | disable scheduling | `true` |
| `PORT` | API port | `5173` |

## Cost estimate

`claude-haiku-4-5` + `web_search` runs ~$0.02–0.05 per profile per run for
typical queries. Two active profiles, daily, comes to roughly **$0.50–1.50/month**.

## Roadmap

- [ ] Multi-tenant SaaS (signup, per-user keys, billing)
- [ ] Email digest of new postings
- [ ] Slack/Telegram delivery
- [ ] Coverage of more regional boards (EU, US, India)
- [ ] CV-match scoring (upload your CV, agent grades fit beyond keywords)

## License

MIT — see [LICENSE](./LICENSE).
