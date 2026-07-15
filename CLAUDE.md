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
| Claude API (Haiku 4.5 + Sonnet vision) | AI fit analysis, call/email/LinkedIn extraction, screenshot→calendar-event extraction | ✅ Wired via serverless proxy |
| Notion | Central hub — 5 databases | ✅ Live (⚠️ see Known Issues if you hit "Could not find database") |
| Recharts | Overview/Job Boards charts (funnel, donut, trend, top-locations bar) | ✅ Live |
| Google Calendar API | Screenshot/text → calendar event, via OAuth | ✅ Live in dev · 🔄 needs env vars added to Vercel for production |
| Granola | Call transcription (no bot) | 🔄 Download + connect |
| LeetNotion extension | LeetCode → Notion auto-sync | 🔄 Pending install |
| Exa | People discovery (Discover) + company discovery (Explore) — public-web search | ✅ Wired via serverless proxy · needs a (free) Exa account key |
| YC directory (yc-oss/api) | Free public company data (Explore tab candidate pool + autocomplete) | ✅ Direct client fetch, no auth |

**Abandoned:** Gumloop (BYOK requires $37/mo Pro plan), Cowork/Claude Desktop scheduled tasks

---

## Claude Code Dev Tooling (set up 2026-07-14, not part of the deployed app)

