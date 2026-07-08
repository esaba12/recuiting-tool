# Phase 6 — Cowork Setup

**Branch:** `cowork-setup` (worktree at `.worktrees/cowork-setup/`)  
**Time:** ~1 hour  
**Day:** Day 3  
**Deliverable:** Scheduled daily brief and weekly memo running. Cowork ready for call processing.

---

## What You're Building

Cowork (Claude Desktop's project/task mode) handles everything that doesn't fit in Gumloop's single trigger. Specifically:
- **Daily brief** at 9am — who to follow up with, ghosted applications, urgent emails
- **Weekly memo** Sunday 8pm — full recruiting summary sent to your email
- **On-demand call processing** — paste Granola summary → Cowork writes to Notion
- **On-demand contact enrichment** — batch Exa lookup for unchecked contacts

Cowork is better than Gumloop for these tasks because it can read multiple data sources in one session, exercise judgment, and produce finished deliverables (memos, drafts) — not just write structured data.

---

## Critical Constraint

**Cowork's scheduled tasks only run when your laptop is on and Claude Desktop is open.** If your laptop is off at 9am, the daily brief doesn't run. This is a real limitation.

Workaround options:
1. Keep your laptop on a charger overnight (scheduled tasks run early morning)
2. For the weekly memo: keep Gumloop as a backup (Gumloop's scheduled flows are cloud-based and don't need a trigger — the 1-trigger limit only applies to event-based triggers like "new email"). Worth verifying in Gumloop's UI whether scheduled flows count against the trigger limit.

---

## Prerequisites

- Claude Pro ($20/month) — required for Cowork
- Claude Desktop downloaded (claude.ai/download)
- Phase 1 complete — Notion databases and API key ready
- Phase 4 complete — Gmail connected
- Google Calendar and Google Drive accounts

---

## Step 1: Download Claude Desktop

Go to claude.ai/download → download for Mac or Windows → install.

Sign in with your Claude Pro account (the same account you use on claude.ai).

---

## Step 2: Open Cowork Mode

In Claude Desktop: look for the "Projects" tab or the Cowork button (UI may vary). Create a new project: **"Recruiting OS"**.

---

## Step 3: Enable Connectors

In the Recruiting OS project settings, enable:
- **Gmail** — OAuth connect your Google account
- **Google Drive** — needed to save the weekly memo as a .md file
- **Google Calendar** — needed for the pre-call brief and call processing follow-up events
- **Notion** — Notion MCP connector; paste your Notion API key when prompted

Verify each connector shows "Connected" status.

---

## Step 4: Add Project Files

In the Cowork project, share these files/folders:
- `context.md` (from this repo — has your personal info and DB IDs)
- The `master-build-plan.md` (so Cowork knows the system design)
- `transcripts/` folder (create it at the repo root) — for Granola exports
- `jds/` folder (create it at the repo root) — for job description PDFs

Cowork will read these files when processing requests in this project.

---

## Step 5: Set Up Scheduled Tasks

### Task 1: Daily Morning Brief (9am weekdays)

In Cowork → Scheduled Tasks → New Task:
- **Name:** Daily Recruiting Brief
- **Schedule:** 9am, Monday-Friday
- **Prompt:** (copy from `cowork/daily-brief.md`)

The brief checks:
1. Notion Contacts DB: any contacts where Follow-Up Date = today
2. Gmail: any unread recruiting emails from the last 12 hours without a reply
3. Notion Applications DB: any applications where Days in Stage > 14 and Stage is Applied or Phone Screen (these are ghosted)

Output: exactly 3 bullets, under 150 words, emailed to you.

### Task 2: Weekly Recruiting Memo (Sunday 8pm)

In Cowork → Scheduled Tasks → New Task:
- **Name:** Weekly Recruiting Memo
- **Schedule:** Sunday, 8pm
- **Prompt:** (copy from `cowork/weekly-memo.md`)

The memo reads all 3 databases (Contacts, Applications, LC Problems) for the past 7 days and synthesizes a 1-page structured memo with 5 sections. Saves to Google Drive + emails to you.

---

## Step 6: Create the Call Processing Template

This is an on-demand task you'll use after every call with Granola.

In Cowork → create a saved prompt/skill:
- **Name:** Process Call
- **Prompt:** (copy from `cowork/process-call.md`)
- **Usage:** After a call, open Cowork → select "Process Call" → paste your Granola summary → send

What it does:
1. Extracts structured JSON from the summary
2. Searches Contacts DB for the contact (by name)
3. Creates new contact if not found, or updates Last Interaction if found
4. Creates a new Calls DB row linked to the contact
5. Drafts a follow-up email
6. Creates a Google Calendar reminder 3 days out: "Follow up with [Name] re: [Company]"

---

## Step 7: Manually Test the Daily Brief

Don't wait until tomorrow at 9am. Run it manually right now:

In the Cowork "Recruiting OS" project, paste the daily brief prompt and send it. Verify:
- It reads your Notion Contacts DB successfully
- It reads your Gmail successfully
- It reads your Applications DB successfully
- It produces 3 clean bullets in under 150 words

If it errors, debug the connector that's failing. Common issues:
- Notion connector: re-paste API key, re-share databases with integration
- Gmail connector: re-authenticate OAuth
- Applications DB: check that "Days in Stage" formula is working in Notion (it may read as 0 if Applied Date is empty)

---

## Step 8: Test the Weekly Memo Format

Also paste the weekly memo prompt and run it manually. You want to verify the output format before Sunday arrives. It should produce a structured memo with 5 sections. If the output is good, the scheduled task will work.

---

## Deliverable Checklist

- [ ] Claude Desktop installed and signed in
- [ ] Cowork project "Recruiting OS" created
- [ ] Gmail connector enabled and authenticated
- [ ] Google Drive connector enabled
- [ ] Google Calendar connector enabled
- [ ] Notion connector enabled with API key
- [ ] context.md and master-build-plan.md shared with project
- [ ] transcripts/ and jds/ folders created
- [ ] Daily brief scheduled (9am weekdays)
- [ ] Weekly memo scheduled (Sunday 8pm)
- [ ] Call processing template/skill saved
- [ ] Daily brief tested manually — reads Notion and Gmail, outputs 3 bullets
- [ ] Weekly memo tested manually — produces correct 5-section format

---

## What Comes Next

Phase 7 (Call Processing Workflow) — refine the call processing template and do a full end-to-end test with a real Granola summary.

Phase 8 (Exa Enrichment) — set up the weekly contact enrichment task.
