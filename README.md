# Recruiting OS

A near zero-touch **recruiting operating system** for a student or early-career
job search — a lightweight CRM, application tracker, and job-board aggregator
with AI assistance, wrapped in a **React** dashboard.

> **Multi-tenant, bring-your-own-key.** Sign up with email/password or Google,
> then add your own Anthropic/OpenAI/Exa/GitHub API keys in Settings. Your data
> (contacts, applications, interactions) lives in your own Supabase-backed
> account — nobody else can see it, and you're never billed for anyone else's
> AI usage (or vice versa). Try it without signing up at `/demo` (sample data,
> nothing saved).

---

## What it does

- **Contact CRM** — a contact list with status, urgency, follow-up dates, a
  "referred by" self-relation, table + card + force-directed graph views, and
  an interaction history ledger.
- **Application tracker** — one row per company/role with a stage funnel.
- **Networking tracker** — unified Call/LinkedIn/Meeting/Email/Other logging,
  a "Keep in Touch" reconnect-cadence queue, and referral coverage gaps against
  a target-company list.
- **Discover / Explore** — AI-ranked company + people discovery for target
  companies, sourced from Exa's public-web search (never scrapes or logs into
  LinkedIn).
- **Job-board aggregator** — track multiple GitHub internship-list repos,
  auto-import + dedup listings, bucket them (Needs Review / Applying / Maybe /
  Applied / Pass), get per-job AI fit analysis, and real deadline extraction
  from the actual apply page.
- **AI email pipeline** — a Google Apps Script watches a Gmail label, uses
  Claude/GPT to classify + extract each recruiting email, upserts the contact
  and application, and creates a Calendar event when an interview is scheduled.
- **"+ Event" / "+ Schedule"** — screenshot or text → Google Calendar event via
  Claude vision extraction, plus a lightweight scheduling-intent tracker.
- **AI provider switch** — every text-only AI call site runs through one
  provider-agnostic switch (`lib/ai.js`); flip between Claude and OpenAI with a
  single env var, no code changes.

---

## Architecture

```
Browser (React + Vite) ──auth──► Supabase Auth (email/password + Google)
        │                              │
        │ same-origin proxy routes     ▼
        ▼                        Supabase Postgres (RLS: auth.uid() = user_id)
Vercel serverless fns (app/api/*.js)   contacts / applications / interactions / calls
  - verify the caller's Supabase JWT        │
  - look up THAT user's own BYOK key   user_api_keys / google_calendar_tokens
    (AES-256-GCM encrypted, service-  (server-only, zero client-facing RLS —
     role only, never sent to browser) decrypted only inside api/*.js)
  - forward to Anthropic / OpenAI /
    Exa / GitHub / Google Calendar
```

**Nobody's API key or data is ever visible to another user.** Row Level
Security policies scope every table read/write to `auth.uid() = user_id`;
`user_api_keys` and `google_calendar_tokens` have *no* client-facing RLS
policies at all — only server code holding the service-role key can decrypt
them, and only after verifying the caller's JWT names that same user.

---

## Tech stack

| Layer | Tech |
|---|---|
| Dashboard | React 18 + Vite, Tailwind v4 |
| Auth + data | Supabase (Postgres + Auth), Row Level Security |
| Data tables / graph | `@tanstack/react-table`, `react-force-graph-2d` |
| Charts | Recharts |
| Hosting | Vercel (serverless functions for auth + key injection) |
| AI | Claude (Anthropic) and/or OpenAI GPT — one switch, BYOK per user |
| Search | Exa (people/company discovery, deadline extraction) |
| Email automation | Google Apps Script |
| Calendar | Google Calendar API, per-user OAuth |

---

## Repo structure

