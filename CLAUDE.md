# Recruiting Intelligence System — Claude Context

## What This Repo Is
A zero-touch recruiting OS for the candidate (a university CS sophomore, a strong GPA, Fall 2026 SWE internship recruiting). Calls, emails, and job applications flow into a Notion hub automatically. A React dashboard is the primary interface.

## Who Is the candidate
- a university, CS-LSA, Sophomore, a strong GPA
- Graduating May 2028
- Targeting SWE internship (primary) and PM internship
- Recruiting season: Fall 2026 — apps open August 2026

---

## Actual Stack (as of July 2026)

| Tool | Role | Status |
|---|---|---|
| React + Vite | Dashboard — live at https://your-app.vercel.app, dev at localhost:3001 | ✅ Deployed |
| Vercel | Hosting — auto-deploys `main` branch via GitHub integration | ✅ Live |
| GitHub | `your-org/recruiting-os` (private) | ✅ Connected |
| Google Apps Script | Email pipeline (Gmail → Claude → Notion) | ✅ Built, needs deploy |
| Claude API (Haiku 4.5) | AI fit analysis, call extraction, email extraction | ✅ Wired via serverless proxy |
| Notion | Central hub — 5 databases | ✅ Live |
| Granola | Call transcription (no bot) | 🔄 Download + connect |
| LeetNotion extension | LeetCode → Notion auto-sync | 🔄 Pending install |
| Exa ($250 YC credits) | Contact enrichment — LinkedIn lookup | 🔄 Planned |

**Abandoned:** Gumloop (BYOK requires $37/mo Pro plan), Cowork/Claude Desktop scheduled tasks

---

## Repo Structure

```
app/                        ← React + Vite dashboard (PRIMARY) — Vercel root directory
  src/
    App.jsx                 ← Main app, tab shells + state (Overview/Network/Pipeline/Actions/Calls/GitHub)
    shared.jsx               ← Shared consts (STATUS_COLOR, ROLE_OPTIONS, etc.) + micro-components (Badge, EmptyState) used across App.jsx and components/
    components/               ← Network-tracker components: ContactDetailModal, ContactsTable, LinkedInTab, QuickLogModal, NetworkGraphTab
    github.js               ← GitHub job board parser
    notion.js               ← Notion API client
  api/                       ← Vercel serverless functions (production key injection)
    notion.js                ← Proxies api.notion.com
    gh-api.js                ← Proxies api.github.com
    gh-contrib.js             ← Proxies github-contributions-api.jogruber.de
    claude-api.js             ← Proxies api.anthropic.com
  vercel.json                ← Rewrites /notion, /gh-api, /gh-contrib, /claude-api → api/*
  vite.config.js            ← Dev-only proxy config (mirrors api/ behavior for `npm run dev`)
scripts/
  email-pipeline.js         ← Google Apps Script (deploy to script.google.com)
notion/
  schema.md                 ← DB schema reference
  setup.js / patch-dbs.js    ← One-off scripts that created/patched the original 4 DBs
  add-interactions-db.js     ← One-off script that created the Interactions DB + Contacts.Referred By self-relation
plans/                      ← Phase plans (mostly outdated — see below)
prompts/                    ← Claude prompts
context.md                  ← Gitignored, untracked — Notion/Anthropic IDs for reference
.env                        ← Gitignored — all API keys
```

## Deployment

- **Live URL:** https://your-app.vercel.app
- **Vercel project:** `recruiting-os` (team `your-vercel-team`), root directory set to `app/`
- **GitHub:** `your-org/recruiting-os` (private), Vercel auto-deploys on push to `main`
- **Manual deploy:** `cd app && npx vercel --prod`
- API keys live only as encrypted Vercel env vars (`NOTION_API_KEY`, `ANTHROPIC_API_KEY`) — never in the repo or the client bundle
- Local dev (`npm run dev`) still uses the Vite proxy in `vite.config.js`; production uses the `api/*.js` serverless functions instead — keep both in sync if proxy behavior changes
- Gotcha: Vercel's zero-config catch-all dynamic routes (`api/notion/[...path].js`) only match a single path segment and silently 404 on anything deeper — that's why the proxy functions are flat files (`api/notion.js`) with the sub-path passed as a `?path=` query param via `vercel.json` rewrites, not nested dynamic folders

---

## The Dashboard (app/)

**Dev server:** `cd app && npm run dev` → http://localhost:3001

### Tabs
- **Overview** — Notion contacts needing follow-up, application stats
- **Network** — Contact CRM from Contacts DB. Defaults to a filterable/sortable table view (`ContactsTable.jsx`, `@tanstack/react-table`), toggle to card view. Add/edit contacts via `ContactDetailModal.jsx` (also sets Status, Urgency, Referred By, Follow-Up Date — first in-app way to edit a contact). "+ Log" opens `QuickLogModal.jsx` for logging a call/meeting with no rich transcript. Every contact shows an expandable interaction History panel from the Interactions DB.
- **Graph** — `NetworkGraphTab.jsx` (`react-force-graph-2d`): force-directed graph of contacts (colored by Status) + companies (derived from the Company field), with "Referred By" and "works at" edges. Click a contact node for details.
- **Pipeline** — Application tracker from Applications DB, stage funnel
- **Actions** — (planned) outreach queue
- **Calls** — Paste Granola summary → Claude extracts → saves to Notion Calls DB
- **LinkedIn** — `LinkedInTab.jsx`: paste a LinkedIn conversation → Claude extracts contact + summary → logs to Interactions DB. Manual by design — no scraping/automation tooling (real LinkedIn account-ban risk for automated message capture).
- **Job Boards** — GitHub job board parser (paste repo URL → parse README tables)

