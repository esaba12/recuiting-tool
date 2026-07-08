# Recruiting OS — Status & Roadmap

**Updated:** July 2026  
**Goal:** Zero-touch recruiting OS for the candidate's Fall 2026 SWE internship search. Apps open August 2026.

---

## System Architecture

```
INPUTS                          NOTION HUB                    DASHBOARD
──────                          ──────────                    ─────────
Gmail ──[Apps Script+Claude]──► Contacts DB ◄──────────────► React app
Granola ──[manual paste]──────► Calls DB    ◄──────────────► localhost:3001
LeetCode ──[LeetNotion ext]───► LC Problems DB
GitHub job boards ────────────► (localStorage buckets)
```

---

## What's Built ✅

### React + Vite Dashboard (`app/`)
Run: `cd app && npm run dev` → http://localhost:3001

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

**Vite proxy** injects all API keys server-side — keys never reach the browser:
- `/notion` → Notion API
- `/gh-api` → GitHub API
- `/claude-api` → Anthropic API

### Email Pipeline (`scripts/email-pipeline.js`)
Google Apps Script — runs every 10 minutes via time trigger  
Gmail label `recruiting` → Claude Haiku classifies + extracts → Notion upserts contact + application → Google Calendar event (if interview date found) → marks thread `recruiting-done`  
Cost: ~$0.001/email

### Notion Hub
4 live databases — IDs in `.env` and `context.md` (both gitignored)
- Contacts DB
- Calls DB
- Applications DB
- LC Problems DB

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
app/vite.config.js       Proxy config (API key injection)
scripts/email-pipeline.js  Google Apps Script — deploy to script.google.com
notion/schema.md         Notion DB schema reference
context.md               GITIGNORED — Notion/Anthropic IDs
.env                     GITIGNORED — all API keys
```
