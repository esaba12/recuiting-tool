# Phase 7 — Call Processing Workflow

**Branch:** `cowork-setup` (worktree at `.worktrees/cowork-setup/`)  
**Time:** ~30 minutes  
**Day:** Day 3 (after Phase 6)  
**Deliverable:** 2-minute post-call workflow that populates Notion completely from a Granola summary

---

## What You're Building

A repeatable workflow for after every recruiting call. This is the only pipeline that requires a manual step (copy Granola summary → paste into Cowork). The goal is to make that step as frictionless as possible.

Total time after a call: ~2 minutes.

---

## The Full Call-to-Notion Flow

```
Call ends
    │
    ▼ (1 min — Granola generates automatically)
Granola summary appears
    │
    ▼ (20 sec — you do this)
Copy summary → open Cowork "Recruiting OS" project
→ click "Process Call" saved prompt
→ paste Granola summary
→ send
    │
    ▼ (30-60 sec — Cowork does this)
Claude extracts structured JSON from summary
Cowork searches Contacts DB for contact name
    ├─ If found: updates Last Interaction, Urgency, appends call link
    └─ If not found: creates new contact row
Cowork creates new Calls DB row linked to contact
Cowork writes follow-up email draft to Calls DB
Cowork creates Google Calendar reminder: "Follow up with [Name] re: [Company]" (3 days out)
    │
    ▼
Review the output in Cowork
Copy the follow-up draft to your email client (Gmail) when you're ready to send
```

---

## Prerequisites

- Phase 6 complete — Cowork "Recruiting OS" project set up with connectors
- Phase 3 complete — Granola installed and tested
- Phase 1 complete — Contacts DB and Calls DB exist in Notion

---

## Step 1: Test with a Real Granola Summary

After your next recruiting call:
1. Let Granola generate the summary (takes 1-2 minutes after hanging up)
2. In Granola, click "Copy Summary"
3. Open Claude Desktop → Recruiting OS project
4. Click the "Process Call" saved prompt (or type it)
5. Paste the Granola summary
6. Send

**Expected Cowork output:**
1. The extracted JSON (review for accuracy)
2. Confirmation: "Created new contact: [Name] at [Company]" or "Updated existing contact: [Name]"
3. Confirmation: "Created Calls DB row: [Title]"
4. The follow-up email draft (3-4 sentences)
5. Confirmation: "Created Calendar event: Follow up with [Name] re: [Company] on [date]"

---

## What Gets Extracted from the Granola Summary

Cowork uses the prompt from `cowork/process-call.md` to extract:

```json
{
  "contact_name": "full name",
  "contact_company": "employer",
  "contact_role": "their title",
  "contact_email": "email if mentioned — or null",
  "call_type": "coffee_chat|recruiter_screen|technical|networking|referral",
  "summary": "3-sentence summary of the call",
  "key_insights": "what they shared about company/role/process",
  "what_they_offered": "referrals, intros, help offered — or null",
  "my_commitments": "what I said I'd do",
  "follow_up_date": "3 days from today",
  "follow_up_draft": "3-4 sentence thank you + next step email",
  "sentiment": "positive|neutral|negative"
}
```

---

## Step 2: Calibrate the Follow-Up Draft Quality

The first few follow-up drafts may be too generic or too long. After your first real call, read the draft and note what needs improving.

Common adjustments to the prompt:
- "Match my voice — informal, not corporate"
- "Reference the specific thing they offered (referral, intro, etc.) not just 'our conversation'"
- "Keep it under 100 words"
- "Always end with a specific ask, not just 'looking forward to staying in touch'"

Update the prompt in `cowork/process-call.md` and re-save the Cowork skill.

---

## Step 3: Handle the Contact Already Exists Case

If the contact already exists in Notion (you've spoken before):

Cowork's search finds their row by name. It should:
- Update `Last Interaction` to today
- NOT overwrite existing notes or status
- Append the new call as a linked Calls DB row (not replace old calls)

Verify this works correctly in your first real test. If Cowork overwrites the contact instead of updating it, add this to the prompt: "If the contact already exists, UPDATE their row — do not create a duplicate. Preserve existing notes and Status. Only update Last Interaction and add the new linked Calls row."

---

## Step 4: What to Do with the Follow-Up Email Draft

Cowork writes the follow-up draft to the `Follow-Up Draft` field in the Calls DB row. When you're ready to send:

1. Open Notion → Calls DB → find the call
2. Copy the text from "Follow-Up Draft"
3. Open Gmail → compose
4. Address to the contact's email
5. Paste and edit as needed
6. Send

In Phase 4 (email pipeline), when they reply, Gumloop auto-processes their response and updates the contact.

**Future automation:** If you upgrade to Granola Business + Notion automations (paid), this step could be: Granola auto-pushes to Notion → trigger emails a draft to Gmail Drafts folder → you just review and send. At $14/mo + $10/mo = $24 more/month, worth it after 2+ calls/week consistently.

---

## Step 5: Save Granola Export Before 30 Days

If you want to keep transcripts longer than 30 days (Granola's free tier limit):

1. In Granola: open the meeting → Export → Markdown
2. Save to `transcripts/[Name]-[Company]-[Date].md` in this repo
3. Cowork project has access to the transcripts/ folder — future enrichment tasks can reference these

This is optional but good practice for important calls (coffee chats with champions, offers, etc.).

---

## The Complete Workflow Card (Print or Bookmark)

```
AFTER EVERY CALL:
1. Wait 1-2 min for Granola to generate summary
2. Granola → Copy Summary
3. Claude Desktop → Recruiting OS → Process Call → paste summary → send
4. Review extracted JSON and follow-up draft (30 seconds)
5. Done. Notion is updated. Calendar reminder set.

WHEN READY TO SEND FOLLOW-UP:
6. Notion → Calls DB → find the call → copy Follow-Up Draft
7. Gmail → compose → paste → edit if needed → send
```

---

## Deliverable Checklist

- [ ] "Process Call" Cowork skill/template saved with correct prompt
- [ ] End-to-end test with a real Granola summary completed
- [ ] Contact created or updated correctly in Notion Contacts DB
- [ ] Calls DB row created with correct title format: "[Name] @ [Company] — [Date]"
- [ ] Follow-up email draft is in the Calls DB row
- [ ] Google Calendar reminder created 3 days out
- [ ] Verified: existing contact update doesn't overwrite notes/status
- [ ] Follow-up draft quality acceptable (adjusted prompt if needed)
- [ ] transcripts/ folder created in repo for optional exports

---

## What Comes Next

Phase 8 (Exa Enrichment) — the final piece. Sets up weekly batch enrichment to auto-fill LinkedIn URLs for new contacts. Takes 30 minutes and then runs weekly.
