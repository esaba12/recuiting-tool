# Phase 3 — Granola Setup (Call Transcription)

**Branch:** `main`  
**Time:** ~10 minutes  
**Day:** Day 1  
**Deliverable:** Every call captured with full transcript and AI summary — no bot, no terminal, no setup beyond this

---

## What You're Building

Granola is a desktop app that detects your upcoming calls from Google Calendar and records them using your Mac's system audio — invisible to everyone on the call. When the call ends, it generates a full transcript and an AI summary with action items.

**What Granola replaces:** The Deepgram + BlackHole + Python approach in the original plan. Same outcome, 5-minute setup instead of 6-8 hours.

---

## Prerequisites

- Mac or Windows computer (Granola requires a desktop app — no web version)
- Google Calendar connected to your Zoom/Google Meet (so Granola can detect meetings)
- That's it.

---

## Step 1: Download and Install Granola

Go to granola.ai → Download for Mac (or Windows). Install the app.

You'll create an account with your Google or personal email.

---

## Step 2: Connect Google Calendar

On first launch, Granola asks to connect your calendar. Grant access. It needs calendar access to:
- Auto-detect when you have a Zoom/Meet call coming up
- Pre-populate meeting context (title, attendees) into the notes

If you use multiple Google accounts, connect the one where your recruiting calls are scheduled.

---

## Step 3: Test with a Real or Practice Call

Before your first real recruiting call, do one test:

1. Create a test Google Calendar event for "Test Call" starting in 5 minutes
2. Granola will show a notification: "Test Call is starting — click to record"
3. Click to start recording
4. Join any Zoom call (can be a call with yourself) or just talk for 30 seconds
5. End the call → Granola generates transcript + summary within 1-2 minutes
6. Verify: you can see the full transcript text, and the AI summary includes action items

---

## Step 4: Understand the Free Plan Limits

On free:
- **Unlimited meetings** — no cap on how many calls you record
- **30-day note window** — notes older than 30 days become inaccessible (you can still export before they expire)
- **No auto-Notion push** — Notion integration is Business tier only ($14/mo)
- **What this means for recruiting:** You do all follow-up within 2 weeks anyway. 30 days is plenty.

---

## What Granola Produces After Each Call

When a call ends, Granola generates:

```
1. Full transcript — speaker-labeled text of the entire call
2. AI summary with:
   - Key points discussed
   - Action items (yours and theirs)
   - Decisions made
   - Your typed notes woven in (if you typed anything during the call)
3. Shareable meeting page (optional) — send to the person you called
```

---

## How to Use Granola During a Call

- You can type rough notes in Granola's sidebar while the call is happening
- These notes get woven into the AI summary — Granola merges your notes with the transcript intelligently
- You don't have to type anything — the transcript alone is enough for Claude to process

---

## The Manual Step (What Granola Free Requires)

After each call, you do this once — takes ~2 minutes:

1. Call ends → Granola shows the summary (appears within 1-2 min of hanging up)
2. Click "Copy Summary" (or select all → copy)
3. Paste into Cowork with the prompt from `cowork/process-call.md`
4. Cowork extracts structured data and writes to Notion automatically

That's the only manual step in the entire call pipeline.

---

## Upgrade Path

**Granola Business ($14/month):**
- Adds automatic Notion push — no copy-paste step
- Combined with Notion MCP in Cowork, the call pipeline becomes fully zero-touch
- Worth it if you're doing 3+ recruiting calls per week consistently
- Decision point: track how many calls you do in the first 2 weeks. If consistently 3+, upgrade.

---

## iPhone App (for Coffee Chats)

Granola has an iPhone app for in-person meetings. Useful for:
- Coffee chats where you're not at your computer
- Campus recruiting events
- In-person interviews

The iPhone app records via the phone's microphone and syncs to your account.

---

## Export Before 30 Days (If You Care)

If you want to keep transcripts past 30 days (probably not necessary for recruiting):
1. Open meeting in Granola
2. Export → Markdown or PDF
3. Save to your `transcripts/` folder in this repo

---

## Deliverable Checklist

- [ ] Granola installed on Mac/Windows
- [ ] Google Calendar connected
- [ ] Test call completed → transcript and summary generated
- [ ] Verified: Granola detects meetings from calendar automatically
- [ ] Understand the 1 manual copy-paste step per call

---

## What Comes Next

Phase 7 (Call Processing Workflow) sets up the Cowork template you'll use after each call. For now, Granola is ready. Move to Phase 4 (Email Pipeline) — that's the highest-effort piece.
