# Recruiting Intelligence System — Claude Context

## What This Repo Is
A zero-touch recruiting OS for a student's SWE/PM internship search. Calls, emails, and job applications flow into a Notion hub automatically. A React dashboard is the primary interface.

> Personal profile and real deployment identifiers live in `CLAUDE.local.md` (gitignored), not in this file.

---

## Actual Stack (as of July 2026)

| Tool | Role | Status |
|---|---|---|
| React + Vite | Dashboard — dev at localhost:3001, deployable to Vercel | ✅ |
| Vercel | Hosting — auto-deploys `main` branch via GitHub integration | ✅ |
| GitHub | Source + Vercel deploy trigger | ✅ |
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
    App.jsx                 ← Root App() (state/data-loading/routing) + NetworkTab (Table/Cards/Graph view switch)
    index.css                ← Tailwind v4 entry (`@import "tailwindcss"`) + @theme design tokens (fonts/colors)
    shared.jsx               ← Business-logic consts (STATUS_COLOR, STAGE_COLOR, isUntriaged, findDuplicateGroups, etc.) + re-exports Badge/EmptyState from components/ui/
    lib/
      cn.js                   ← clsx + tailwind-merge className helper used by every ui/ primitive
      icons.js                ← emoji → lucide-react icon lookup maps (STATUS_ICON, BUCKET_ICON, NAV_ICON, etc.)
    components/
      ui/                      ← Hand-rolled shadcn-shaped primitives: Button, Modal (framer-motion transition), Badge, Card, Tabs, Input, Select, EmptyState
      layout/                  ← Sidebar.jsx (dark nav rail + mobile bottom bar), AppShell.jsx (shell + tab-switch motion)
      jobBoards/               ← GitHubTab, RepoJobsView, JobCard, JobDetailModal, RepoStats, PreferencesPanel, CalendarView, UserProfileView, ContributionGrid, helpers.js
      OverviewTab.jsx, PipelineTab.jsx (+DuplicatesPanel), ActionsTab.jsx
      ContactDetailModal.jsx, ContactsTable.jsx, NetworkGraphTab.jsx
      LogInteractionModal.jsx  ← Unified Call/LinkedIn/Meeting/Email/Other logging (see Networking Tracker below)
    github.js                ← GitHub job board parser
    notion.js                ← Notion API client
  api/                       ← Vercel serverless functions (production key injection)
    notion.js                ← Proxies api.notion.com
    gh-api.js                ← Proxies api.github.com
    gh-contrib.js             ← Proxies github-contributions-api.jogruber.de
    claude-api.js             ← Proxies api.anthropic.com
  vercel.json                ← Rewrites /notion, /gh-api, /gh-contrib, /claude-api → api/*
  vite.config.js            ← Dev proxy config + `@tailwindcss/vite` plugin
scripts/
  email-pipeline.js         ← Google Apps Script (deploy to script.google.com)
notion/
  schema.md                 ← DB schema reference
  setup.js / patch-dbs.js    ← One-off scripts that created/patched the original 4 DBs
  add-interactions-db.js     ← One-off script that created the Interactions DB + Contacts.Referred By self-relation
  add-triage-fields.js       ← One-off script that added Triage/Location/Source Repo to Applications DB
plans/                      ← Phase plans (mostly outdated — see below)
prompts/                    ← Claude prompts
context.md                  ← Gitignored, untracked — Notion/Anthropic IDs for reference
.env                        ← Gitignored — all API keys
```

## Design System (shipped July 2026)

Tailwind converted from a CDN script to a real build (Tailwind v4 + `@tailwindcss/vite` plugin — no `tailwind.config.js` needed, theme lives in `app/src/index.css`'s `@theme` block). One dominant color (`ink`, a warm charcoal scale — sidebar bg/text) + one sharp accent (`accent`, warm amber/orange — every primary button/active-state/link/focus-ring) replace the old flat `blue-600`/`gray-50` look; `success`/`warning`/`danger` tokens replace stock Tailwind green/yellow/red for status badges. Fonts: **Space Grotesk** (headings, applied globally to h1/h2/h3 via CSS, no per-component class needed), **Public Sans** (body), **IBM Plex Mono** (not yet used anywhere specific — reserved for dense data if needed later). `darkMode: 'class'` custom-variant is registered but unused — light-only for now.

Layout is a persistent dark sidebar (`components/layout/Sidebar.jsx`) + full-width content area (`components/layout/AppShell.jsx`), collapsing to a bottom tab bar on mobile. `lucide-react` replaced emoji-as-icon usage everywhere except inside Notion select-option data values themselves (`STATUS_COLOR` keys like `'🟢 Warm'` still carry the emoji since that's the literal string written to/read from Notion — icons are looked up separately via `lib/icons.js`'s `statusIconFor()`, not derived from stripping the emoji out of the data). `framer-motion` powers exactly 3 moments: modal open/close (`ui/Modal.jsx`), tab-switch fade (`AppShell.jsx`), and nothing else — deliberately not scattered across hover states.

`App.jsx` was decomposed from ~1836 lines (monolithic, every tab inline) down to ~250 lines (root state/routing only) — every tab is now its own file under `components/`.

## Deployment

- **Vercel project:** root directory set to `app/` (your real project/team IDs are in `CLAUDE.local.md`)
- **GitHub:** Vercel auto-deploys on push to `main`
- **Manual deploy:** `cd app && npx vercel --prod`
- API keys live only as encrypted Vercel env vars (`NOTION_API_KEY`, `ANTHROPIC_API_KEY`) — never in the repo or the client bundle
- Local dev (`npm run dev`) still uses the Vite proxy in `vite.config.js`; production uses the `api/*.js` serverless functions instead — keep both in sync if proxy behavior changes
- Gotcha: Vercel's zero-config catch-all dynamic routes (`api/notion/[...path].js`) only match a single path segment and silently 404 on anything deeper — that's why the proxy functions are flat files (`api/notion.js`) with the sub-path passed as a `?path=` query param via `vercel.json` rewrites, not nested dynamic folders

---

## The Dashboard (app/)

**Dev server:** `cd app && npm run dev` → http://localhost:3001

### Tabs (5 top-level, down from 8 — see Networking Tracker below)
- **Overview** — Notion contacts needing follow-up, application stats, amber "N jobs need review" nudge, staggered KPI-card reveal on mount
- **Network** — Contact CRM from Contacts DB. Three view modes via a segmented control: **Table** (`ContactsTable.jsx`, `@tanstack/react-table`, default), **Cards**, and **Graph** (`NetworkGraphTab.jsx`, `react-force-graph-2d` — force-directed graph of contacts colored by Status + companies derived from the Company field, "Referred By" edges). Add/edit contacts via `ContactDetailModal.jsx` (Status, Urgency, Referred By, Follow-Up Date, plus a "+ Log" affordance that opens `LogInteractionModal.jsx` pre-filled with that contact). Top-level "+ Log Interaction" button opens the same modal unfilled. Every contact shows an expandable interaction History panel from the Interactions DB.
- **Pipeline** — Application tracker from Applications DB, stage funnel, `DuplicatesPanel` (see below)
- **Actions** — Overdue follow-ups, stale applications, high-urgency contacts
- **Job Boards** — GitHub job board parser (paste repo URL → parse README tables), auto-import, triage buckets, calendar/stats views

### Networking Tracker — unified logging (Stage 7 consolidation, July 2026)
What used to be 3 separate top-level tabs (Graph, LinkedIn, Calls) plus a Quick Log modal are now one place: **Network**. `LogInteractionModal.jsx` replaced `LinkedInTab.jsx` + `QuickLogModal.jsx` + the old `CallsTab` (all deleted) with a single modal and a channel selector — **Call / LinkedIn / Meeting / Email / Other**:
- **Call** and **LinkedIn**: paste-box + "Extract with Claude" (same extraction prompts as the old separate tabs). Call additionally shows Key Insights/My Commitments/Follow-Up Draft fields and writes to **both** the Calls DB (`addCallEntry`) and the Interactions DB — the original `CallsTab` only wrote Calls DB and never logged to Interactions, which was an inconsistency with the Interactions DB's own documented purpose ("every call... gets one row here"); the unified modal fixes that gap.
- **Meeting / Email / Other**: no transcript step, just contact/date/duration/notes → Interactions DB only.
- LinkedIn logging remains deliberately manual — no scraping/automation tooling (real LinkedIn account-ban risk for automated message capture).

### Job Boards Tab (most-developed feature)
- Input: GitHub repo URL (e.g., `github.com/speedyapply/2027-SWE-College-Jobs`) or username
- Parses README markdown/HTML tables → structured job listings
- **Auto-import (hands-off):** every open (non-closed) listing not already in the Applications DB is created there automatically with Triage='Needs Review', Location, and Source Repo set — concurrency-limited (4 at a time), with a progress banner. Dedup is keyed on exact Company+Role text against already-fetched `apps`, guarded by an in-flight `claimedKeysRef` so a rapid re-pull or React StrictMode's dev-mode double-effect-invocation can't double-import the same job (this bug shipped once and had to be cleaned up — see `DuplicatesPanel` below).
- Card grid with bucket system: Needs Review / Applying / Maybe / Applied / Pass — now backed by the Applications DB `Triage` field (not localStorage). Marking "Applied" bumps the real `Stage` to Applied (if still Wishlist) and sets Applied Date; marking "Pass" just tags Triage (no Stage change). `ContactDetailModal`-style optimistic local overlay (`optimistic` state) keeps bucket clicks instant without waiting on the Notion round-trip.
- Needs-Review/Pass rows (still at Stage=Wishlist) are excluded from Overview/Pipeline/Actions "active" stats via `isUntriaged()` in `shared.jsx`, so a big board import doesn't drown out real pipeline activity. Overview shows an amber "N jobs need review" nudge when the queue is non-empty.
- AI fit analysis per job via Claude Haiku (uses preferences panel)
- Calendar view by posting date
- Filter bar: free-text search (company + role + location), location text input, quick chips (Remote, Bay Area, NYC, etc.)
- Stats bar: new this week, remote count, top locations, multi-role companies

### Duplicate tracker (Pipeline tab)
`DuplicatesPanel` in `components/PipelineTab.jsx` groups Applications by normalized (trim+lowercase) Company+Role via `findDuplicateGroups()` in `shared.jsx`, shows counts + a reviewable list, and an explicit "Archive N duplicates" button (native `confirm()` gate, keeps the oldest row per group, archives the rest via `archiveApplication()`). Only catches exact-text duplicates, not fuzzily-worded ones across sources.

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
| Interactions | `39753135-a476-819e-96b4-dc41ecab6364` | Universal touchpoint ledger — one row per email/LinkedIn/call/meeting, regardless of whether a richer artifact (e.g. a Calls DB entry) also exists. Written by the email pipeline and `LogInteractionModal.jsx` (all 5 channels, including Call — see Networking Tracker above). See `notion/schema.md`. |

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

Not yet built: mobile quick-capture (generalize `LogInteractionModal` into a floating "+" button, especially now that there's a mobile bottom nav bar to anchor it to), weekly stale-contact digest (Apps Script time trigger), "looks cold" decay badge, warm-intro path finder.

## Features Researched — Next to Build

Priority order (Fall 2026 apps open in ~4 weeks):

1. **SimplifyJobs live feed** — parse `SimplifyJobs/Summer2026-Internships` daily via GitHub raw API (better source than speedyapply)
2. **LeetCode company panel** — fetch free CSV from `snehasishroy/leetcode-companywise-interview-questions`, show top 10 questions per company in application card
3. **Cold outreach drafter** — contact name + company + context → Claude writes personalized LinkedIn DM / email
4. **Referral coverage map** — cross-reference contacts vs target company list, surface gaps. Now cheaper to build: the Graph tab's company-grouping logic (`NetworkGraphTab.jsx`) is most of what this needs.
5. **Job fit scorer** — paste JD → Claude scores 1-10 fit + top gaps

Key insight from research: referrals are 2-3x more likely to convert than cold apps. Building the referral coverage map + outreach drafter together is the highest-ROI work before August.
