# Recruiting Intelligence System — Claude Context

## What This Repo Is
A zero-touch recruiting OS for a student's SWE/PM internship search. Calls, emails, and job applications flow into a per-user Supabase Postgres store automatically. A React dashboard is the primary interface. Multi-tenant since 2026-07-23 — anyone can sign up, bring their own Anthropic/OpenAI/Exa/GitHub API keys, and get their own isolated account (see Multi-Tenant Auth + BYOK below); the original single-tenant version stored everything in one shared Notion workspace, which is now legacy (kept only for the one-time migration path).

> Personal profile and real deployment identifiers live in `CLAUDE.local.md` (gitignored), not in this file.

---

## Actual Stack (as of July 2026)

| Tool | Role | Status |
|---|---|---|
| React + Vite | Dashboard — dev at localhost:3001, deployable to Vercel | ✅ |
| Vercel | Hosting — auto-deploys `main` branch via GitHub integration | ✅ |
| GitHub | Source + Vercel deploy trigger | ✅ |
| Google Apps Script | Email pipeline (Gmail → Claude → Supabase) | ✅ Built, needs deploy |
| Supabase (Postgres + Auth) | Multi-tenant data store + auth (email/password, Google OAuth) + BYOK key/token vault — see Multi-Tenant Auth + BYOK below | ✅ Live (local dev stack via `supabase start`; needs a real project linked for production) |
| Claude API (Haiku 4.5 + Sonnet vision) | **Default** provider for every text-only AI call app-wide, plus screenshot→calendar-event extraction (always Claude regardless of the switch) — see AI Provider Switch below | ✅ Wired via serverless proxy · BYOK (per-user key in Settings) |
| OpenAI API (GPT-5.1 / GPT-5.1-mini) | Drop-in alternate provider for every text-only AI call — flip `VITE_AI_PROVIDER=openai` to switch, see AI Provider Switch below | ✅ Wired via serverless proxy (`/openai-api`) · BYOK |
| Notion | **Legacy** — original single-tenant hub (5 databases). No longer read/written by the deployed app; only used by `scripts/migrate-notion-to-supabase.js` for a one-time pull into a new Supabase account | 🗄️ Migration-only |
| Recharts | Overview/Job Boards charts (funnel, donut, trend, top-locations bar) | ✅ Live |
| Google Calendar API | Screenshot/text → calendar event, via per-user OAuth (Settings → "Connect Calendar") | ✅ Live in dev and production |
| Granola | Call transcription (no bot) | 🔄 Download + connect |
| LeetNotion extension | LeetCode → Notion auto-sync | 🔄 Pending install (still Notion-only; not yet ported to Supabase) |
| Exa | People discovery (Discover) + company discovery (Explore) + Job Boards deadline extraction — public-web search & page-content fetch | ✅ Wired via serverless proxy · BYOK |
| YC directory (yc-oss/api) | Free public company data (Explore tab candidate pool + autocomplete) | ✅ Direct client fetch, no auth |

**Abandoned:** Gumloop (BYOK requires $37/mo Pro plan), Cowork/Claude Desktop scheduled tasks

## AI Provider Switch (shipped 2026-07-22, defaults flipped 2026-07-23)

Both Claude and OpenAI are fully wired for every text-only AI call in the app (job blurbs/fit analysis, deadline extraction, contact enrichment, company ranking, call/email/LinkedIn extraction, timeline scanning, drafting) — `lib/ai.js` is the single switch between them, so which provider is active is a **one-line env change, not a code change**.

- **Default: Claude** (`CLAUDE_MODELS.HAIKU`/`SONNET`, via `lib/claude.js` + `/claude-api`).
- **To switch to OpenAI:** set `VITE_AI_PROVIDER=openai` in the root `.env` (repo root — same place `NOTION_API_KEY` etc. live) and restart the dev server; for production, set the same var in Vercel's env vars and redeploy (Vite inlines `import.meta.env.VITE_*` at *build* time, so a live env-var change alone won't flip it without a rebuild). Needs `OPENAI_API_KEY` set either way it's used.
- Every call site imports `aiJSON`/`aiText`/`AI_MODELS` from `lib/ai.js` (never `lib/claude.js`/`lib/openai.js` directly, except `lib/ai.js` itself) and uses provider-agnostic tiers — `AI_MODELS.MINI` (cheap/fast structured extraction) and `AI_MODELS.STANDARD` (heavier judgment calls: company ranking, call/email extraction) — which resolve to the right underlying model name for whichever provider is active. UI copy that names the provider (e.g. "Analyzing with Claude...") reads `AI_PROVIDER_LABEL` from the same file rather than hardcoding either name, so it never goes stale when the switch flips.
- **Vision stays on Claude regardless of the switch** — `AddToCalendarModal`'s screenshot→event extraction always calls `lib/claude.js`'s Sonnet vision directly, never through `lib/ai.js`. Anthropic's and OpenAI's image content-block formats differ enough that swapping it untested would carry real regression risk with no way to verify output quality without a live screenshot; every other call site is plain text→JSON, so routing those through the switch was low-risk.
- `lib/openai.js` mirrors `lib/claude.js`'s exact shape (`openaiJSON`/`openaiText`, same `{model, content, maxTokens}` signature, shared `parseJSONLoose` salvage logic from `claude.js`) — that symmetry is what makes `lib/ai.js`'s dispatch a two-line `if`. GPT-5.1's chat completions endpoint uses `max_completion_tokens` (not the deprecated `max_tokens`) and `response_format:{type:'json_object'}` for JSON mode — see `api/openai.js` + the `/openai-api` proxy entries in `vite.config.js`/`vercel.json`, which mirror `/claude-api`'s pattern exactly (flat-file `?path=` proxy, fresh headers server-side, browser Origin/Referer stripped in dev).