### Job Boards Tab (most-developed feature)
- Input: GitHub repo URL (e.g., `github.com/speedyapply/2027-SWE-College-Jobs`) or username
- Parses README markdown/HTML tables → structured job listings
- Card grid with bucket system: Applying / Maybe / Applied / Pass (localStorage)
- AI fit analysis per job via Claude Haiku (uses preferences panel)
- Calendar view by posting date
- Filter bar: free-text search (company + role + location), location text input, quick chips (Remote, Bay Area, NYC, etc.)
- Stats bar: new this week, remote count, top locations, multi-role companies

### Vite Proxy (all keys injected server-side, never in browser bundle)
```
/notion    → api.notion.com          (injects NOTION_API_KEY)
/gh-api    → api.github.com          (injects optional GITHUB_TOKEN)
/gh-contrib → github-contributions-api.jogruber.de
/claude-api → api.anthropic.com      (injects ANTHROPIC_API_KEY)
```

---

## Notion Databases

| DB | ID | Purpose |
|---|---|---|
| Contacts | `6f941973-1fce-40c3-943c-4c908940e2a8` | Master CRM. Has a `Referred By` self-relation (who introduced whom) used by the Graph tab. |
| Calls | `8ddef121-1744-45d2-aa52-7699a727e9c0` | Call notes, linked to contact |
| Applications | `49011c2e-8165-4373-a41b-f913b02d1052` | One row per company/role |
| LC Problems | `9fc96722-d155-4333-9770-41130fb59a39` | LeetCode auto-sync |
| Interactions | `39753135-a476-819e-96b4-dc41ecab6364` | Universal touchpoint ledger — one row per email/LinkedIn/call/meeting, regardless of whether a richer artifact (e.g. a Calls DB entry) also exists. Written by the email pipeline, LinkedIn tab, Quick Log modal, and Calls tab flows. See `notion/schema.md`. |

---

## Email Pipeline (Google Apps Script)

File: `scripts/email-pipeline.js`
Deploy: script.google.com → paste file → Script Properties → add `ANTHROPIC_KEY` + `NOTION_KEY` → run `setup()` → add trigger (every 10 min)

Pipeline: Gmail label `recruiting` → Claude Haiku classifies + extracts (newest message only) → upsert contact in Notion → upsert application → Google Calendar event (if interview date found) → every message new since the last run (tracked per-thread via `PropertiesService`, key `msgcount_<threadId>`) gets logged as its own row in the Interactions DB (no LLM call) → `recruiting-done` label applied as a visual marker only (no longer gates processing, since a thread can grow replies after being marked done)

Cost: ~$0.001/email with Haiku (classification only runs once per thread-update, not per logged message)

---

## Critical Constraints
- `.env` and `context.md` are gitignored — credentials never committed
- API keys in Vite proxy only — never reach the browser bundle
- Google Apps Script keys in Script Properties only
- Notion free plan: no native automations

---

## Networking Tracker (shipped July 2026)

Built out the Network tab into a full touchpoint-tracking system: Interactions DB (universal ledger), `Referred By` self-relation, in-app contact edit (`ContactDetailModal.jsx`), table view with filters (`ContactsTable.jsx`), relationship graph (`NetworkGraphTab.jsx`), manual LinkedIn conversation logging (`LinkedInTab.jsx`, deliberately manual — no scraping/automation, real LinkedIn ban risk), a Quick Log modal for untranscribed calls, and email reply capture in the Apps Script pipeline. New shared helpers/consts live in `app/src/shared.jsx`; new components in `app/src/components/`. New deps: `@tanstack/react-table`, `react-force-graph-2d`.

Not yet built: mobile quick-capture (generalize QuickLogModal into a floating "+" button), weekly stale-contact digest (Apps Script time trigger), "looks cold" decay badge, warm-intro path finder.

## Features Researched — Next to Build

Priority order (Fall 2026 apps open in ~4 weeks):

1. **SimplifyJobs live feed** — parse `SimplifyJobs/Summer2026-Internships` daily via GitHub raw API (better source than speedyapply)
2. **LeetCode company panel** — fetch free CSV from `snehasishroy/leetcode-companywise-interview-questions`, show top 10 questions per company in application card
3. **Cold outreach drafter** — contact name + company + context → Claude writes personalized LinkedIn DM / email
4. **Referral coverage map** — cross-reference contacts vs target company list, surface gaps. Now cheaper to build: the Graph tab's company-grouping logic (`NetworkGraphTab.jsx`) is most of what this needs.
5. **Job fit scorer** — paste JD → Claude scores 1-10 fit + top gaps

Key insight from research: referrals are 2-3x more likely to convert than cold apps. Building the referral coverage map + outreach drafter together is the highest-ROI work before August.
