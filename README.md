# Recruiting OS

A near zero-touch **recruiting operating system** for a student or early-career
job search. Calls, emails, LeetCode progress, and job postings flow into a
**Notion** hub automatically, and a **React** dashboard sits on top as the
primary interface — a lightweight CRM, application tracker, and job-board
aggregator with AI assistance from Claude.

> Built as a personal project. It ships with example/placeholder identifiers —
> bring your own Notion workspace and API keys to run it.

---

## What it does

- **Contact CRM** — a Notion-backed contact list with status, urgency,
  follow-up dates, a "referred by" self-relation, table + force-directed graph
  views, and an interaction history ledger.
- **Application tracker** — one row per company/role with a stage funnel.
- **AI email pipeline** — a Google Apps Script watches a Gmail label, uses
  Claude to classify + extract each recruiting email, upserts the contact and
  application in Notion, and creates a Calendar event when an interview is
  scheduled.
- **Call capture** — paste a meeting summary (e.g. from Granola); Claude
  extracts a structured summary, insights, commitments, and a follow-up draft
  into Notion.
- **LinkedIn capture** — paste a LinkedIn conversation; Claude extracts the
  contact + summary and logs it (manual by design — no scraping/automation).
- **Job-board aggregator** — paste a GitHub job-board repo URL (e.g. the
  community internship lists), parse its README tables into cards, bucket them
  (Applying / Maybe / Applied / Pass), get per-job AI fit analysis, and view by
  posting date.
- **LeetCode → Notion sync** — a Tampermonkey userscript that saves accepted
  submissions to a Notion database for spaced review.

---

## Architecture

```
INPUTS                          NOTION HUB                 DASHBOARD
──────                          ──────────                 ─────────
Gmail ──[Apps Script + Claude]─► Contacts DB   ◄─────────► React + Vite app
Granola/notes ──[paste+Claude]─► Calls DB      ◄─────────► (Vercel-hosted)
LinkedIn ──────[paste+Claude]──► Interactions DB
LeetCode ──────[userscript]────► LC Problems DB
GitHub job boards ─────────────► Applications DB / localStorage buckets
```

**API keys are never exposed to the browser.** The dashboard calls same-origin
proxy routes; the actual Notion / Anthropic / GitHub keys are injected
server-side by Vercel serverless functions (`app/api/*.js`) in production, and
by the Vite dev-server proxy (`app/vite.config.js`) in local development.

---

## Tech stack

| Layer | Tech |
|---|---|
| Dashboard | React 18 + Vite |
| Data tables / graph | `@tanstack/react-table`, `react-force-graph-2d` |
| Hosting | Vercel (serverless functions for key injection) |
| Hub | Notion (5 databases) |
| AI | Claude (Anthropic API — Haiku for extraction/fit analysis) |
| Email automation | Google Apps Script |
| LeetCode sync | Tampermonkey userscript |

---

## Repo structure

```
app/                      React + Vite dashboard (primary interface)
  src/                    App.jsx, components/, notion.js, github.js, shared.jsx
  api/                    Vercel serverless proxies (server-side key injection)
  vite.config.js          Dev proxy (mirrors api/ for `npm run dev`)
scripts/
  email-pipeline.js       Google Apps Script — Gmail → Claude → Notion
notion/
  schema.md               Database schema reference
  setup.js / patch-dbs.js One-off scripts that created/patched the databases
dashboard/
  leetcode-notion-sync.user.js   Tampermonkey userscript
prompts/                  Claude prompt templates
plans/                    Phase-by-phase build notes
```

See [`notion/schema.md`](notion/schema.md) for the full database schema and
[`CLAUDE.md`](CLAUDE.md) for a technical overview.

---

## Setup

### 1. Notion
1. Create an internal integration at
   <https://www.notion.so/my-integrations> and copy the token (`ntn_…`).
2. Create the databases described in
   [`notion/schema.md`](notion/schema.md) (or adapt `notion/setup.js`).
3. Share each database with your integration.

### 2. Dashboard (`app/`)
```bash
cd app
cp .env.example .env.local     # fill in NOTION_API_KEY, ANTHROPIC_API_KEY
npm install
npm run dev                    # http://localhost:3001
```

Deploy to Vercel with the project **root directory set to `app/`**, and add
`NOTION_API_KEY` / `ANTHROPIC_API_KEY` (and optional `GITHUB_TOKEN`) as
encrypted environment variables.

### 3. Email pipeline (`scripts/email-pipeline.js`)
1. Create a project at <https://script.google.com>, paste in the file.
2. Add `NOTION_KEY` + `ANTHROPIC_KEY` under **Project Settings → Script
   Properties**.
3. In Gmail, create a `recruiting` label (and a filter to apply it).
4. Run `setup()` once, then add a time-based trigger (every ~10 min) on
   `processRecruitingEmails`.

### 4. LeetCode userscript (`dashboard/leetcode-notion-sync.user.js`)
Install [Tampermonkey](https://www.tampermonkey.net/), add the script, and fill
in `NOTION_KEY` and `LC_DB_ID` at the top with your own values.

### 5. Root scripts (optional, `notion/*.js`)
```bash
cp .env.example .env           # NOTION_KEY, ANTHROPIC_KEY
npm install
```

---

## Security & privacy

- **No secrets in the repo.** All keys are read from environment variables
  (`.env` / `.env.local`, both gitignored). Copy the `.env.example` files and
  fill in your own.
- **Keys never reach the browser** — they are injected server-side by the
  Vercel functions / Vite proxy.
- The Notion **database IDs** in the code are not credentials; a database can
  only be read with an integration token that has been explicitly shared with
  it. Swap in your own IDs when you set up your workspace.
- Personal data (transcripts, job descriptions, personal context) is gitignored
  and never committed.

---

## License

[MIT](LICENSE)
