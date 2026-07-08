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
| React + Vite | Local dashboard at localhost:3001 | ✅ Running |
| Google Apps Script | Email pipeline (Gmail → Claude → Notion) | ✅ Built, needs deploy |
| Claude API (Haiku 4.5) | AI fit analysis, call extraction, email extraction | ✅ Wired via Vite proxy |
| Notion | Central hub — 4 databases | ✅ Live |
| Granola | Call transcription (no bot) | 🔄 Download + connect |
| LeetNotion extension | LeetCode → Notion auto-sync | 🔄 Pending install |
| Exa ($250 YC credits) | Contact enrichment — LinkedIn lookup | 🔄 Planned |

**Abandoned:** Gumloop (BYOK requires $37/mo Pro plan), Cowork/Claude Desktop scheduled tasks

---

## Repo Structure

```
app/                        ← React + Vite dashboard (PRIMARY)
  src/
    App.jsx                 ← Main app, all tabs (~1500 lines)
    github.js               ← GitHub job board parser
    notion.js               ← Notion API client
  vite.config.js            ← Proxy config (injects API keys server-side)
scripts/
  email-pipeline.js         ← Google Apps Script (deploy to script.google.com)
notion/
  schema.md                 ← DB schema reference
plans/                      ← Phase plans (mostly outdated — see below)
prompts/                    ← Claude prompts
context.md                  ← Gitignored — Notion/Anthropic IDs for reference
.env                        ← Gitignored — all API keys
```

---

## The Dashboard (app/)

**Dev server:** `cd app && npm run dev` → http://localhost:3001

### Tabs
- **Overview** — Notion contacts needing follow-up, application stats
- **Network** — Contact CRM from Contacts DB, add/view contacts
- **Pipeline** — Application tracker from Applications DB, stage funnel
- **Actions** — (planned) outreach queue
- **Calls** — Paste Granola summary → Claude extracts → saves to Notion Calls DB
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
| Contacts | `6f941973-1fce-40c3-943c-4c908940e2a8` | Master CRM |
| Calls | `8ddef121-1744-45d2-aa52-7699a727e9c0` | Call notes, linked to contact |
| Applications | `49011c2e-8165-4373-a41b-f913b02d1052` | One row per company/role |
| LC Problems | `9fc96722-d155-4333-9770-41130fb59a39` | LeetCode auto-sync |

---

## Email Pipeline (Google Apps Script)

File: `scripts/email-pipeline.js`
Deploy: script.google.com → paste file → Script Properties → add `ANTHROPIC_KEY` + `NOTION_KEY` → run `setup()` → add trigger (every 10 min)

Pipeline: Gmail label `recruiting` → Claude Haiku classifies + extracts → upsert contact in Notion → upsert application → Google Calendar event (if interview date found) → mark thread `recruiting-done`

Cost: ~$0.001/email with Haiku

---

## Critical Constraints
- `.env` and `context.md` are gitignored — credentials never committed
- API keys in Vite proxy only — never reach the browser bundle
- Google Apps Script keys in Script Properties only
- Notion free plan: no native automations

---

## Features Researched — Next to Build

Priority order (Fall 2026 apps open in ~4 weeks):

1. **SimplifyJobs live feed** — parse `SimplifyJobs/Summer2026-Internships` daily via GitHub raw API (better source than speedyapply)
2. **LeetCode company panel** — fetch free CSV from `snehasishroy/leetcode-companywise-interview-questions`, show top 10 questions per company in application card
3. **Cold outreach drafter** — contact name + company + context → Claude writes personalized LinkedIn DM / email
4. **Referral coverage map** — cross-reference contacts vs target company list, surface gaps
5. **Job fit scorer** — paste JD → Claude scores 1-10 fit + top gaps

Key insight from research: referrals are 2-3x more likely to convert than cold apps. Building the referral coverage map + outreach drafter together is the highest-ROI work before August.