---

## Multi-Tenant Auth + BYOK (shipped 2026-07-23)

The app moved from single-tenant (one shared Notion workspace + global API keys) to fully multi-tenant: anyone can sign up, gets their own isolated data + BYOK keys, and nobody's keys or data are ever visible to another account. This was the biggest architectural change since the original build — it touched auth, the entire data layer, every AI/search/GitHub/Calendar proxy, and localStorage.

**Auth (`lib/supabaseClient.js`, `lib/AuthContext.jsx`, `components/LoginPage.jsx`):** Supabase Auth, email/password + Google OAuth. `AuthProvider` wraps the whole app (`main.jsx`); `App.jsx`'s `AuthGate` renders `LoginPage` when unauthenticated, the real app (`AppInner`) once signed in. `authHeader()` (in `supabaseClient.js`) attaches the current session's JWT to every same-origin proxy call — every AI/search/GitHub/Calendar call site (`lib/claude.js`, `lib/openai.js`, `lib/exa.js`, `github.js`, `googleCalendar.js`) was updated to call it.

**Data layer (`src/db.js` replaces `src/notion.js`):** every table (`contacts`, `applications`, `calls`, `interactions`) now lives in Supabase Postgres, scoped by `user_id` with Row Level Security policies (`auth.uid() = user_id`) enforced **in Postgres itself**, not just in application code — so even a bug in `db.js` couldn't leak one user's rows to another. `db.js` keeps the exact same exported function names/signatures/shapes as the old `notion.js` (camelCase JS ↔ snake_case columns mapped internally), so every component that imported it needed zero changes beyond the import path. Schema + RLS policies live in `supabase/migrations/*.sql`.