```
app/                        React + Vite dashboard (primary interface)
  src/
    App.jsx                 Root App() — routes to /demo or the authed app
    db.js                    Supabase Postgres data layer (+ demo-mode in-memory branch)
    demoData.js              Seed data for the public /demo route
    lib/
      supabaseClient.js       Client-side Supabase client + authHeader()
      AuthContext.jsx          React context for auth state
      ai.js                    Provider-agnostic AI switch (Claude/OpenAI)
      scopedStorage.js         localStorage namespaced by user id
    components/
      LoginPage.jsx            Sign in / sign up (email + Google)
      SettingsTab.jsx          BYOK keys, profile, Google Calendar connect
  api/                       Vercel serverless functions (auth + key injection)
    _lib/                     supabaseAdmin.js, crypto.js, keys.js (shared server helpers)
    keys.js                   BYOK key CRUD (encrypted, server-only)
    google-connect.js         Per-user Google Calendar OAuth token capture
    claude-api.js / openai.js / exa.js / gh-api.js / google-calendar.js
  vite.config.js             Dev server — runs the real api/*.js handlers directly
scripts/
  email-pipeline.js          Google Apps Script — Gmail → Claude/GPT → Supabase
  migrate-notion-to-supabase.js   One-time: pull an existing Notion workspace into Supabase
supabase/
  migrations/                 SQL schema + RLS policies
notion/                      Legacy — schema reference + setup scripts for the
                             original single-tenant Notion version, kept only
                             for the one-time migration path above.
```

See [`CLAUDE.md`](CLAUDE.md) for a full technical overview.

---

## Setup

### 1. Supabase
Local dev (recommended to start):
```bash
supabase start   # from the repo root — prints your local API URL + anon/service_role keys
```
Or create a free project at <https://supabase.com> for production.

Apply the schema:
```bash
supabase db push   # against whichever project supabase link points at
```

### 2. Environment
```bash
cp .env.example .env
```
Fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` from step 1's output, and generate a
`SECRET_ENCRYPTION_KEY` (command is in the `.env.example` comment). Google
Calendar's `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are optional (only needed
for the "+ Event"/"Connect Calendar" feature). Everything else (Anthropic,
OpenAI, Exa, GitHub) is BYOK — added per-user in the app's Settings tab, not
in `.env`.

### 3. Dashboard (`app/`)
```bash
cd app
npm install
npm run dev          # http://localhost:3001
```
Sign up, then add your API keys in **Settings**.

Deploy to Vercel with the project **root directory set to `app/`**, and add
the same env vars as encrypted production environment variables.

### 4. Migrating from an existing Notion setup (optional)
If you're moving off an earlier single-tenant version of this app that used
Notion as the data store:
```bash
node scripts/migrate-notion-to-supabase.js you@example.com   # sign up in the app first
```
Requires `NOTION_API_KEY` + the four `*_DB_ID` vars in `.env` (see
[`notion/schema.md`](notion/schema.md)). Safe to re-run — it replaces just
that user's rows each time.

### 5. Email pipeline (`scripts/email-pipeline.js`)
1. Create a project at <https://script.google.com>, paste in the file.
2. Add your Supabase service-role key + AI key under **Project Settings →
   Script Properties**, and the target user id to attach parsed emails to.
3. In Gmail, create a `recruiting` label (and a filter to apply it).
4. Run `setup()` once, then add a time-based trigger (every ~10 min) on
   `processRecruitingEmails`.

---

## Security & privacy

- **Row Level Security everywhere.** Every user-data table enforces
  `auth.uid() = user_id` in Postgres itself — not just in application code.
- **BYOK keys and Google refresh tokens are never exposed to the browser.**
  They're AES-256-GCM encrypted at rest, in tables with zero client-facing RLS
  policies; only server code holding the service-role key can decrypt them,
  and only after verifying the caller's own JWT.
- **No secrets in the repo.** All keys are read from environment variables
  (`.env`, gitignored). Copy `.env.example` and fill in your own.
- **`/demo` is fully isolated** — in-memory sample data only, no Supabase
  session, no real backend calls, resets on reload.

---

## License

[MIT](LICENSE)
