# Phase 5 — Inbox Signal Dashboard

**Branch:** `dashboard` (worktree at `.worktrees/dashboard/`)  
**Time:** ~10 minutes setup + active development  
**Day:** Day 2  
**Deliverable:** On-demand email intelligence view — a React dashboard that reads Gmail and classifies recruiting emails

---

## What You're Building

A React dashboard that lives as a Claude artifact (runs inside Claude.ai — no hosting, no deployment). It reads your Gmail via the Gmail MCP connector and classifies recruiting threads from the past 45 days.

**This complements the Gumloop pipeline** — Gumloop writes to Notion in real-time as emails arrive. The dashboard is for periodic review: open it when you want a full picture of your pipeline health, not constantly.

---

## How It Works

```
You open Claude.ai
→ Open the recruiting-dashboard.jsx artifact
→ Click "Scan Inbox"
→ Dashboard reads Gmail via MCP (Claude's Gmail connector)
→ Claude API classifies each thread: REPLY / INTERVIEW / OFFER / REJECTED / WAITING / GHOSTED / FOLLOW UP
→ Displays cards sorted by urgency with pre-drafted follow-ups
```

No server. No hosting. Claude.ai runs the artifact in a sandboxed React environment. The Gmail MCP runs server-side through Anthropic's infrastructure.

---

## Prerequisites

- Claude Pro account ($20/month — you have this for Cowork)
- Gmail MCP connector enabled in Claude.ai settings
- The dashboard code (in `dashboard/recruiting-dashboard.jsx`)

---

## Step 1: Enable Gmail Connector in Claude.ai

1. Go to claude.ai → Settings (or click your profile icon)
2. Find "Connectors" or "Integrations"
3. Enable "Gmail" → authenticate with your Google account
4. Grant the scopes it requests (read access to Gmail is required)

---

## Step 2: Open the Dashboard in Claude.ai

Two ways to use the dashboard:

**Option A — Artifact in a chat:**
1. Open a new Claude.ai chat
2. Share the dashboard code (or paste it) and say: "Run this React component as an artifact"
3. Claude renders it in the artifact panel on the right
4. Click "Scan Inbox" in the dashboard

**Option B — Claude Projects (recommended):**
1. Create a Claude Project: "Recruiting OS"
2. Add the dashboard.jsx file to the project
3. Add context.md to the project
4. Each conversation in this project automatically has access to the dashboard code and your context

---

## What the Dashboard Shows

After scanning:

**Signal Bar (top):** 
A single health meter showing your pipeline balance. Green = lots of warm conversations, red = too many ghosted threads.

**Email Cards (main view):**
One card per recruiting thread with:
- Company + Role + Contact name
- Status classification: REPLY / INTERVIEW / OFFER / REJECTED / WAITING / GHOSTED / FOLLOW UP
- Days since last contact
- 2-sentence summary of where things stand
- Next action recommendation
- Pre-drafted follow-up email (expand to view/copy)
- Urgency indicator: HIGH / MED / LOW

**Filter controls:**
- Filter by status (show only WAITING, or only INTERVIEW, etc.)
- Search by company/name/role
- Sort by urgency or days since contact

---

## What the Dashboard Does NOT Do

- It does NOT write to Notion — that's Gumloop's job
- It does NOT send emails — you copy the draft and send manually (or use it as a starting point)
- It does NOT run continuously — you open it when you want a check-in
- It does NOT replace Gumloop — Gumloop writes data in real-time; the dashboard reads Gmail directly for on-demand review

---

## Relationship with Gumloop

**Gumloop:** Processes emails as they arrive (event-driven). Best for real-time Notion writes and Calendar events. Always running in the cloud.

**Dashboard:** On-demand view for your periodic review sessions. Better UI. Reads directly from Gmail so it captures threads that Gumloop might have missed (e.g., emails labeled before Gumloop was set up). Use it for your weekly check-ins or when you want a full picture before a recruiting week.

---

## Future Enhancement

Once you want richer context in the dashboard: add a Notion API query to pull each contact's call history and application stage, and merge it into the email card. This gives you a complete picture — not just "I got this email" but "I've talked to this person twice, they promised a referral, and here's the last thing they said."

The architecture for this is: dashboard sends a query to Notion API → gets linked Calls DB rows per contact → renders them in an expanded card view.

---

## Deliverable Checklist

- [ ] Gmail connector enabled in Claude.ai
- [ ] `dashboard/recruiting-dashboard.jsx` file exists in this repo
- [ ] Dashboard opens in Claude.ai and renders without errors
- [ ] "Scan Inbox" reads real Gmail data and classifies at least a few threads
- [ ] Status filters work
- [ ] Pre-drafted follow-ups are visible

---

## What Comes Next

Phase 6 (Cowork Setup) — the final infrastructure piece. Sets up your daily brief, weekly memo, and the call processing workflow.
