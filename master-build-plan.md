# Recruiting OS — Status & Roadmap

**Updated:** July 2026  
**Goal:** Zero-touch recruiting OS for a student's SWE internship search.

---

## System Architecture

```
INPUTS                          NOTION HUB                    DASHBOARD
──────                          ──────────                    ─────────
Gmail ──[Apps Script+Claude]──► Contacts DB ◄──────────────► React app
Granola ──[manual paste]──────► Calls DB    ◄──────────────► Vercel-hosted app
LeetCode ──[LeetNotion ext]───► LC Problems DB
GitHub job boards ────────────► (localStorage buckets)
```

---

## What's Built ✅

### React + Vite Dashboard (`app/`)
**Deploy:** auto-deploys to Vercel on push to `main`
Local dev: `cd app && npm run dev` → http://localhost:3001

| Tab | What It Does |
|---|---|
| Overview | Contacts needing follow-up, app stats from Notion |
| Network | Contacts CRM — view/add, pulled from Notion |
| Pipeline | Application tracker with stage view, pulled from Notion |
| Calls | Paste Granola summary → Claude extracts → saves to Notion |
| Job Boards | GitHub repo URL → parsed job listings |

**Job Boards tab features:**
- Parses any GitHub README job board (speedyapply, SimplifyJobs, etc.)
- Card grid with bucket system: Applying / Maybe / Applied / Pass (localStorage)
- AI fit analysis per job via Claude Haiku — scores against your preferences
- Calendar view by posting date
- Filter bar: text search (company + role + location), free-text location input, quick chips (Remote, Bay Area, NYC, Seattle, Austin, Boston, Chicago, LA), clear all

**Key injection** — API keys never reach the browser:
- Production: `app/api/*.js` Vercel serverless functions, `vercel.json` rewrites `/notion`, `/gh-api`, `/gh-contrib`, `/claude-api` → them; keys live as encrypted Vercel env vars
- Local dev: `vite.config.js` dev-server proxy does the same job against `.env`

### Email Pipeline (`scripts/email-pipeline.js`)
Google Apps Script — runs every 10 minutes via time trigger  
Gmail label `recruiting` → Claude Haiku classifies + extracts → Notion upserts contact + application → Google Calendar event (if interview date found) → marks thread `recruiting-done`  
Cost: ~$0.001/email

### Notion Hub
4 live databases — IDs in `.env` and `context.md` (both gitignored, `context.md` untracked from git as of this deploy)
- Contacts DB
- Calls DB
- Applications DB
- LC Problems DB

### Hosting (Vercel)
- Project `recruiting-os`, root directory `app/`, connected to GitHub for auto-deploy
- Manual redeploy: `cd app && npx vercel --prod`
- Gotcha to remember: don't use nested `[...path].js` dynamic folders for proxy routes — Vercel's zero-config catch-all only matches a single path segment and 404s on deeper paths. Current setup uses flat `api/notion.js` etc. with the sub-path passed as `?path=` via rewrites.

---

## Pending One-Time Setup 🔄

| Task | Est. Time | Instructions |
|---|---|---|
| Deploy Apps Script email pipeline | 15 min | `script.google.com` → new project → paste `scripts/email-pipeline.js` → Script Properties → add `ANTHROPIC_KEY` + `NOTION_KEY` → run `setup()` → add trigger (every 10 min, `processRecruitingEmails`) |
| Download Granola | 5 min | granola.ai → connect Google Calendar → it auto-detects meetings |
| Install LeetNotion | 15 min | VS Code extension or browser extension → connect Notion LC Problems DB |

---

## Next to Build 🚧

Ordered by ROI for Fall 2026 recruiting (apps open in ~4 weeks):

### 1. Cold Outreach Drafter (HIGH priority)
**Why:** Referrals convert 2-3x vs cold apps. Networking should start now, before apps open. Students send 20-50+ outreach messages — Claude drafts save 80% of the time.  
**What:** Form in Network tab — contact name + company + how you found them → Claude writes personalized LinkedIn DM (<300 chars) or email draft → copy to clipboard → log attempt to contact  
**Effort:** ~2 hours

### 2. SimplifyJobs Live Feed
**Why:** `SimplifyJobs/Summer2026-Internships` is the canonical SWE internship list — updated daily by community + Simplify automation. Better signal than speedyapply.  
**What:** New Job Boards source — poll GitHub raw content daily, parse README table, auto-flag companies already in your pipeline, show "days since posted" urgency badge  
**Effort:** ~3 hours

### 3. LeetCode Company Panel
**Why:** Interview prep should start now. Free public data on exactly which questions companies ask.  
**What:** In application cards, show top 10 most-frequent questions for that company from `snehasishroy/leetcode-companywise-interview-questions` CSV (free GitHub repo, no API)  
**Effort:** ~2 hours

### 4. Referral Coverage Map
**Why:** Shows which target companies have no warm path so you know who to reach out to this week.  
**What:** Add "can refer at" field to contacts → view that cross-references contacts vs target company list → green/yellow/red coverage by company  
**Effort:** ~3 hours

### 5. Job Fit Scorer
**Why:** Triage which applications to prioritize before apps open.  
**What:** Paste JD into application card → Claude scores 1-10 + top 2 matching strengths + top 2 gaps  
**Effort:** ~2 hours

---

## Abandoned / Descoped

| Tool | Why Dropped |
|---|---|
| Gumloop | BYOK requires $37/mo Pro plan — replaced by Google Apps Script (free) |
| Cowork / Claude Desktop scheduled tasks | Not needed — Apps Script handles automation |
| Deepgram | Too complex (6-8h setup) — Granola does same thing in 5 min |

---

## Cost

| Item | Cost |
|---|---|
| Claude API (Haiku) | ~$0/mo from YC $500 credits |
| Notion | Free |
| Granola | Free (30-day note window) |
| Google Apps Script | Free |
| Exa (contact enrichment) | $0 from YC $250 credits — not yet wired up |
| **Total** | **$0/mo** |

---

## Key Files

```
app/src/App.jsx          Main dashboard (tabs, all UI)
app/src/github.js        GitHub README → job listing parser
app/src/notion.js        Notion API client
app/api/*.js             Vercel serverless proxies (production key injection)
app/vercel.json          Rewrites → api/*.js, deploy config
app/vite.config.js       Dev-server proxy config (local key injection)
scripts/email-pipeline.js  Google Apps Script — deploy to script.google.com
notion/schema.md         Notion DB schema reference
context.md               GITIGNORED, untracked — Notion/Anthropic IDs
.env                     GITIGNORED — all API keys
```