**BYOK (`api/keys.js`, `api/_lib/keys.js`, `components/SettingsTab.jsx`):** Anthropic/OpenAI/Exa/GitHub keys are added per-user in Settings, AES-256-GCM encrypted (`api/_lib/crypto.js`, key from `SECRET_ENCRYPTION_KEY`) and stored in `user_api_keys` — a table with **zero client-facing RLS policies**, so the browser can never read them even with a valid session; only server code holding the service-role key (`api/_lib/supabaseAdmin.js`'s `supabaseAdmin()`) can decrypt them, and only after `requireUser(req)` verifies the caller's own JWT. Every proxy (`api/claude-api.js`, `api/openai.js`, `api/exa.js`, `api/gh-api.js`) now: (1) calls `requireUser(req)`, 401s if not signed in; (2) calls `getUserKey(user.id, provider)`, 400s with a friendly "add your key in Settings" message if missing (GitHub is the one exception — falls back to unauthenticated GitHub API at the lower rate limit rather than blocking, since a token there is a nice-to-have not a requirement). `api/notion.js` (the old global-key proxy) was **deleted** along with its `vercel.json` rewrite — it was dead code post-migration but still reachable and unauthenticated, meaning any visitor to the deployed site could have hit `/notion/*` and used *your* personal Notion integration token. Caught and fixed during the multi-tenant work; if you're auditing a fork for the same issue, the pattern to check for is any proxy route that does NOT call `requireUser()`.

**Per-user Google Calendar (`api/google-connect.js`, `lib/googleAuth.js`):** the OAuth *client* (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) stays one shared app-level credential — that's normal, same as any OAuth app — but the *consent* (refresh token) is now per-user: Settings → "Connect Calendar" runs a real OAuth redirect (`access_type=offline&prompt=consent`, scope `calendar.events`), and `api/google-connect.js` encrypts + stores the resulting refresh token in `google_calendar_tokens` (also zero client-facing RLS, same pattern as `user_api_keys`). `api/google-calendar.js` looks up *that* user's token on every request rather than reading one global env var — this also resolves the old single-tenant 7-day-refresh-token-expiry footgun documented under Google Calendar Integration below, since each user manages their own connection now (a user's token still expires per Google's Testing-mode 7-day cap until the OAuth consent screen is published to Production — same underlying Google constraint, just no longer a single point of failure for every user at once).

**Vite dev parity (`vite.config.js`):** the old static `server.proxy` config (header injection only) couldn't do "verify JWT, then look up a per-user key" — so it was replaced with `mountApiHandler()`, a middleware that imports and runs the actual `api/*.js` handler functions directly inside the Vite dev server. Dev and prod now share **one code path** for every proxy, not two that can drift.

**localStorage namespacing (`lib/scopedStorage.js`):** every `rec_*` preference/cache key (target companies, discovery queue, job board prefs, tracked boards, etc.) is prefixed with the signed-in user's id via `lsGet`/`lsSet`, so two accounts sharing one browser never see each other's cached state. `AuthContext.jsx` calls `setStorageUserId()` on every auth change. This is per-browser caching only, not cross-device sync — same limitation the single-tenant app already had.

**De-hardcoded profile assumptions:** `lib/discovery.js`'s `DEFAULT_PROFILE` and `lib/companyFinder.js`'s ranking prompt no longer bake in one person's school/grad-year/background — they read from the signed-in user's `profiles` row (editable in Settings) instead. `Sidebar.jsx`'s "Fall 2026" subtitle is gone for the same reason (see Public Demo Route below for what replaced it in demo mode).

**Migrating existing Notion data (`scripts/migrate-notion-to-supabase.js`):** a one-time Node script — `node scripts/migrate-notion-to-supabase.js you@example.com` — that looks up an already-signed-up Supabase user by email, pulls every row from the four legacy Notion DBs via the Notion API, and inserts them under that user's `user_id`. Idempotent (wipes + re-inserts just that user's rows each run, so re-running after fixing a Notion field is safe). Requires `NOTION_API_KEY` + the four `*_DB_ID` vars in `.env` (only needed for this one script now) plus `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`. Verified end-to-end 2026-07-23 for the real account: 8 contacts, 229 applications, 3 interactions migrated and confirmed readable through RLS as that signed-in user (not just via the service-role key).

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
    App.jsx                 ← Root App() — routes to DemoApp (/demo) or AuthGate→AppInner + NetworkTab (Table/Cards/Graph view switch)
    db.js                    ← Multi-tenant Supabase data layer (replaces notion.js) — same fetch*/add*/update* names/shapes, RLS-scoped by user_id, + isDemoMode() branch for /demo
    demoData.js              ← Fictional seed data for the public /demo route (see db.js's isDemoMode())
    index.css                ← Tailwind v4 entry (`@import "tailwindcss"`) + @theme design tokens (fonts/colors)
    shared.jsx               ← Business-logic consts (STATUS_COLOR, STAGE_COLOR, isUntriaged, findDuplicateGroups, etc.) + re-exports Badge/EmptyState from components/ui/
    lib/
      cn.js                   ← clsx + tailwind-merge className helper used by every ui/ primitive
      icons.js                ← emoji → lucide-react icon lookup maps (STATUS_ICON, BUCKET_ICON, NAV_ICON, etc.)
      ai.js                    ← Provider switch — every text-only AI call site imports aiJSON/aiText/AI_MODELS from here, never openai.js/claude.js directly (see AI Provider Switch below)
      openai.js                ← GPT client (`/openai-api` proxy) — used when VITE_AI_PROVIDER=openai
      claude.js                ← Claude client (`/claude-api` proxy) — default provider, and always used directly (bypassing ai.js) for AddToCalendarModal's vision call
      deadlines.js             ← Job Boards real deadline extraction: Exa `/contents` (fetch the actual apply page) → AI reads it for a stated close-date
      supabaseClient.js        ← Client-side Supabase client + authHeader() (attaches the session JWT to every proxy call — see Multi-Tenant Auth + BYOK)
      AuthContext.jsx          ← React context for auth state; calls scopedStorage's setStorageUserId() on every auth change
      googleAuth.js            ← Client-side Google OAuth: signInWithGoogle() + per-user Calendar connect/finish flow
      scopedStorage.js         ← lsGet/lsSet — namespaces every rec_* localStorage key by user id
    components/
      ui/                      ← Hand-rolled shadcn-shaped primitives: Button, Modal (framer-motion transition), Badge, Card, Tabs, Input, Select, EmptyState
      layout/                  ← Sidebar.jsx (dark nav rail + mobile bottom bar + "+ Event" quick action + demoMode variant), AppShell.jsx (shell + tab-switch motion + demo banner)
      charts/                  ← Recharts wrappers: theme.js (design-token → hex translation), ChartTooltip.jsx, BarChart.jsx (vertical/horizontal), DonutChart.jsx, TrendChart.jsx — presentation-only, no data fetching
      jobBoards/               ← GitHubTab, RepoJobsView, JobCard, JobDetailModal, RepoStats, PreferencesPanel, CalendarView, UserProfileView, ContributionGrid, helpers.js, boardsRegistry.js, TrackedBoardsPanel.jsx, useJobDeadlines.js
      OverviewTab.jsx, PipelineTab.jsx (+DuplicatesPanel), ActionsTab.jsx
      ContactDetailModal.jsx, ContactsTable.jsx, NetworkGraphTab.jsx
      LogInteractionModal.jsx  ← Unified Call/LinkedIn/Meeting/Email/Other logging (see Networking Tracker below)
      AddToCalendarModal.jsx   ← Screenshot/text → Google Calendar event (see Google Calendar Integration below)
      LoginPage.jsx            ← Sign in / sign up — email+password and "Continue with Google"
      SettingsTab.jsx          ← BYOK key management (Anthropic/OpenAI/Exa/GitHub), profile fields, Connect Google Calendar
    github.js                ← GitHub job board parser
  api/                       ← Vercel serverless functions (production auth + key injection)
    _lib/
      supabaseAdmin.js         ← Service-role Supabase client (bypasses RLS, server-only) + requireUser(req) (verifies the caller's JWT)
      crypto.js                ← AES-256-GCM encrypt/decrypt for BYOK keys + Google refresh tokens
      keys.js                  ← getUserKey(userId, provider) — decrypts one user's stored key for server-side use inside a proxy handler
    keys.js                  ← Authenticated CRUD for BYOK keys (GET/POST/DELETE /api/keys) — never exposes decrypted keys, only last4
    google-connect.js        ← Persists a per-user Google Calendar refresh token after the OAuth consent redirect
    gh-api.js                ← Proxies api.github.com — requireUser() + optional per-user GITHUB_TOKEN (falls back to unauthenticated GitHub API if not set)
    gh-contrib.js             ← Proxies github-contributions-api.jogruber.de (public, no key, no auth gate needed)
    claude-api.js             ← Proxies api.anthropic.com — requireUser() + per-user Anthropic key (builds a fresh headers object — never forwards the browser's Origin, see Known Issues) — default provider (lib/ai.js) + always used directly for AddToCalendarModal's vision call
    openai.js                 ← Proxies api.openai.com the same way — used instead of claude-api.js for every text-only call when VITE_AI_PROVIDER=openai (see AI Provider Switch)
    exa.js                    ← Proxies api.exa.ai — requireUser() + per-user Exa key
    google-calendar.js        ← requireUser() → looks up THAT user's refresh token (google_calendar_tokens) → mints an access token → forwards to the Calendar API
    (api/notion.js deleted 2026-07-23 — was dead, unauthenticated, and proxied through one global Notion key; see Multi-Tenant Auth + BYOK)
  vercel.json                ← Rewrites /gh-api, /gh-contrib, /claude-api, /openai-api, /google-calendar, /exa → api/*
  vite.config.js            ← mountApiHandler() middleware runs the real api/*.js handlers directly in dev (see Multi-Tenant Auth + BYOK) + `@tailwindcss/vite` plugin
supabase/
  migrations/*.sql            ← Schema + RLS policies: profiles, contacts, calls, applications, interactions, user_api_keys, google_calendar_tokens, user_settings
  config.toml                 ← Local stack config, incl. Google OAuth provider settings
scripts/
  email-pipeline.js         ← Google Apps Script (deploy to script.google.com)
  migrate-notion-to-supabase.js ← One-time: pull an existing Notion workspace into a Supabase account (see Multi-Tenant Auth + BYOK)
notion/                     ← Legacy — kept only for the migration script above
  schema.md                 ← DB schema reference (source of truth for the migration script's field mapping)
  setup.js / patch-dbs.js    ← One-off scripts that created/patched the original 4 DBs
  add-interactions-db.js     ← One-off script that created the Interactions DB + Contacts.Referred By self-relation
  add-triage-fields.js       ← One-off script that added Triage/Location/Source Repo to Applications DB
google-calendar/
  get-refresh-token.js      ← Legacy single-tenant OAuth script — superseded by Settings → "Connect Calendar" (per-user, in-app) for any new account
plans/                      ← Phase plans (mostly outdated — see below)
prompts/                    ← Claude prompts
context.md                  ← Gitignored, untracked — Notion/Anthropic IDs for reference
.env                        ← Gitignored — Supabase + Google OAuth app creds + legacy Notion migration vars (BYOK keys live in Supabase now, not here)
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

**One-time setup: done**, both local dev and Vercel production. Verified fully end-to-end: real screenshot → Claude vision extraction → review form → actual event created on the live Google Calendar (and deleted again), both via a direct API call and via the app's own dev proxy path, and again against the deployed site (see 2026-07-17 outage below).

Gotcha hit during setup: the OAuth consent screen is in **Testing** mode, which means Google blocks anyone not explicitly added as a **Test user** with `Error 403: access_denied`, even the account that owns the Cloud project — add every Google account that needs to use "+ Event" under OAuth consent screen → Test users. Separately, `get-refresh-token.js`'s local callback server picked port 8765 initially, which collided with an unrelated process already listening on that port on this Mac (IPv4-only), causing Google's redirect to hit the wrong server with a generic 404 — moved to port 8901 to fix. If this happens again on a different machine, pick any free port.

**Outage + fix (2026-07-17):** "+ Event" was broken on the deployed site (worked in local dev). Two compounding causes: (1) `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN` had only ever been added to local `.env`, never to Vercel — `vercel env ls production` showed only `NOTION_API_KEY`/`ANTHROPIC_API_KEY`/`EXA_API_KEY`, so `api/google-calendar.js`'s `getAccessToken()` was refreshing with `undefined` credentials; (2) independently, the stored refresh token itself had expired (`invalid_grant`), because the consent screen is still in **Testing** mode — Google caps refresh tokens at 7 days for Testing-mode apps, regardless of use. Fixed by adding the 3 vars to Vercel production (`vercel env add ... production`, run from `app/` where the project is linked — running from the repo root fails with a doubled path, since Vercel's dashboard "Root Directory" setting is `app` and gets appended to cwd) and re-running `get-refresh-token.js` for a fresh token, then redeploying (`vercel --prod`, needs the same directory-root gotcha handled — either run from `app/` and expect an error, or temporarily mirror `app/.vercel/` to the repo root so cwd + Root Directory resolve correctly together).

**Known recurrence risk:** as long as the consent screen stays in Testing mode, this refresh token will expire again in ~7 days and "+ Event" will silently break on production the same way (local dev is unaffected — token was refreshed manually there too, same expiry risk applies equally to both). **Fix:** publish the OAuth consent screen to Production (Google Cloud Console → APIs & Services → OAuth consent screen → project `recruitingos` → **Publish App**) — removes the 7-day expiry entirely. Tradeoff: since `calendar.events` is a sensitive scope and the app isn't Google-verified, anyone authorizing (including you) will hit a **"Google hasn't verified this app"** interstitial and need to click **Advanced → Go to recruitingos (unsafe)** — acceptable for solo/personal use, not something to push through full verification for. **Not yet done as of 2026-07-17** — flagged, not executed.

**Update (2026-07-23): done, not abandoned.** The multi-tenant build described above as "explicitly decided against" on 2026-07-17 shipped a week later — see Multi-Tenant Auth + BYOK. What changed the calculus: Supabase (Postgres + Auth) covered "real user accounts + sessions" and "a database for per-user OAuth tokens" in one tool without standing up custom infra, and BYOK sidesteps the "whose API keys get charged" question entirely — each user brings their own, so there's no shared-cost problem to solve. Notion's per-user auto-provisioning problem was sidestepped a different way: rather than give every user their own Notion workspace (would've needed a public Notion integration + DB-creation API calls per signup), the data layer moved off Notion entirely onto Supabase Postgres with RLS. The 7-day Testing-mode refresh-token expiry (next paragraph) is now a per-user annoyance instead of a single point of failure for everyone, but the underlying Google constraint is unchanged — publishing the OAuth consent screen to Production still fully resolves it, for every user, whenever it's done.

Architecture note: unlike `api/claude-api.js` (static bearer token injection, now per-user via BYOK), Google's API needs a short-lived access token minted from the refresh token on **every request** — so `api/google-calendar.js` does two upstream fetches (mint, then forward), and the dev-mode equivalent couldn't use Vite's built-in `server.proxy` (static header injection only) — see `mountApiHandler()` in `vite.config.js`, which now runs `api/google-calendar.js`'s real handler directly rather than a bespoke proxy middleware.

## Deployment

- **Vercel project:** root directory set to `app/` (your real project/team IDs are in `CLAUDE.local.md`)
- **GitHub:** Vercel auto-deploys on push to `main`
- **Manual deploy:** `cd app && npx vercel --prod`
- **Global env vars needed in production** (encrypted Vercel env vars, never in the repo or client bundle): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SECRET_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. That's it — `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`EXA_API_KEY`/`GITHUB_TOKEN`/`NOTION_API_KEY` are **not** deployment env vars anymore; the AI/search/GitHub keys are BYOK (per-user, added in Settings) and Notion is migration-script-only (local `.env`, never deployed).
- Deploying against a **real** (non-local) Supabase project requires `supabase link` + `supabase db push` first to apply `supabase/migrations/*.sql`, and adding the production site's URL to that project's Auth → URL Configuration (redirect URLs) for the Google OAuth flows to work.
- Local dev (`npm run dev`) runs the actual `api/*.js` handlers directly via `vite.config.js`'s `mountApiHandler()` middleware; production uses the same files as Vercel serverless functions — **one code path**, not two proxies that can drift (this replaced the old static `server.proxy` config, which couldn't do "verify JWT → look up per-user key").
- Gotcha: Vercel's zero-config catch-all dynamic routes (`api/gh-api/[...path].js`) only match a single path segment and silently 404 on anything deeper — that's why the proxy functions are flat files (`api/gh-api.js`, etc.) with the sub-path passed as a `?path=` query param via `vercel.json` rewrites, not nested dynamic folders

## Public Demo Route (`/demo`, shipped 2026-07-23)

`https://<site>/demo` is a portfolio-facing, no-sign-in tour of the app for anonymous visitors:

- **Routing:** no router library — `App.jsx`'s default export checks `window.location.pathname.startsWith('/demo')` and renders `DemoApp()` directly, skipping `AuthGate`/`AuthProvider` entirely. `vercel.json` has a catch-all SPA rewrite (`/((?!api/).*) → /index.html`, placed *last* so it doesn't shadow the existing `/claude-api`, `/exa`, etc. proxy rewrites — Vercel matches rewrites in array order, first match wins) so a hard refresh on `/demo` in production doesn't 404; Vite's dev server does this automatically (`appType: 'spa'` default).
- **Data:** `src/demoData.js` seeds a fictional student's job search (contacts/applications/interactions/calls, dates computed relative to "today" so it never looks stale) in shapes that exactly match `db.js`'s real `fetch*` return shapes. `db.js` itself gained an `isDemoMode()` check (same `/demo` pathname test) at the top of **every** exported function — when true, it reads/writes an in-memory clone of `demoData.js` instead of ever touching Supabase. This is the key design choice: every component that already calls `db.js` (`ContactDetailModal`, `PipelineTab`, `ActionsTab`, `LogInteractionModal`, `QuickAddContactModal`, etc.) works completely unmodified in demo mode — no forked "read-only" components, no props threading. State is module-level (resets on page reload) — deliberate, so one visitor's edits never leak into the next visitor's session.
- **Scope:** only Overview, Network (Table/Cards/Graph views), Pipeline, and Actions are in the demo nav (`DEMO_NAV_ITEMS`/`DEMO_NETWORK_VIEWS` in `App.jsx`, trimmed lists passed into the now-configurable `navItems`/`views` props on `Sidebar.jsx`/`NetworkTab`). Explore, Discover, Outbox, Keep in Touch, Coverage, Job Boards, Calendar, and Settings are excluded because they depend on `requireUser()`-gated proxies (Claude/OpenAI/Exa/GitHub/Google) that would just 401 for an anonymous visitor — rather than ship half-broken AI buttons, those tabs/views aren't shown at all. One known soft edge: `ActionsTab`'s `DraftPanel` (AI follow-up drafting) is still reachable inside the Actions tab and *will* show a 401-flavored error if clicked — it's already fail-soft (inline error, no crash) so this was accepted rather than stripped out.
- **UI:** `AppShell`/`Sidebar` gained a `demoMode` prop — shows an amber "you're viewing a live demo... nothing is saved" banner + "Sign up free →" link (to `/`, where `AuthGate` renders `LoginPage`), swaps the sidebar's "Fall 2026" subtitle for "Live demo · sample data", and hides the "+ Schedule"/"+ Event" quick actions (those need a real Google Calendar OAuth connection, irrelevant with no account).

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

**Overhauled 2026-07-22** in response to direct feedback that the existing GitHub-poll-style boards weren't good enough: the parser silently returned **zero jobs** from SimplifyJobs/Summer2026-Internships (the single biggest board — it renders its table as literal HTML `<table>`, not a markdown pipe table, which the old parser never understood), companies-with-multiple-roles' "↳" ditto rows were dropped as junk on every board that uses them, and — more subtly — the GitHub README `content` field's base64 was decoded with plain `atob()`, which mangles every multi-byte UTF-8 character (emoji status markers, the "↳" glyph itself, accented names) into garbage. All three were real correctness bugs, not just missing features, fixed in `github.js`.

**Multi-board aggregation (`components/jobBoards/boardsRegistry.js`):** the core ask — "find the companies for me, don't make me paste one link at a time." **Tracked boards** are a small localStorage-persisted list (`rec_tracked_boards`); **✚ Pull all tracked boards** fetches every one in parallel, tags each job with its source repo, and merges into one deduped list (exact Company+Role+Location match — cross-posting the same internship on 2+ boards is common). One board failing (bad repo, README moved) surfaces its own error and never blocks the others. Nothing is pre-tracked by default (deliberate choice — the user wanted to pick sources, not have 3 repos silently force-added), but `SUGGESTED_BOARDS` (SimplifyJobs/Summer2026-Internships, vanshb03/Summer2026-Internships, speedyapply/2027-SWE-College-Jobs — all verified live) renders as one-click "+ add" chips in `TrackedBoardsPanel.jsx`, so finding good sources still costs zero research. The single-repo/username ad-hoc lookup (original flow) still exists, collapsed under "or look up a single repo/profile."
- Parses both markdown pipe tables AND real HTML `<table>` blocks (via `DOMParser`, since this all runs client-side) — same row→job logic serves both, so a board can mix formats or switch formats without breaking.
- **Auto-import (hands-off):** every open (non-closed) listing not already in the Applications DB is created there automatically with Triage='Needs Review', Location, and Source Repo set — concurrency-limited (4 at a time), with a progress banner. Dedup is keyed on exact Company+Role text against already-fetched `apps`, guarded by an in-flight `claimedKeysRef` so a rapid re-pull or React StrictMode's dev-mode double-effect-invocation can't double-import the same job (this bug shipped once and had to be cleaned up — see `DuplicatesPanel` below).
- Card grid with bucket system: Needs Review / Applying / Maybe / Applied / Pass — now backed by the Applications DB `Triage` field (not localStorage). Marking "Applied" bumps the real `Stage` to Applied (if still Wishlist) and sets Applied Date; marking "Pass" just tags Triage (no Stage change). `ContactDetailModal`-style optimistic local overlay (`optimistic` state) keeps bucket clicks instant without waiting on the Notion round-trip.
- Needs-Review/Pass rows (still at Stage=Wishlist) are excluded from Overview/Pipeline/Actions "active" stats via `isUntriaged()` in `shared.jsx`, so a big board import doesn't drown out real pipeline activity. Overview shows an amber "N jobs need review" nudge when the queue is non-empty.
- AI fit analysis per job (uses preferences panel) — provider follows the AI Provider Switch above
- Calendar view by posting date
- Filter bar: free-text search (company + role + location), location text input, quick chips (Remote, Bay Area, NYC, etc.), plus a **⏰ Closing soon** urgency filter
- Stats bar: new this week, remote count, top locations, multi-role companies

**Real deadline extraction (`lib/deadlines.js`, `useJobDeadlines.js`) — "I never want to miss a deadline":** none of these board repos carry a real deadline, only "days since posted" — the only way to get an actual close-date is to visit the real apply page and read one off, if the company even states one (most don't; postings are commonly rolling). Runs automatically for **every** open job with an apply link (chosen scope: broad coverage over cost-minimization) — batched (6 apply URLs per pass, 3 pipelines in parallel) so it's still bounded: Exa's `/contents` endpoint fetches the real page text for a batch directly (no search needed, we already have the URL) → one AI call reads the whole batch and reports a deadline **only if the page actually states one** (explicitly told not to guess/invent a date for rolling postings) → cached forever in localStorage (`rec_job_deadlines`) keyed by job, so it's a one-time cost per job, with a manual **↻ recheck** in the detail modal to force a re-read. Feeds the sort order (see below) and a badge on both the card and detail modal (⏰ "Closes in Nd" / "Rolling — no stated deadline" / "Checking…" while in flight).
- **Sort priority, closest deadlines first (the literal ask):** a confirmed real deadline sorts soonest-first ahead of everything else; within Needs Review, ties then fall back to preference-relevance ranking; everything else falls back to freshest-posted-first with ghost/stale listings sunk to the bottom of that group (`urgencyComparator`/`urgencyTier` in `helpers.js`).

### Duplicate tracker (Pipeline tab)
`DuplicatesPanel` in `components/PipelineTab.jsx` groups Applications by normalized (trim+lowercase) Company+Role via `findDuplicateGroups()` in `shared.jsx`, shows counts + a reviewable list, and an explicit "Archive N duplicates" button (native `confirm()` gate, keeps the oldest row per group, archives the rest via `archiveApplication()`). Only catches exact-text duplicates, not fuzzily-worded ones across sources.

### Vite Proxy (auth-gated; per-user BYOK keys injected server-side, never in browser bundle)
```
/gh-api          → api.github.com              (requireUser(); injects optional per-user GITHUB_TOKEN, else unauthenticated)
/gh-contrib      → github-contributions-api.jogruber.de   (public, no auth gate)
/claude-api      → api.anthropic.com           (requireUser(); injects per-user Anthropic key; strips incoming Origin/Referer — see Known Issues) — vision only now
/openai-api      → api.openai.com              (requireUser(); injects per-user OpenAI key; same Origin/Referer strip) — every other AI call site
/google-calendar → www.googleapis.com          (requireUser(); mints an access token from THAT user's stored refresh token, then forwards)
/exa             → api.exa.ai                  (requireUser(); injects per-user Exa key; strips Origin/Referer like /claude-api — see People Discovery below, and Job Boards' deadline extraction)
/api/keys        → (not a passthrough proxy) BYOK key CRUD — see api/keys.js
/api/google-connect → (not a passthrough proxy) persists a per-user Calendar refresh token — see api/google-connect.js
```
`/notion` was deleted 2026-07-23 (see Multi-Tenant Auth + BYOK) — `db.js` talks to Supabase directly, no proxy needed.

---

## Data Model — Supabase (current) vs. Notion (legacy)

The live app's tables are `contacts`, `applications`, `calls`, `interactions` in Supabase Postgres (`supabase/migrations/*.sql`), each with a `user_id` column + RLS policy scoping every read/write to `auth.uid() = user_id`. Column names are snake_case; `db.js` maps them to the same camelCase JS shapes the app has always used.

The table below is the **original Notion schema** — still accurate as the *field mapping reference* for `scripts/migrate-notion-to-supabase.js` (and for anyone migrating their own old workspace), but these Notion DBs are no longer read/written by the deployed app itself.

| Notion DB | ID | Purpose | Maps to |
|---|---|---|---|
| Contacts | `6f941973-1fce-40c3-943c-4c908940e2a8` | Master CRM. Has a `Referred By` self-relation (who introduced whom) used by the Graph tab. | `contacts` table |
| Calls | `8ddef121-1744-45d2-aa52-7699a727e9c0` | Call notes, linked to contact | `calls` table |
| Applications | `49011c2e-8165-4373-a41b-f913b02d1052` | One row per company/role | `applications` table |
| LC Problems | `9fc96722-d155-4333-9770-41130fb59a39` | LeetCode auto-sync | Not yet ported — LeetNotion extension is still Notion-only |
| Interactions | `39753135-a476-819e-96b4-dc41ecab6364` | Universal touchpoint ledger — one row per email/LinkedIn/call/meeting, regardless of whether a richer artifact (e.g. a Calls DB entry) also exists. | `interactions` table |

See `notion/schema.md` for full field-level detail and `supabase/migrations/*.sql` for the current Postgres schema.

---

## Email Pipeline (Google Apps Script)

File: `scripts/email-pipeline.js`
Deploy: script.google.com → paste file → Script Properties → add `ANTHROPIC_KEY` + `NOTION_KEY` → run `setup()` → add trigger (every 10 min)

Pipeline: Gmail label `recruiting` → Claude Haiku classifies + extracts (newest message only) → upsert contact in Notion → upsert application → Google Calendar event (if interview date found) → every message new since the last run (tracked per-thread via `PropertiesService`, key `msgcount_<threadId>`) gets logged as its own row in the Interactions DB (no LLM call) → `recruiting-done` label applied as a visual marker only (no longer gates processing, since a thread can grow replies after being marked done)

**Not yet ported to Supabase** — this still targets the legacy Notion DBs directly (Apps Script can't easily hold a Supabase service-role session the way `api/*.js` does). For the primary account, either keep using Notion as this script's write target and periodically re-run the migration script, or port this pipeline to write to Supabase directly (would need the service-role key in Script Properties, same encryption-at-rest question as everywhere else). Not done as of 2026-07-23 — flagged, not executed.

Cost: ~$0.001/email with Haiku (classification only runs once per thread-update, not per logged message)

---

## Critical Constraints
- `.env` and `context.md` are gitignored — credentials never committed
- Row Level Security (`auth.uid() = user_id`) enforced in Postgres for every user-data table, not just in application code
- BYOK keys (`user_api_keys`) and Google refresh tokens (`google_calendar_tokens`) have **zero client-facing RLS policies** — only server code holding the service-role key can read them, and only after verifying the caller's own JWT
- API keys (BYOK or otherwise) never reach the browser bundle — every proxy is server-side, auth-gated with `requireUser()`
- Google Apps Script keys in Script Properties only
- Notion free plan: no native automations (relevant only to the legacy migration path now)

---

## Known Issues

- **Claude API calls from the browser in dev mode can fail with `"CORS requests must set 'anthropic-dangerous-direct-browser-access' header"`** — Vite's dev handler forwards the browser's `Origin`/`Referer` headers through to Anthropic by default, which Anthropic's API treats as a direct-browser-access attempt and rejects, even though the call is genuinely server-to-server (the proxy injects the key, the browser never sees it). Fixed in `api/claude-api.js` by building a fresh headers object rather than forwarding the incoming request's headers — since `vite.config.js`'s `mountApiHandler()` runs this same file directly, dev and prod share the fix automatically. If a *new* proxied endpoint is added that calls an API sensitive to Origin, apply the same fix (`/openai-api` and `/exa` both already have it).
- **Google Calendar refresh tokens expire every 7 days per-user** while the OAuth consent screen stays in Testing mode (Google's cap, not a bug) — see the Google Calendar Integration section above. Now a per-user papercut (each person just re-connects in Settings) rather than a single outage for everyone, but still worth publishing the consent screen to Production to remove entirely.

## Pending Setup (one-time)

- **Link a real Supabase project for production** (`supabase link` + `supabase db push`) if not already done — local dev defaults to the `supabase start` local stack, which doesn't deploy anywhere.
- **Add the Vercel production env vars** listed under Deployment above (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SECRET_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) if deploying fresh.
- **Sign up in the app, then add your own BYOK keys in Settings** (Anthropic, and optionally OpenAI/Exa/GitHub) — nothing AI-powered works until this is done, by design (no shared keys anymore).
- **Run the Notion migration** if moving off an existing single-tenant setup: `node scripts/migrate-notion-to-supabase.js you@example.com` (sign up first). Already done once for the primary account (2026-07-23, local stack) — re-run against a real Supabase project once one is linked.
- Deploy Google Apps Script email pipeline (script.google.com) — still Notion-only, see Email Pipeline above for the port-to-Supabase tradeoff.
- Download Granola + connect Google Calendar
- Install LeetNotion VS Code extension for LC → Notion sync
- **Publish the Google OAuth consent screen to Production** (Cloud Console → OAuth consent screen → Publish App) — while it's stuck in Testing mode, every user's Calendar refresh token expires every 7 days and "+ Event"/Settings' Connect Calendar silently breaks until they reconnect. Tradeoff: since `calendar.events` is a sensitive scope and the app isn't Google-verified, every user will hit a "Google hasn't verified this app" interstitial on first connect (Advanced → Go to [app] (unsafe)) — acceptable to ship with, not something to push through full verification for at this stage. Not yet done.

**Done:** local Supabase stack verified end-to-end (2026-07-23) — auth signup/signin, BYOK key CRUD (add/list/delete, encrypted at rest), RLS cross-account isolation (a second test account confirmed to see zero rows of the primary account's 229 applications / 8 contacts), and the Notion→Supabase migration for the primary account. Leftover local test accounts (`otheruser@test.dev`, `ethan@test.dev`) created during that verification were deleted afterward — the local auth stack now has just the one real account.

Not yet built: mobile quick-capture generalized across both action modals (the "+ Event" floating button pattern now exists in `Sidebar.jsx` — extending the same affordance to `LogInteractionModal` is now cheap), weekly stale-contact digest (Apps Script time trigger), "looks cold" decay badge, warm-intro path finder.

## Features Researched — Next to Build

Priority order (Fall 2026 apps open in ~4 weeks):

1. **SimplifyJobs live feed** — parse `SimplifyJobs/Summer2026-Internships` daily via GitHub raw API (better source than speedyapply)
2. **LeetCode company panel** — fetch free CSV from `snehasishroy/leetcode-companywise-interview-questions`, show top 10 questions per company in application card
3. **Cold outreach drafter** — contact name + company + context → Claude writes personalized LinkedIn DM / email
4. **Referral coverage map** — cross-reference contacts vs target company list, surface gaps. Now cheaper to build: the Graph tab's company-grouping logic (`NetworkGraphTab.jsx`) is most of what this needs.
5. **Job fit scorer** — paste JD → Claude scores 1-10 fit + top gaps

Key insight from research: referrals are 2-3x more likely to convert than cold apps. Building the referral coverage map + outreach drafter together is the highest-ROI work before August.