- **`/graphify`** — AST-only knowledge graph of this repo (no LLM cost; the 22 doc/markdown files are skipped since semantic extraction needs an API key — code-only mode covers `app/`, `scripts/`, `notion/`, etc.). Rebuild with `graphify . --no-viz --code-only`. Output in `graphify-out/` (gitignore this if it isn't already).
- **GitHub MCP server** (Docker-based, connected globally in `~/.claude`, not repo-specific) — write-shaped tools (push, merge, delete, create branch/PR/issue, etc.) require explicit confirmation before running; GitHub content pulled into context (issue bodies, PR comments) is scanned for prompt-injection patterns first. Guardrails live in `~/.claude/settings.json` (`permissions.ask`) and `~/.claude/hooks/github-mcp-*.js`.
- **Project subagents** in `.claude/agents/`: `code-reviewer`, `debugger`, `security-auditor`, `react-specialist` (pulled from VoltAgent/awesome-claude-code-subagents, matched to this repo's React/Vite stack). Invoke via the Agent tool by name. Global `gsd-*` agents (e.g. `gsd-code-reviewer`) cover similar ground but are more deeply tied to the `.planning/` GSD workflow — these are the simpler, framework-agnostic option.
- **claude-context** (semantic code search MCP) was evaluated and deliberately skipped for now — needs an embedding provider + Milvus vector DB, judged not worth the infra overhead at this repo's size. Revisit if the codebase grows substantially or cross-repo search becomes useful.

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
      layout/                  ← Sidebar.jsx (dark nav rail + mobile bottom bar + "+ Event" quick action), AppShell.jsx (shell + tab-switch motion)
      charts/                  ← Recharts wrappers: theme.js (design-token → hex translation), ChartTooltip.jsx, BarChart.jsx (vertical/horizontal), DonutChart.jsx, TrendChart.jsx — presentation-only, no data fetching
      jobBoards/               ← GitHubTab, RepoJobsView, JobCard, JobDetailModal, RepoStats, PreferencesPanel, CalendarView, UserProfileView, ContributionGrid, helpers.js
      OverviewTab.jsx, PipelineTab.jsx (+DuplicatesPanel), ActionsTab.jsx
      ContactDetailModal.jsx, ContactsTable.jsx, NetworkGraphTab.jsx
      LogInteractionModal.jsx  ← Unified Call/LinkedIn/Meeting/Email/Other logging (see Networking Tracker below)
      AddToCalendarModal.jsx   ← Screenshot/text → Google Calendar event (see Google Calendar Integration below)
    github.js                ← GitHub job board parser
    notion.js                ← Notion API client
  api/                       ← Vercel serverless functions (production key injection)
    notion.js                ← Proxies api.notion.com
    gh-api.js                ← Proxies api.github.com
    gh-contrib.js             ← Proxies github-contributions-api.jogruber.de
    claude-api.js             ← Proxies api.anthropic.com (builds a fresh headers object — never forwards the browser's Origin, see Known Issues)
    google-calendar.js        ← Mints a Google access token from the stored refresh token, then forwards to the Calendar API
  vercel.json                ← Rewrites /notion, /gh-api, /gh-contrib, /claude-api, /google-calendar → api/*
  vite.config.js            ← Dev proxy config + `@tailwindcss/vite` plugin + custom /google-calendar middleware (server.proxy can't do the mint-then-forward two-step)
scripts/
  email-pipeline.js         ← Google Apps Script (deploy to script.google.com)
notion/
  schema.md                 ← DB schema reference
  setup.js / patch-dbs.js    ← One-off scripts that created/patched the original 4 DBs
  add-interactions-db.js     ← One-off script that created the Interactions DB + Contacts.Referred By self-relation
  add-triage-fields.js       ← One-off script that added Triage/Location/Source Repo to Applications DB
google-calendar/
  get-refresh-token.js      ← One-time OAuth script — run once, paste the printed refresh token into .env (see Google Calendar Integration)
plans/                      ← Phase plans (mostly outdated — see below)
prompts/                    ← Claude prompts
context.md                  ← Gitignored, untracked — Notion/Anthropic IDs for reference
.env                        ← Gitignored — all API keys
```

## Design System (shipped July 2026)

Tailwind converted from a CDN script to a real build (Tailwind v4 + `@tailwindcss/vite` plugin — no `tailwind.config.js` needed, theme lives in `app/src/index.css`'s `@theme` block). One dominant color (`ink`, a warm charcoal scale — sidebar bg/text) + one sharp accent (`accent`, warm amber/orange — every primary button/active-state/link/focus-ring) replace the old flat `blue-600`/`gray-50` look; `success`/`warning`/`danger` tokens replace stock Tailwind green/yellow/red for status badges. Fonts: **Space Grotesk** (headings, applied globally to h1/h2/h3 via CSS, no per-component class needed), **Public Sans** (body), **IBM Plex Mono** (not yet used anywhere specific — reserved for dense data if needed later). `darkMode: 'class'` custom-variant is registered but unused — light-only for now.

Layout is a persistent dark sidebar (`components/layout/Sidebar.jsx`) + full-width content area (`components/layout/AppShell.jsx`), collapsing to a bottom tab bar on mobile. `lucide-react` replaced emoji-as-icon usage everywhere except inside Notion select-option data values themselves (`STATUS_COLOR` keys like `'🟢 Warm'` still carry the emoji since that's the literal string written to/read from Notion — icons are looked up separately via `lib/icons.js`'s `statusIconFor()`, not derived from stripping the emoji out of the data). `framer-motion` powers exactly 3 moments: modal open/close (`ui/Modal.jsx`), tab-switch fade (`AppShell.jsx`), and nothing else — deliberately not scattered across hover states.

`App.jsx` was decomposed from ~1836 lines (monolithic, every tab inline) down to ~250 lines (root state/routing only) — every tab is now its own file under `components/`.

## Charts (shipped July 2026)

`recharts` replaced the hand-rolled `<div>` bar/tile charts. All color/mark choices went through this repo's `dataviz` skill (six-check palette validator + form/mark-spec guidance) rather than being eyeballed:
- **Overview → Application Funnel**: real bar chart (`charts/BarChart.jsx`) + new stage-to-stage conversion % annotation (e.g. "Applied → Phone Screen: 18%"). Uses a single flat accent hue, not a per-stage ramp — axis position already encodes stage order, and no 6-step slice of the `accent` scale cleared the ordinal validator's lightness/contrast checks against the light canvas at that count (see `charts/theme.js`'s comments for the actual validator runs).
- **Overview → Network by Status**: donut chart (`charts/DonutChart.jsx`) replacing the colored-tile grid, fed by `STATUS_CHART_COLORS` in `charts/theme.js`. Always paired with a visible count legend (not hover-only) — required relief for a contrast WARN the validator flagged on two of the five status colors against the canvas.
- **Overview → Networking Activity**: new "interactions over time" trend (`charts/TrendChart.jsx`), trailing-10-week bucket of `interactions` data — a signal that had **zero visualization anywhere before this**. Requires `interactions` passed into `OverviewTab` from `App.jsx`.
- **Job Boards → Top Locations**: real horizontal bar chart, direct swap for the old manual-width `<div>` bars.
- **Pipeline**: deliberately no new chart — a Triage-bucket donut would mostly restate the Overview funnel (Triage and Stage are correlated).

## Google Calendar Integration (shipped July 2026)

**"+ Event"** button in the sidebar footer (desktop) / floating button above the mobile bottom bar → `AddToCalendarModal.jsx`: paste a screenshot (⌘V or file upload) and/or text → client-side downscale to ~1568px longest side + JPEG re-encode (canvas) → Claude Sonnet vision extraction (`image` + `text` content blocks in one Messages API call — `api/claude-api.js` needed zero changes, it's already a generic JSON passthrough) → editable review form (title/date/start/end/location/description) → "+ Create Event" writes directly to Google Calendar via `api/google-calendar.js`.

**One-time setup: done** (local dev) — see Pending Setup for the one remaining step (Vercel env vars for production). Verified fully end-to-end: real screenshot → Claude vision extraction → review form → actual event created on the live Google Calendar (and deleted again), both via a direct API call and via the app's own dev proxy path.

Gotcha hit during setup: the OAuth consent screen is in **Testing** mode, which means Google blocks anyone not explicitly added as a **Test user** with `Error 403: access_denied`, even the account that owns the Cloud project — add every Google account that needs to use "+ Event" under OAuth consent screen → Test users. Separately, `get-refresh-token.js`'s local callback server picked port 8765 initially, which collided with an unrelated process already listening on that port on this Mac (IPv4-only), causing Google's redirect to hit the wrong server with a generic 404 — moved to port 8901 to fix. If this happens again on a different machine, pick any free port.

Architecture note: unlike `api/notion.js`/`api/claude-api.js` (static bearer token injection), Google's API needs a short-lived access token minted from the refresh token on **every request** — so `api/google-calendar.js` does two upstream fetches (mint, then forward), and the dev-mode equivalent couldn't use Vite's built-in `server.proxy` (static header injection only) — see the custom `googleCalendarDevProxy` middleware in `vite.config.js`.

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

### Tabs (6 top-level — see Networking Tracker below)
- **Overview** — Notion contacts needing follow-up, application stats, amber "N jobs need review" nudge, staggered KPI-card reveal on mount
- **Network** — Contact CRM from Contacts DB. View modes via a segmented control: **Table** (`ContactsTable.jsx`, `@tanstack/react-table`, default), **Cards**, **Graph** (`NetworkGraphTab.jsx`, `react-force-graph-2d` — force-directed graph of contacts colored by Status + companies derived from the Company field, "Referred By" edges), **Keep in Touch** (`KeepInTouchTab.jsx` — reconnect cadence; see its own section below), **Coverage** (`ReferralCoverageTab.jsx` — target-company gaps), and **Discover** (`DiscoverTab.jsx` — people discovery; see its own section below). The top-level **"+ Contact"** button opens `QuickAddContactModal.jsx` (fast auto-enriched add; see below); **editing** an existing contact still uses `ContactDetailModal.jsx` (Status, Urgency, Referred By, Follow-Up Date, plus a "+ Log" affordance that opens `LogInteractionModal.jsx` pre-filled with that contact). Top-level "+ Log Interaction" button opens the same modal unfilled. Every contact shows an expandable interaction History panel from the Interactions DB.
- **Explore** — Company finder (`ExploreTab.jsx`): onboarding → interest-ranked companies → add to targets (see its own section below)
- **Pipeline** — Application tracker from Applications DB, stage funnel, `DuplicatesPanel` (see below)
- **Actions** — Overdue follow-ups, stale applications, high-urgency contacts
- **Job Boards** — GitHub job board parser (paste repo URL → parse README tables), auto-import, triage buckets, calendar/stats views

### Networking Tracker — unified logging (Stage 7 consolidation, July 2026)
What used to be 3 separate top-level tabs (Graph, LinkedIn, Calls) plus a Quick Log modal are now one place: **Network**. `LogInteractionModal.jsx` replaced `LinkedInTab.jsx` + `QuickLogModal.jsx` + the old `CallsTab` (all deleted) with a single modal and a channel selector — **Call / LinkedIn / Meeting / Email / Other**:
- **Call** and **LinkedIn**: paste-box + "Extract with Claude" (same extraction prompts as the old separate tabs). Call additionally shows Key Insights/My Commitments/Follow-Up Draft fields and writes to **both** the Calls DB (`addCallEntry`) and the Interactions DB — the original `CallsTab` only wrote Calls DB and never logged to Interactions, which was an inconsistency with the Interactions DB's own documented purpose ("every call... gets one row here"); the unified modal fixes that gap.
- **Meeting / Email / Other**: no transcript step, just contact/date/duration/notes → Interactions DB only.
- LinkedIn logging remains deliberately manual — no scraping/automation tooling (real LinkedIn account-ban risk for automated message capture).

### Quick Add — one-tap contact enrichment (Network → "+ Contact"; shipped July 2026)
The fast "add someone I already know" path — the old New-Contact form captured only 4 fields (name/company/role/email) and silently dropped the other 15+. Now you type just **name + where they work + what they do**, hit **✨ Auto-fill & review**, and `lib/enrichment.js` fills in the rest:
- **Web enrich** (`enrichContact()`): one Exa public-web search + one Claude Haiku extraction → LinkedIn URL, cleaned role, a plain-English "what they do" descriptor, school, past employers, location. This is the mirror of Discover's `discoverPeople()` (same Exa+Claude pipeline, same compliance boundary — never fetches linkedin.com directly) but pointed at one named person instead of sourcing strangers. **Fail-soft**: a missing EXA/ANTHROPIC key or empty result degrades to a Claude-only descriptor cleanup, then to the raw typed values — the add never blocks.
- **"How they fit"** (deterministic, no extra tokens): reuses `discovery.js`'s `affinityTagsFor()` for shared-background tags (UMich alum, shared employer, hometown), flags whether they're at a `rec_target_companies` **target company**, and surfaces who else you already know there (via `normalizeCompanyName`) — which also seeds the optional "did one of them introduce you?" (Referred By) dropdown.
- **One-tap-review save flow**: enrichment renders an editable review card (web-sourced fields are honestly labeled), you glance and hit **+ Add to network**. Writes via the DiscoverTab pattern (`addContact` minimal row → `updateContact` with linkedin/affinity/isUMichAlum/notes/referredBy/**Exa Enriched**). Dedups on `searchContactByName` first.

### Keep in Touch — reconnect cadence (Network → Keep in Touch view; shipped July 2026)
The passive "who am I drifting out of touch with?" layer, distinct from the Follow-Up Date/Actions system (which owns *explicit* post-interaction to-dos). `lib/keepInTouch.js` computes a reconnect cadence per contact **purely from existing fields — zero Notion migration**: `tieStrengthBucket` (from `affinity.js`) × a `DEFAULT_CADENCE` policy (inverted-U aware — *moderate* ties get the tightest 30d interval, not the strong ties you already talk to constantly). `keepInTouchQueue()` surfaces contacts due/overdue by `Last Interaction + cadence`, **excluding** anyone with a future explicit Follow-Up Date (they already have a plan in Actions, so no double-nag) and Closed relationships. `KeepInTouchTab.jsx` shows each person's **last point of contact** (type/date/summary from the Interactions DB), days overdue, tie strength, and a one-tap **Log** (opens `LogInteractionModal` pre-filled) or click-through to the detail modal.

### Discover — people discovery (Network → Discover view; shipped July 2026)
A **view inside the Network tab** (segmented control, next to Coverage — not a top-level tab). Finds *new* people to reach out to at target companies, ranked by warm-tie signals from Ethan's résumé + reachability. Complements Coverage (which only flags *whether* a gap exists) by actually sourcing the people to close it. Uses the **same** `rec_target_companies` list as Coverage.

**Data source — compliance boundary (important):** all people come from **Exa's public-web search index** (`app/src/lib/exa.js` → `/exa` proxy → `api.exa.ai`). This is a search engine over the open web — it never scrapes or logs into LinkedIn. LinkedIn URLs it surfaces are treated as **reference links only** (the app links out, never programmatically fetches linkedin.com). This is the deliberate extension of the "no LinkedIn scraping/automation" stance above. `EXA_API_KEY` is server-side only (Vercel env + `.env`), like every other key.

**Hands-off scheduler (`lib/discoveryScheduler.js`):** the default **✨ Recommended** view auto-refreshes in the background — on mount, if `rec_discovery_meta.lastCheck !== today`, it silently runs discovery for the highest-priority *due* companies and shows a "N new people found" nudge. `dueCompanies()` picks them: coverage `gap`/`weak` only (never `strong`), **applied-to companies first** (matched against the Applications DB), filtered by a per-company **cooldown** (default 7d) and capped at a **daily budget** (default 3) — both editable in the ⚙ settings. A manual **↻ Refresh now** forces a full re-scan (ignores cooldown/budget). Concurrency-limited to 3.

**Token minimization (first-class):** the daily *check* is a cheap date compare; real Exa/Claude spend is throttled by cooldown + budget. Biggest saver: `discoverPeople()` hashes the Exa result URLs (`hashUrls`) and **skips the Claude extraction entirely when the same pages come back** (`skippedExtraction`, reusing cached people). It also drops `knownUrls` (profile URLs already in Contacts) before extraction so tokens aren't spent re-structuring people you already have. Typical steady state: 0–3 Exa searches/day (~2¢), often zero Claude calls.

**Ranking (`lib/discovery.js` `discoveryScore()`):** a **pre-contact** scorer (affinity.js can't rank strangers: no interaction history → everyone buckets cold/0). Scores résumé-signal overlap (user-weighted: past employer > program > university > hometown), reachability × relevance (reachable ICs/recruiters up, VPs down), and **"next best person"** coverage (first contact at a gap company, or a *different-role* person where you already know someone — name-dedup sinks people already in Contacts). The Recommended list breaks score ties toward applied-to companies.

**UI (`components/DiscoverTab.jsx`):** collapsible **background-signals profile** editor (`rec_affinity_profile`, seeded with UMich), the **✨ Recommended** ranked list (across all companies) as default, plus a **By company** view with a per-company "Find people" manual override. Discovered people are a **staging queue** (`rec_discovered`) — nothing hits Notion until **+ Add to Contacts** (dedups via `searchContactByName`, then `addContact` + `updateContact` writing `linkedin`/`Notable Affinity`/`Is UMich Alum`, status Cold). **✎ Draft intro** reuses `lib/drafting.js`'s `draftMessage` (`kind:"cold_open"`, personalization seeded from matched signals). Dismissed/added candidates persist so refreshes don't resurface them. localStorage keys: `rec_discovered`, `rec_discovered_dismissed`, `rec_discovered_added`, `rec_discovery_meta`, `rec_discovery_settings`, `rec_affinity_profile`.

### Explore — company finder (top-level tab; shipped July 2026)
Top of the funnel: learns Ethan's interests via onboarding, recommends companies he'd like, and — one click — adds them to `rec_target_companies`, so **Coverage** shows the gap and **Discover** finds people there. Funnel: *interests → companies → target list → people*.

**Onboarding (`components/CompanyOnboarding.jsx`):** research-backed ~6 skippable questions stored in `rec_company_prefs`. The anchor is example-based seeding — "companies you already love" (YC autocomplete) — since revealed ≫ stated preference. Prefills from the Job Boards `rec_prefs` (`prefsFromRecPrefs`). Fields: seed companies, domains (≤3), SWE↔PM lean, stage, top-2 priorities, location + work style, free-text extras.

**Data + ranking:**
- **`lib/ycDirectory.js`** — free public YC directory (`yc-oss.github.io/api`, no auth, CORS-open, direct browser fetch, in-memory session cache). `/companies/top.json` powers seed-company autocomplete + a structured candidate pool filtered by domain (`DOMAIN_TAGSETS`) and stage (team-size bands). Degrades gracefully offline (Exa still covers).
- **`lib/exa.js`** — `exaSearch` generalized with a `category` param; `companySearch` (category `company`, same URL-hash **skip** token-saver as people) + `exaFindSimilar` (powers 🔎 More like this).
- **`lib/companyFinder.js`** — `buildCompanyQuery(prefs)` (descriptive neural query); `mergeCandidates` (YC + Exa, dedup by `normalizeCompanyName`, exclude companies already in targets/Applications); one Claude Haiku **ranking call** (mirrors `generateJobAnalysis`) that returns `[{name,website,oneLiner,whyFit,fitScore,domain,stage,badges}]` and deliberately **re-injects the signals students under-weight** (mentorship, return-offer reputation, domain interest) rather than the prestige/pay they over-weight.

**UI (`components/ExploreTab.jsx`):** onboarding gate → ranked **company cards** (fit score, why-you, domain/stage/badges, website). **❤ Add to targets** writes `rec_target_companies` (dedup) → then the button becomes **Find people →** (deep-links to Network → Discover via `onFindPeople`). **🔎 More like this** (`findSimilar`), **✕ Dismiss** (persisted). **Hands-off** like Discover: daily `lastCheck` gate + URL-hash skip (zero Claude tokens when unchanged) + manual ↻ Refresh; nudge "N companies match you." A lazy, best-effort **GitHub eng-signal badge** (`GhBadge`) resolves a company's org from its domain and shows a public-repo count **only when it can confirm the org belongs to the company** (blog/name match) — hidden when unsure, to avoid asserting wrong data. localStorage keys: `rec_company_prefs`, `rec_company_results`, `rec_company_meta`, `rec_company_added`, `rec_company_dismissed`.

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
/notion          → api.notion.com              (injects NOTION_API_KEY)
/gh-api          → api.github.com              (injects optional GITHUB_TOKEN)
/gh-contrib      → github-contributions-api.jogruber.de
/claude-api      → api.anthropic.com           (injects ANTHROPIC_API_KEY; strips incoming Origin/Referer — see Known Issues)
/google-calendar → www.googleapis.com          (mints an access token from GOOGLE_REFRESH_TOKEN first, then forwards)
/exa             → api.exa.ai                  (injects EXA_API_KEY; strips Origin/Referer like /claude-api — see People Discovery below)
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

## Known Issues

- **"Notion connection error: Could not find database with ID..."** — the API key is valid (resolves fine against `/v1/users/me`) but the specific databases are no longer shared with the integration, most likely from a key rotation or workspace change during the public-release prep. Fix (manual, in Notion, not fixable via API): open each database → `•••` → **Connections** → add the "Recruiting OS" integration back. As of this writing this was flagged to the user but not yet confirmed fixed.
- **Claude API calls from the browser in dev mode can fail with `"CORS requests must set 'anthropic-dangerous-direct-browser-access' header"`** — Vite's `server.proxy` forwards the browser's `Origin`/`Referer` headers through to Anthropic by default, which Anthropic's API treats as a direct-browser-access attempt and rejects, even though the call is genuinely server-to-server (the proxy injects the key, the browser never sees it). Fixed in `vite.config.js`'s `/claude-api` proxy entry via a `configure` hook that strips both headers before forwarding. Production's `api/claude-api.js` never had this problem — it builds a fresh headers object rather than forwarding the incoming request's headers. If a *new* proxied endpoint is added that calls an API sensitive to Origin, apply the same fix.

## Pending Setup (one-time)

- **Re-share Notion databases with the integration** (see Known Issues above) — needed for the app to function at all right now.
- Deploy Google Apps Script email pipeline (script.google.com)
- Download Granola + connect Google Calendar
- Install LeetNotion VS Code extension for LC → Notion sync
- **Discover tab:** add `EXA_API_KEY` to the root `.env` (dev proxy loads env from repo root) and to Vercel's encrypted env vars (prod). Get it at https://dashboard.exa.ai/api-keys. Without it, "Find people" 401s.

**Done:** Google Calendar OAuth (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN` are in `.env` — Cloud Console project is `recruitingos`; OAuth consent screen is in Testing mode, so **only the Google account added as a test user can authorize this app** — `ethansaba12@gmail.com` is added; add any other account there too before it can use "+ Event"). Verified end-to-end: created and deleted a real Calendar event both via a direct API call and via the dev-mode `/google-calendar` proxy. **Still needed for production**: add the same 3 env vars to Vercel's encrypted env vars, or the deployed app's "+ Event" won't be able to create events (only local dev works right now).

Not yet built: mobile quick-capture generalized across both action modals (the "+ Event" floating button pattern now exists in `Sidebar.jsx` — extending the same affordance to `LogInteractionModal` is now cheap), weekly stale-contact digest (Apps Script time trigger), "looks cold" decay badge, warm-intro path finder.

## Features Researched — Next to Build

Priority order (Fall 2026 apps open in ~4 weeks):

1. **SimplifyJobs live feed** — parse `SimplifyJobs/Summer2026-Internships` daily via GitHub raw API (better source than speedyapply)
2. **LeetCode company panel** — fetch free CSV from `snehasishroy/leetcode-companywise-interview-questions`, show top 10 questions per company in application card
3. **Cold outreach drafter** — contact name + company + context → Claude writes personalized LinkedIn DM / email
4. **Referral coverage map** — cross-reference contacts vs target company list, surface gaps. Now cheaper to build: the Graph tab's company-grouping logic (`NetworkGraphTab.jsx`) is most of what this needs.
5. **Job fit scorer** — paste JD → Claude scores 1-10 fit + top gaps

Key insight from research: referrals are 2-3x more likely to convert than cold apps. Building the referral coverage map + outreach drafter together is the highest-ROI work before August.
