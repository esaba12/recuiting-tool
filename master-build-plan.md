# Recruiting Intelligence System — Master Build Plan

**Author:** the candidate  
**Updated:** June 2026  
**Stack:** Granola · YC AI Credits · Deepgram · Claude API · Gumloop (1 flow) · Notion · LeetNotion · Cowork  
**Goal:** Zero-touch recruiting OS — calls, emails, contacts, and LeetCode all flow into Notion automatically

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tool Stack & What Each Tool Does](#2-tool-stack--what-each-tool-does)
3. [The Notion Hub — Database Schema](#3-the-notion-hub--database-schema)
4. [Pipeline 1 — Call & Zoom Transcription](#4-pipeline-1--call--zoom-transcription)
5. [Pipeline 2 — Email Intelligence](#5-pipeline-2--email-intelligence)
6. [Pipeline 3 — LeetCode Sync](#6-pipeline-3--leetcode-sync)
7. [Pipeline 4 — Weekly Summary Agent](#7-pipeline-4--weekly-summary-agent)
8. [The Inbox Signal Dashboard (Claude Artifact)](#8-the-inbox-signal-dashboard-claude-artifact)
9. [Cowork Usage Guide — When & What](#9-cowork-usage-guide--when--what)
10. [Subagent Split Plan](#10-subagent-split-plan)
11. [Build Sequence & Timeline](#11-build-sequence--timeline)
12. [Integration Map](#12-integration-map)
13. [Cost & Credit Accounting](#13-cost--credit-accounting)

---

## 1. System Overview

The system has four automated input pipelines feeding one Notion hub, with a React dashboard as the primary human interface.

```
INPUTS                              NOTION HUB               OUTPUT
──────                              ──────────               ──────
Zoom/calls ──[Granola]──►
                                 ┌──────────────────┐
Gmail ──────[Gumloop+Claude]────►│  Contacts DB     │──► Inbox Signal
                                 │  Calls DB        │    Dashboard
LeetCode ───[LeetNotion]────────►│  LC Problems DB  │
                                 │  Applications DB │──► Cowork Weekly
Manual Granola export ──────────►└──────────────────┘    Summary
```

**The core contract:** You should never manually enter data. Every interaction — call, email, LC solve — writes itself to Notion. The dashboard surfaces what needs your attention. Cowork handles weekly synthesis.

**Honest caveat:** This is not fully zero-touch. The call pipeline has one manual step (copy Granola summary → paste into Gumloop webhook or Notion directly). Everything else is genuinely automatic.

---

## 2. Tool Stack & What Each Tool Does

### Granola (Free — replaces Deepgram for call capture)

**Role:** Call transcription and in-meeting notes — no bot joins the call  
**Why it beats Deepgram for this use case:** Granola auto-detects calendar meetings and starts recording with one click. No Python script, no BlackHole setup, no terminal. It captures system audio invisibly — nobody in the Zoom sees a recording bot. Deepgram requires 6-8 hours of custom setup to achieve the same capture; Granola takes 5 minutes.  
**Free tier reality:** Unlimited meeting summaries. Notes older than 30 days become inaccessible on the free plan. For recruiting — where most follow-up happens within 2 weeks — this is acceptable.  
**What it does NOT do free:** Push notes to Notion automatically. The Notion integration is Business tier only ($14/month). On free, you copy the summary and paste it to trigger the pipeline manually, or use the Granola MCP with Cowork (Business tier) to automate it.  
**Verdict:** Use Granola free as the capture layer. Accept the one manual copy-paste step per call, or upgrade to Business ($14/month) when/if it's worth it. Do not build the Deepgram pipeline unless you need real-time transcription inside a custom app.

**Platform:** Mac and Windows desktop app required. No web app. iPhone app available for in-person meetings and coffee chats.

### Claude API (YC $500 Anthropic Credits)

**Role:** Intelligence layer — summarizes transcripts, classifies emails, extracts structured contact data, drafts follow-ups  
**Model:** Claude Sonnet 4.6 for extraction and drafts. Claude Haiku for cheap classification.  
**How it connects:** Called by Gumloop's email flow and the Inbox Signal dashboard via the Anthropic API  
**Free allocation (confirmed):** $500 from YC stack. At ~$3/million input tokens for Sonnet, $500 covers ~83,000 email analyses or ~31,000 call summaries. Not a concern.

### Gumloop (YC Deal — 1 active trigger on free tier)

**Role:** Email intelligence pipeline — the one always-on automated flow  
**Critical constraint confirmed:** Free tier gives you **1 active trigger** and ~5,000 credits/month. The YC deal may bump credits but does not appear to unlock additional triggers — trigger count is a plan-tier feature, not a credit feature. This means Gumloop runs **one flow** for free: the Gmail email intelligence pipeline.  
**What costs credits:** Standard AI calls = 2 credits. Advanced Claude Sonnet calls = 20 credits. At 10 recruiting emails/day × ~25 credits/email = 7,500 credits/month — which exceeds the 5,000 free tier. Either use Haiku for classification (2 credits vs 20) to cut usage, or upgrade to Pro ($37/month) when the system proves its value.  
**Bring Your Own Key (BYOK):** Gumloop Pro supports providing your own Anthropic API key, which reduces AI node costs by 50% and uses your YC Anthropic credits directly instead of Gumloop credits. This is the right move once you upgrade.  
**All other flows:** Move to Cowork scheduled tasks or manual triggers. See Section 9.

### Notion (Free Tier — with known limitations)

**Role:** Single source of truth — all contacts, calls, LC problems, and applications  
**Free tier limitation confirmed:** Database automations (the "when Follow-Up Date = Today, send email" type) require a paid Notion plan. Free users cannot create or edit these automations. The workaround: route all notifications and reminders through Cowork's morning brief instead.  
**What works free:** All databases, all views, all filters, Relations between databases, Notion API access (required for LeetNotion and Gumloop writes), Notion MCP for Cowork.  
**Relation support in Gumloop:** Use Gumloop's Notion MCP node (not the legacy Database Writer) — it supports Relation properties via `{"Related": {"relation": [{"id": "page-id"}]}}`.

### LeetNotion VS Code Extension + Browser Extension (Free)

**Role:** Automatic LeetCode → Notion sync  
**VS Code extension (leetnotion):** Solve in VS Code → successful submit triggers Notion row write with title, difficulty, tags, solution code, timestamp. Fully automatic, no manual step.  
**Browser extension (LeetNotion Sync):** Same for browser-based solving. Auto-detects successful submission, offers one-click save popup.  
**Both are free.** Setup: install extension → duplicate LeetNotion Notion template → add Notion API key + Database ID → done. 15 minutes.

### Claude Cowork (Included with Claude Pro — $20/month)

**Role:** Scheduled synthesis tasks and all non-Gmail automated flows  
**What it replaces (given Gumloop's 1-trigger limit):**
- Daily ghost checker (moved from Gumloop Flow 2 → Cowork scheduled task)
- Call transcript processing when using Granola free (manual trigger in Cowork)
- Contact enrichment via Exa (on-demand in Cowork, not always-on)
- Weekly summary memo (Cowork scheduled task)
- Pre-call brief (on-demand Cowork task)

**Key constraint:** Scheduled tasks only run while your computer is on and Claude Desktop is open. The daily brief at 7am requires your laptop to be awake. The weekly memo on Sunday at 8pm does too. This is a real limitation vs cloud-based automation.  
**Workaround for reliability:** For the weekly summary, keep the Gumloop scheduled flow as a backup (it's cloud-based, always runs). Use Cowork for on-demand tasks where reliability matters less.

### Exa (YC Credits — $250 confirmed)

**Role:** Contact enrichment — given a name and company, finds LinkedIn URL and public bio  
**How it connects:** Gumloop's Notion MCP node can call Exa via the native MCP integration (one-click connect in Gumloop). Alternatively, Cowork has Exa available as a search tool natively.  
**When to use:** On-demand in Cowork ("enrich all contacts added this week") rather than always-on trigger (saves Gumloop's single trigger for email).

---

## 3. The Notion Hub — Database Schema

### 3.1 Contacts DB
The master CRM. One row per person you've interacted with.

| Property | Type | Description |
|---|---|---|
| Name | Title | Full name |
| Company | Text | Current employer |
| Role | Select | SWE / PM / Recruiter / Alumni / Referral |
| Email | Email | Primary email |
| LinkedIn | URL | Auto-filled by Exa |
| Source | Select | Coffee chat / Email / Event / Referral / LinkedIn DM |
| Status | Select | 🟢 Warm / 🟡 Cooling / 🔴 Cold / ✅ Closed / ⭐ Champion |
| What They've Done For Me | Text | Referral / intro / insider info / mock interview |
| Last Interaction | Date | Auto-updated on each call or email |
| Follow-Up Date | Date | Set by pipeline |
| Urgency | Select | HIGH / MED / LOW |
| Linked Calls | Relation | → Calls DB |
| Linked Applications | Relation | → Applications DB |
| Notes | Text | Free-form notes |
| Exa Enriched | Checkbox | Whether Exa has run |

**Note:** Notion native automation ("when Follow-Up Date = Today → send email") requires paid Notion plan. On free, Cowork's morning brief handles this instead.

### 3.2 Calls DB
One row per call. Linked to a contact.

| Property | Type | Description |
|---|---|---|
| Title | Title | Auto: "[Name] @ [Company] — [Date]" |
| Date | Date | From Granola or transcript metadata |
| Duration | Number | In minutes |
| Contact | Relation | → Contacts DB |
| Summary | Text | Granola AI summary + Claude extraction |
| Key Insights | Text | What they offered, what was promised |
| My Commitments | Text | What you said you'd do |
| Follow-Up Draft | Text | Claude-drafted email |
| Granola Link | URL | Link to Granola meeting (if shared) |
| Full Transcript | Text | Pasted from Granola (collapsed) |
| Action Status | Select | Pending / Done / N/A |

### 3.3 Applications DB
One row per company you've applied to or are targeting.

| Property | Type | Description |
|---|---|---|
| Company | Title | Company name |
| Role | Text | Specific role title |
| Stage | Select | Wishlist / Applied / Phone Screen / Technical / Onsite / Offer / Rejected / Accepted |
| Applied Date | Date | |
| Last Activity | Date | Auto-updated by email pipeline |
| Recruiter Contact | Relation | → Contacts DB |
| JD Link | URL | Job description URL |
| Resume Version | Text | Which version you submitted |
| Notes | Text | Interview prep, company research |
| Days in Stage | Formula | `dateBetween(now(), prop("Applied Date"), "days")` |
| Follow-Up Due | Date | Auto-calculated: Applied Date + 7 days |

### 3.4 LeetCode Problems DB
One row per problem solved. Auto-populated by LeetNotion.

| Property | Type | Description |
|---|---|---|
| Problem | Title | Problem name + LC number |
| Difficulty | Select | Easy / Medium / Hard |
| Topics | Multi-select | Array, DP, Graph, Tree, etc. |
| Status | Select | Solved / Attempted / Needs Review |
| Solution Code | Code block | Auto-saved by LeetNotion |
| Time to Solve | Number | Minutes |
| Optimal | Checkbox | Did you find the optimal solution? |
| Review Date | Date | Spaced repetition formula |
| Notes | Text | Gotchas, patterns learned |
| Solved Date | Date | Auto from LeetNotion |

**Spaced repetition formula for Review Date:**
```
if(prop("Difficulty") == "Easy", dateAdd(prop("Solved Date"), 7, "days"),
if(prop("Difficulty") == "Medium", dateAdd(prop("Solved Date"), 3, "days"),
dateAdd(prop("Solved Date"), 1, "days")))
```

---

## 4. Pipeline 1 — Call & Zoom Transcription

### Recommended: Granola Free (5-minute setup)

Granola is the right call capture tool. The Deepgram + BlackHole + Python pipeline was technically correct but over-engineered for the actual need, which is: capture what was said, extract contact info, write to Notion. Granola handles the capture natively with calendar integration and no bot. The one tradeoff is a manual step to push data into Notion.

### Step-by-step (Granola free path)

```
[Calendar invite exists for Zoom/call]
        │
        ▼
[Granola auto-detects meeting from calendar]
[One click "Start recording" before joining Zoom]
        │
        ▼
[During call: optionally jot rough notes in Granola's typing window]
[Granola merges your notes with full transcript into structured summary]
        │
        ▼
[Call ends → Granola generates:]
  - Full transcript (text, no audio stored)
  - AI summary with action items and decisions
  - Your typed notes woven in
        │
        ▼
[MANUAL STEP: Copy Granola summary]
[Paste into Cowork: "Process this call summary and create a Notion contact + call entry"]
        │
        ▼
[Cowork → Claude extracts structured JSON:]
  contact_name, contact_company, contact_role, contact_email,
  summary, key_insights, my_commitments, follow_up_draft,
  call_type, sentiment
        │
        ▼
[Cowork → Notion API:]
  - Search Contacts DB for contact_name
  - If found: update Last Interaction, append call link
  - If not found: create new contact row
  - Create new Calls DB row linked to contact
        │
        ▼
[Google Calendar: Cowork creates follow-up event 3 days out]
```

**Time per call:** ~2 minutes after the call ends (copy summary, paste into Cowork, review output).

### Upgrade path: Granola Business ($14/month)

If you upgrade, Granola pushes notes to Notion natively. Combined with Notion's MCP in Cowork, the manual step disappears entirely. At $14/month this is worth it once you're doing 3+ recruiting calls per week consistently.

### What about Deepgram?

Deepgram ($200 YC credit) is still useful if you ever want to build a custom voice app or need real-time streaming transcription in code. For this recruiting system, it's overkill — Granola does the same job with zero setup. Save Deepgram credits for a future project.

---

## 5. Pipeline 2 — Email Intelligence

This is the **one Gumloop trigger** — the highest-value always-on automation.

### Gmail filter setup (one-time, ~5 minutes)

In Gmail Settings → Filters → Create new filter:

```
Matches: subject:(interview OR "phone screen" OR application OR 
         recruiter OR hiring OR "next steps" OR offer OR 
         internship OR "coffee chat" OR "thank you for applying" OR
         "moving forward" OR "unfortunately") 
         OR from:(@greenhouse.io OR @lever.co OR @workday.com OR @myworkdayjobs.com)
Apply label: recruiting
Skip inbox: No (keep in inbox so you see it)
```

### Gumloop flow: Email Intelligence (the 1 free trigger)

```
[Gmail trigger: new email with label "recruiting"]
        │
        ▼
  Node 1: Gmail Reader — pull subject, sender, body
  Node 2: Claude Haiku (2 credits) — classify:
    REPLY | INTERVIEW_INVITE | OFFER | REJECTION | NEW_CONTACT | UNRELATED
  Node 3: Filter — if UNRELATED, stop
  Node 4: Claude Sonnet via BYOK (0 Gumloop credits, uses Anthropic credits) — extract:
    {contact_name, contact_email, company, role, email_type,
     summary, urgency, next_action, follow_up_draft, interview_date}
  Node 5: Notion MCP — search Contacts DB for contact_email
    - If found: update Last Interaction, Urgency, Status
    - If not found: create new contact row
  Node 6: Notion MCP — update Applications DB stage if applicable
  Node 7: If interview_date exists → Google Calendar: create event
```

**Credit math with BYOK:** Node 2 (Haiku) = 2 credits. Node 3 (filter) = 1 credit. Nodes 5-7 (Notion/Calendar) = ~3 credits. Total: ~6 credits per email with BYOK. At 10 emails/day × 30 days = 1,800 credits/month — well within the 5,000 free tier.

**Important:** Set up BYOK (Bring Your Own Key) in Gumloop Pro settings using your Anthropic API key from YC credits. This routes Claude calls through your $500 Anthropic credit instead of Gumloop credits, making the math work on free.

Note: BYOK requires Gumloop Pro ($37/month). Weigh: $37/month for fully automated email pipeline, or accept the Haiku-only path on free which still classifies and creates contacts but without the rich extraction.

### Daily ghost checker (moved to Cowork)

Since Gumloop's one trigger is taken by the email flow, the daily ghost check moves to Cowork:

```
Cowork scheduled task: Daily 9am (requires laptop on)
"Query my Notion Applications DB for all rows where 
Stage is Applied or Phone Screen and Days in Stage > 14.
For each, update Status to GHOST and Urgency to HIGH.
Write me a 3-bullet summary of what needs follow-up today."
```

---

## 6. Pipeline 3 — LeetCode Sync

### Setup (15 minutes, fully automatic after)

**Option A — VS Code (recommended):**
1. Install "Leetnotion" extension from VS Code Marketplace
2. Duplicate the LeetNotion Notion template (link in extension README)
3. Create a Notion internal integration: notion.so/my-integrations → New integration → copy API key
4. In VS Code extension settings: paste Notion API key + Database ID
5. Solve one problem and submit → verify it appears in Notion

**Option B — Browser:**
1. Install LeetNotion Sync from Chrome Web Store or Firefox Add-ons
2. Same Notion template and API key setup via the in-extension wizard

**Both are fully free, no limits.**

### What auto-logs on each accepted submission:
- Problem title + LC number
- Difficulty (Easy/Medium/Hard)
- Topic tags (Array, DP, Graph, Tree, Sliding Window, etc.)
- Your solution code (full code block)
- Submission timestamp → Solved Date
- Status: Solved

### Spaced repetition view setup in Notion

Create a filtered view "Due for Review" with filter: `Review Date ≤ Today AND Status = Solved`. This becomes your daily LC review queue — no external tool needed.

---

## 7. Pipeline 4 — Weekly Summary Agent

### Tool: Cowork scheduled task (replaces Gumloop weekly summary flow)

This moved from Gumloop to Cowork because the 1 active trigger is used for email. Cowork is actually better here anyway — it can read multiple Notion databases in one session and produce a document, which Gumloop would need multiple nodes to approximate.

**Constraint:** Requires laptop to be on Sunday evening. If reliability matters, keep a Gumloop scheduled flow as backup (no trigger needed for scheduled flows — the 1-trigger limit applies to event-based triggers like "new email", not time-based schedules). Worth verifying this in Gumloop's UI.

```
Cowork scheduled: Sunday 8pm
"Read my Notion Contacts DB — all rows where Last Interaction 
was this week. Read Applications DB — all stage changes this week.
Read LC Problems DB — all problems solved this week.

Write a 1-page recruiting memo:
Section 1: Week in numbers (calls, contacts, emails, LC problems)
Section 2: Hot items (urgency HIGH, offers, upcoming interviews)
Section 3: Ghosted — who hasn't responded in 14+ days
Section 4: LC progress — topics covered, review queue size, weakest area
Section 5: Priority actions for next week (max 5, ranked)

Save as 'Recruiting Memo — Week of [date].md' in my Recruiting/Memos folder.
Send to my email."
```

---

## 8. The Inbox Signal Dashboard (Claude Artifact)

The React dashboard built in this project (recruiting-dashboard.jsx) reads Gmail live via MCP and classifies recruiting emails. It runs inside Claude.ai — no hosting required.

**Current capability:**
- Scans Gmail for recruiting threads from past 45 days
- Classifies by status: REPLY / INTERVIEW / OFFER / REJECTED / WAITING / GHOSTED / FOLLOW UP
- Shows urgency, days since contact, summary, next action, pre-drafted follow-up
- Filter by status, search by name/company/role
- Signal bar shows pipeline health at a glance

**Complements (not replaces) Gumloop:** Gumloop writes to Notion in real-time as emails arrive. The dashboard is for your periodic review — open it when you want a full picture, not constantly.

**Future enhancement:** Add a Notion API query to pull call history per contact and merge it into each email card for richer context.

---

## 9. Cowork Usage Guide — When & What

Cowork absorbed most of what was originally Gumloop Flows 2-6. It's better suited for these tasks anyway: judgment-heavy, reads multiple sources, produces finished deliverables.

### Use Cowork for

| Task | Cadence | Notes |
|---|---|---|
| Process Granola call summary → Notion | After each call (on-demand) | 2 min task |
| Daily recruiting brief (follow-ups due, urgent emails) | 9am weekdays (scheduled) | Requires laptop on |
| Weekly recruiting memo | Sunday 8pm (scheduled) | Requires laptop on |
| Contact enrichment via Exa (batch) | Weekly on-demand | "Enrich all contacts added this week" |
| Pre-call prep brief | 30 min before each call (on-demand) | Reads Notion + Exa |
| Post-season audit | End of recruiting season | Full analysis |
| Build call_recorder.py if needed | One-time | Only if you choose Deepgram path later |
| Set up Notion databases from schema | One-time setup | Read this doc, create via API |

### Do NOT use Cowork for

- The email pipeline — that's Gumloop's 1 trigger (always-on, cloud-based, reliable)
- LeetCode sync — LeetNotion handles this automatically
- The Inbox Signal dashboard — that's a Claude artifact

### Cowork project setup

Create one project: **"Recruiting OS"**

**Share with Cowork:**
- `/transcripts/` folder (any Granola exports or manual notes)
- `/jds/` folder (downloaded job descriptions as PDFs)
- This build plan document
- `context.md` with your personal info:

```markdown
# context.md
Name: the candidate
School: a university, CS-LSA, Sophomore, a strong GPA
Graduating: May 2028
Target roles: SWE internship, PM internship
Notion workspace URL: [paste your Notion workspace URL]
Recruiting season: Fall 2026 (apps open August)
```

**Connectors to enable:** Gmail, Google Drive, Google Calendar, Notion

---

## 10. Subagent Split Plan

### Subagent Split 1: New Contact Processing (Cowork, on-demand)

When processing a new contact after a Granola call:

```
Cowork session: "Process this contact: [Name] at [Company]"
        │
   ┌────┴──────────┬──────────────┐
   ▼               ▼              ▼
Exa: search    Notion: check   Claude: write
LinkedIn +     if contact      context brief
company info   already exists  from available
                               info
   └────┬──────────┴──────────────┘
        ▼
  Write to Notion Contacts DB
```

### Subagent Split 2: Email Batch in Gumloop

The email pipeline already processes emails sequentially. If volume spikes (20+ emails in a day), Gumloop handles concurrency automatically within the 2 concurrent runs limit on free tier.

### Subagent Split 3: Weekly Memo Parallel Data Gather (Cowork)

```
Cowork weekly memo session
        │
   ┌────┴──────┬──────────┬──────┐
   ▼           ▼          ▼      ▼
Contacts    Applications  LC     Calendar
DB query    DB query      query  query
   └────┬──────┴──────────┴──────┘
        ▼
  Synthesize → write memo → email
```

### Model allocation

| Task | Model | Why |
|---|---|---|
| Email type classification | Haiku | Binary classification, cheap |
| Email data extraction | Sonnet via BYOK | Quality JSON extraction |
| Call summary extraction | Sonnet via BYOK | Complex narrative parsing |
| Follow-up draft | Sonnet | Writing quality matters |
| Weekly memo synthesis | Sonnet (Cowork) | Complex multi-source synthesis |
| Contact brief | Sonnet (Cowork) | Judgment-heavy |
| LC pattern tagging | Haiku | Simple categorization |

---

## 11. Build Sequence & Timeline

### Phase 1 — Notion Foundation (Day 1, ~2 hours)

1. Create Notion account if needed (free)
2. Create 4 databases with schema from Section 3 — or use Cowork: "Read my build plan and create these 4 Notion databases via the Notion API"
3. Create Notion internal integration (notion.so/my-integrations) → copy API key
4. Share each database with the integration
5. Test: manually add one row to Contacts DB

**Deliverable:** Notion hub ready to receive data

### Phase 2 — LeetCode Sync (Day 1, ~15 minutes)

1. Install LeetNotion VS Code extension from VS Code Marketplace
2. Duplicate LeetNotion Notion template — use this as your LC Problems DB
3. Add Notion API key + Database ID to extension settings
4. Optional: install LeetNotion Sync Chrome extension as backup
5. Solve one practice problem → verify it appears in Notion

**Deliverable:** Every LC solve auto-logs to Notion. Zero ongoing effort.

### Phase 3 — Granola Setup (Day 1, ~10 minutes)

1. Download Granola from granola.ai (Mac or Windows)
2. Connect Google Calendar
3. Join a test Zoom call → start recording → verify transcript and summary generate
4. Note: on free plan, notes accessible for 30 days only

**Deliverable:** Every call captured with no bot, full transcript and AI summary

### Phase 4 — Email Pipeline (Day 2, ~3 hours)

1. Create Gmail filter (copy syntax from Section 5 exactly)
2. Create Gumloop account — log into YC deals portal and activate the Gumloop deal
3. In Gumloop Pro settings: add Anthropic API key under BYOK (your $500 YC credit key)
4. Build Flow 1: "Email Intelligence"
   - Trigger: Gmail new labeled email (recruiting)
   - Node 2: Claude Haiku classify
   - Node 3: Filter — stop if UNRELATED
   - Node 4: Claude Sonnet via BYOK — extract JSON
   - Node 5: Notion MCP — upsert contact
   - Node 6: Notion MCP — update Applications DB
   - Node 7: Conditional — if interview_date → Google Calendar event
5. Test: send yourself a mock "We'd like to schedule an interview" email, verify it creates a Notion contact row

**Deliverable:** All recruiting emails auto-update Notion contacts and applications in real-time

**Cost check:** If YC Gumloop deal unlocks Pro tier, BYOK is available immediately. If it only gives credits on free tier, you have 1 trigger and limited credits — either use Haiku only (saves credits) or decide if $37/month Pro is worth it for the email automation.

### Phase 5 — Inbox Signal Dashboard (Day 2, ~10 minutes)

1. Open the recruiting-dashboard.jsx artifact in Claude.ai
2. Verify Gmail MCP is connected (Settings → Connectors)
3. Hit "Scan Inbox" — confirm it reads and classifies your emails

**Deliverable:** On-demand email intelligence view

### Phase 6 — Cowork Setup (Day 3, ~1 hour)

1. Download Claude Desktop (claude.ai/download)
2. Open Cowork mode
3. Create project "Recruiting OS"
4. Share folders: transcripts, JDs, this build plan
5. Enable connectors: Gmail, Google Drive, Google Calendar, Notion
6. Create context.md with your info
7. Set up 2 scheduled tasks (daily 9am brief + Sunday 8pm memo)
8. Test: run the daily brief manually

**Deliverable:** Scheduled daily brief and weekly memo. Cowork ready for call processing.

### Phase 7 — Call Processing Workflow (Day 3, ~30 minutes)

Create a Cowork skill/template for call processing:

```
Cowork task template: "Process Call"
Input: [paste Granola summary here]

Instructions:
"Extract structured data from this call summary. Create or update 
the contact in my Notion Contacts DB. Create a new Calls DB row 
linked to that contact. Write a follow-up email draft. 
Create a Google Calendar reminder in 3 days titled 
'Follow up with [Name] re: [Company]'."
```

Save this as a Cowork skill so it's one-click after each call.

**Deliverable:** 2-minute post-call workflow that populates Notion completely

### Phase 8 — Exa Enrichment (Day 4, ~30 minutes)

1. In Cowork, add Exa as a connected tool (if not already available)
2. Test: "Find the LinkedIn profile and current role for [Name] at [Company]"
3. Create a weekly Cowork task: "Enrich all Contacts DB rows where 'Exa Enriched' is unchecked — search Exa for each, write LinkedIn URL back to Notion, check the box"

**Deliverable:** Weekly batch enrichment of all new contacts

---

## 12. Integration Map

```
TOOL              CONNECTS TO          VIA                    DIRECTION
────              ────────────         ───                    ─────────
Gmail             Gumloop              Native trigger         → read
Gmail             Cowork               MCP connector          → read
Gmail             Inbox Dashboard      MCP (via Claude)       → read
Gumloop           Gmail                Native action          → send
Gumloop           Claude API           BYOK (Anthropic key)   → call
Gumloop           Notion               MCP node               ↔ read/write
Gumloop           Exa                  Native MCP             → call
Gumloop           Google Calendar      Native action          → write
Granola           System audio         Local driver           → capture
Granola           Google Calendar      Native integration     → detect
Granola           Notion               Paid only ($14/mo)     → write
LeetNotion ext.   Notion API           Direct API call        → write
LeetNotion ext.   LeetCode.com         Browser hook           → read
Cowork            Notion               MCP connector          ↔ read/write
Cowork            Gmail                MCP connector          → read
Cowork            Google Drive         MCP connector          ↔ read/write
Cowork            Google Calendar      MCP connector          → write
Cowork            Exa                  Native tool            → search
Cowork            Claude API           Built-in               → call
Inbox Dashboard   Claude API           Anthropic API          → call
Inbox Dashboard   Gmail                MCP (via Claude)       → read
```

---

## 13. Cost & Credit Accounting

### YC Stack — Confirmed Amounts

| Tool | Amount | Source |
|---|---|---|
| Anthropic (Claude API) | $500 | Confirmed via YC deals portal |
| OpenAI API | $2,500 | Confirmed |
| Exa | $250 | Confirmed |
| AWS | $10,000 | Confirmed |
| Azure | $10,000 | Confirmed |
| Deepgram | $200 base + YC bonus | Base on signup; YC deal adds more via separate application at deepgram.com/dg-yc-deal |
| Gumloop | Unknown amount, 1 trigger on free | Portal is login-gated; credit amount not publicly disclosed — check your portal |
| Vapi, Firecrawl, Roboflow, others | Unknown | Login-gated |

**Not in the YC stack:** Granola, Fireflies, Otter, Notion, LeetNotion.

### Monthly Cost Breakdown (honest)

| Item | Cost | Notes |
|---|---|---|
| Claude Pro (Cowork) | $20/month | Required for Cowork |
| Gumloop Pro (if needed) | $37/month | Only if YC deal doesn't unlock Pro tier OR you want BYOK |
| Granola Business (optional) | $14/month | Only if you want auto-Notion push from calls |
| Notion Plus (optional) | $10/month | Only if you want native database automations |
| Everything else | $0 | Covered by YC credits |

**Minimum:** $20/month (Claude Pro for Cowork only)  
**Comfortable:** $20 + $37 = $57/month (adds always-on Gumloop email pipeline with BYOK)  
**Full automation:** $20 + $37 + $14 = $71/month (adds Granola auto-push to Notion)

### Burn Rate on $500 Anthropic Credit

With BYOK in Gumloop, all Claude API calls route through your Anthropic credit:

- Email classification (Haiku): ~$0.0001/email
- Email extraction (Sonnet): ~$0.003/email  
- Call summary extraction (Sonnet): ~$0.015/call
- Weekly memo (Sonnet, Cowork): ~$0.05/memo

At 10 emails/day + 3 calls/week + 1 memo/week:
`(10 × 0.003 × 365) + (3 × 0.015 × 52) + (0.05 × 52)` = `$10.95 + $2.34 + $2.60` = **~$16/year**

$500 covers this system for ~31 years. Not a concern.

### Deepgram Credit (Save for later)

$200+ in Deepgram credits is not needed for the Granola-based call pipeline. Bank it. If you later build a real-time voice app, a call analytics tool, or decide to automate the call pipeline fully (streaming audio → instant Notion write), Deepgram is the right tool then.

---

## Appendix A — Claude Prompts

### Email Classification (Haiku, 2 Gumloop credits)
```
You are a recruiting email classifier. Given this email, output ONLY one label:
REPLY | INTERVIEW_INVITE | OFFER | REJECTION | NEW_CONTACT | FOLLOW_UP_NEEDED | UNRELATED

REPLY = they responded to me and conversation is active
INTERVIEW_INVITE = scheduling an interview
OFFER = extending a job or internship offer
REJECTION = declining my application
NEW_CONTACT = recruiter or professional reaching out cold
FOLLOW_UP_NEEDED = I need to respond or follow up
UNRELATED = not recruiting-related

Subject: {subject}
From: {sender}
Body (first 400 chars): {body_preview}
```

### Email Extraction (Sonnet via BYOK, 0 Gumloop credits)
```
Extract recruiting data from this email. Return ONLY valid JSON, no explanation, no markdown.

{
  "contact_name": "string",
  "contact_email": "string",
  "company": "string",
  "role": "string or null",
  "email_type": "REPLY|INTERVIEW_INVITE|OFFER|REJECTION|NEW_CONTACT",
  "summary": "2-sentence summary",
  "urgency": "HIGH|MED|LOW",
  "next_action": "specific action to take next",
  "follow_up_draft": "3-sentence draft reply or null",
  "interview_date": "ISO date string or null",
  "interview_format": "phone|video|onsite|null"
}

Subject: {subject}
From: {sender_name} <{sender_email}>
Date: {date}
Body: {full_body}
```

### Call Processing (Sonnet, Cowork — paste Granola summary)
```
Process this recruiting call summary. Extract structured data and 
create the Notion entries described. Return the JSON first, then confirm 
each Notion action you took.

Extract:
{
  "contact_name": "string",
  "contact_company": "string",
  "contact_role": "string",
  "contact_email": "string or null",
  "call_type": "coffee_chat|recruiter_screen|technical|networking|referral",
  "summary": "3-sentence summary",
  "key_insights": "what they shared about company/role/process",
  "what_they_offered": "referrals, intros, help offered — or null",
  "my_commitments": "what I said I'd do",
  "follow_up_date": "3 days from today as ISO date",
  "follow_up_draft": "3-4 sentence thank you + next step email",
  "sentiment": "positive|neutral|negative"
}

Call Summary:
{paste Granola summary here}
```

---

## Appendix B — Gumloop Flow (the one that matters)

### Flow 1: Email Intelligence — Real-Time

```
Trigger: Gmail — New email with label "recruiting"
  │
  ├─ Node 1: Gmail Reader (read email body, subject, sender)
  │
  ├─ Node 2: Claude Haiku — classify email type
  │           [2 Gumloop credits]
  │
  ├─ Node 3: Filter — if type == UNRELATED, stop flow
  │           [1 credit]
  │
  ├─ Node 4: Claude Sonnet via BYOK — extract structured JSON
  │           [0 Gumloop credits, uses Anthropic credit ~$0.003]
  │
  ├─ Node 5: Notion MCP — search Contacts DB by email
  │   ├─ If found: update Last Interaction, Urgency, follow-up date
  │   └─ If not found: create new contact row
  │           [1-2 credits]
  │
  ├─ Node 6: Notion MCP — update Applications DB stage
  │           (only if email is about a specific application)
  │           [1 credit]
  │
  └─ Node 7: Conditional — if interview_date not null
              → Google Calendar: create interview event
              [1 credit]

Total per email (with BYOK): ~6 Gumloop credits
Monthly at 10 emails/day: ~1,800 credits (within 5k free tier)
```

---

## Appendix C — Cowork Scheduled Tasks

```
Task 1: Daily Morning Brief (9am weekdays — requires laptop on)

"Check my Notion Contacts DB for any rows where Follow-Up Date = today.
Check Gmail for unread recruiting emails from the last 12 hours that 
haven't been replied to.
Check Notion Applications DB for any rows where Days in Stage > 14 
and Stage is Applied or Phone Screen — these are ghosted.

Write exactly 3 bullets:
1. Who to follow up with today (names + what for)
2. Any new recruiting emails that need a reply
3. Any applications that have gone silent for 2+ weeks

Send to my email. Keep it under 150 words total."


Task 2: Weekly Recruiting Memo (Sunday 8pm — requires laptop on)

"Read my Notion Contacts DB — all rows where Last Interaction 
was in the past 7 days.
Read Notion Applications DB — all rows with stage changes this week.
Read Notion LC Problems DB — all rows where Solved Date is this week.

Write a 1-page recruiting memo with 5 sections:
1. Week in numbers: calls made, new contacts, emails processed, LC problems solved
2. Hot right now: urgency HIGH contacts, pending offers, upcoming interviews
3. Going cold: contacts not reached in 14+ days, ghosted applications
4. LC this week: topics covered, review queue size, weakest pattern area
5. Next week priorities: max 5 actions, ranked by importance

Save as 'Recruiting Memo — Week of [Monday date].md' 
in my Recruiting/Memos folder on Google Drive.
Send me a copy by email."


Task 3: Pre-Call Brief (on-demand, 30 min before a call)

"I have a call with [Name] at [Company] in 30 minutes.

1. Read their row in my Notion Contacts DB
2. Read any linked Calls DB entries (past conversations)
3. Search Exa for recent news about [Company] (last 3 months)
4. Search Exa for [Name]'s LinkedIn or public profile

Write a 5-bullet brief:
- Who they are and their role
- What we've talked about before (if anything)
- Recent company context that's worth knowing
- 3 questions I should ask in this call
- My goal for this call based on their status in my system"


Task 4: Weekly Contact Enrichment (on-demand, weekly)

"Query my Notion Contacts DB for all rows where 'Exa Enriched' 
checkbox is unchecked.

For each contact: search Exa for '[Name] [Company] LinkedIn'.
Write their LinkedIn URL back to the LinkedIn property in Notion.
Check the 'Exa Enriched' box.

Tell me how many you enriched and flag any you couldn't find."
```

---

## Appendix D — What We Decided Against and Why

| Tool | Considered | Decision | Reason |
|---|---|---|---|
| Fireflies | Call transcription | ❌ Not used | Bot joins your Zoom visibly; no YC deal |
| Otter.ai | Call transcription | ❌ Not used | Bot-based; not in YC stack; Granola does same job better |
| Deepgram (as primary) | Call transcription | ❌ Saved for later | 6-8h setup for same outcome Granola does in 5 min. Keep credits for future project. |
| Gumloop (6 flows) | Full automation | ⚠️ Reduced to 1 flow | Free tier = 1 active trigger. Other flows moved to Cowork. |
| Notion native automations | Follow-up reminders | ❌ Requires paid plan | Free plan can't create automations. Cowork morning brief replaces this. |
| Zapier | Automation | ❌ Not used | Gumloop is in YC stack and more AI-native. Zapier for simple triggers only if Gumloop fails. |
| Granola Business ($14/mo) | Auto-Notion push from calls | ⚠️ Optional upgrade | Free plan works with one manual copy-paste per call. Upgrade when doing 3+ calls/week consistently. |
