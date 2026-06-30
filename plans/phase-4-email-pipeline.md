# Phase 4 — Email Intelligence Pipeline

**Branch:** `email-pipeline` (worktree at `.worktrees/email-pipeline/`)  
**Time:** ~3 hours  
**Day:** Day 2  
**Deliverable:** Every recruiting email automatically creates/updates a Notion contact and application row in real-time

---

## What You're Building

A Gumloop flow that watches your Gmail for recruiting emails and, for each one:
1. Classifies what type of email it is (interview invite, rejection, reply, etc.)
2. Extracts structured data: contact name, company, role, urgency, interview date
3. Creates or updates the contact in your Notion Contacts DB
4. Updates the Applications DB with the current stage
5. Creates a Google Calendar event if an interview date is found

This is **the one Gumloop trigger** you have on the free plan. It is permanently reserved for this flow. All other automations moved to Cowork.

---

## Prerequisites

- Phase 1 complete — Contacts DB and Applications DB exist in Notion with correct schema
- Notion API key and Database IDs saved in context.md
- YC credits activated (Anthropic API key from YC deals portal)
- Gmail account with recruiting emails
- ~3 hours (Gumloop UI takes time to learn on first use)

---

## Step 1: Gmail Filter Setup (~5 minutes)

This filter labels recruiting emails automatically so Gumloop can trigger on them.

In Gmail: Settings (gear) → See all settings → Filters and Blocked Addresses → Create a new filter.

**In the "Matches" field, paste this exactly:**
```
subject:(interview OR "phone screen" OR application OR recruiter OR hiring OR "next steps" OR offer OR internship OR "coffee chat" OR "thank you for applying" OR "moving forward" OR "unfortunately") OR from:(@greenhouse.io OR @lever.co OR @workday.com OR @myworkdayjobs.com)
```

**Actions to apply:**
- Apply label: `recruiting` (create this label if it doesn't exist)
- Do NOT check "Skip Inbox" — you still want to see these in your inbox

Click "Create filter". Also click "Apply to matching conversations" to backfill existing emails.

**Verify:** Check that you have a "recruiting" label in the Gmail sidebar. A few emails should already have it.

---

## Step 2: Create Gumloop Account and Activate YC Deal

1. Go to gumloop.com → Sign up
2. Go to YC deals portal → find the Gumloop deal → activate it
3. The YC deal may give you Pro tier or just additional credits — check what it gives you. This determines whether BYOK (your own Anthropic key for Sonnet) is available.

**If YC gives you Pro tier:** BYOK is immediately available. Proceed to Step 3.

**If YC only gives free-tier credits:** You have 5,000 credits/month. You can still build the flow but Sonnet extraction (Node 4) will cost Gumloop credits at 20 credits/call. At 10 emails/day this overruns the limit. You have two choices:
  - Upgrade to Pro ($37/month) to unlock BYOK → Sonnet calls use your $500 Anthropic credit instead
  - Use Haiku for extraction too (2 credits instead of 20) — cheaper but less precise JSON extraction

Recommendation: Start with the flow built for BYOK. If you can't unlock Pro, swap Node 4 to Haiku temporarily and validate the system works before spending $37/month.

---

## Step 3: Add Anthropic API Key as BYOK

In Gumloop settings (Pro tier required):
1. Settings → API Keys → "Bring Your Own Key"
2. Select "Anthropic"
3. Paste your Anthropic API key from the YC deals portal
4. Save

This routes all Claude API calls in your flows through your $500 YC Anthropic credit instead of Gumloop credits. At ~$0.003/email (Sonnet) × 10 emails/day × 365 days = ~$11/year. The $500 covers 31+ years.

---

## Step 4: Connect Integrations in Gumloop

Before building the flow, connect these in Gumloop's integrations panel:
- **Gmail** — Gumloop needs OAuth access to read emails and watch for new ones
- **Notion MCP** — Gumloop's Notion integration via the MCP node (not the legacy Database Writer — the MCP node supports Relations)
- **Google Calendar** — for creating interview events
- **Exa** (optional now, for future enrichment) — Gumloop has a native Exa MCP integration

---

## Step 5: Build the Email Intelligence Flow

Create a new flow: "Email Intelligence — Recruiting"

### Node 1: Gmail Trigger
- Type: Gmail — New Email
- Filter: Label = "recruiting"
- Outputs: `subject`, `sender_name`, `sender_email`, `body`, `date`, `thread_id`

This is your **1 active trigger**. It fires every time a new email gets the "recruiting" label.

### Node 2: Claude Haiku — Email Classification
- Type: AI (Claude) — use Haiku (2 credits, fast)
- Input: `subject`, `sender_email`, first 400 chars of `body`
- Prompt: (copy from `prompts/email-classification.md`)
- Output: `email_type` (one of: REPLY | INTERVIEW_INVITE | OFFER | REJECTION | NEW_CONTACT | FOLLOW_UP_NEEDED | UNRELATED)

Haiku is the right model here. Classification is a binary/categorical decision — no need for Sonnet's reasoning power. At 2 credits vs 20, it's 10x cheaper.

### Node 3: Filter — Stop if UNRELATED
- Type: Filter / Conditional
- Condition: if `email_type` == "UNRELATED" → stop flow
- Cost: 1 credit

This prevents wasting credits on emails that got the label by accident (e.g., "recruiting" in a completely unrelated subject line).

### Node 4: Claude Sonnet via BYOK — Extract Structured JSON
- Type: AI (Claude) — use Claude Sonnet 4.6 via your BYOK key (0 Gumloop credits)
- Input: full `subject`, `sender_name`, `sender_email`, `date`, full `body`
- Prompt: (copy from `prompts/email-extraction.md`)
- Output: JSON with these fields:
  ```json
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
  ```

Parse the JSON output — Gumloop has a JSON Parser node for this.

### Node 5: Notion MCP — Upsert Contact
- Type: Notion MCP
- Action: Search Contacts DB by `contact_email`
  - If a row with that email exists: **update** Last Interaction (today), Urgency, Status (based on email_type)
  - If no row exists: **create** new row with Name, Company, Role, Email, Source="Email", Status="🟢 Warm", Urgency from extracted JSON

Use the Notion MCP node (not the legacy Database Writer). It supports Relation properties via:
```json
{"Related": {"relation": [{"id": "page-id"}]}}
```

You'll need your Contacts DB ID here (from context.md).

### Node 6: Notion MCP — Update Applications DB
- Type: Notion MCP
- Condition: only run if `email_type` is INTERVIEW_INVITE, OFFER, or REJECTION
- Action: Search Applications DB for a row where Company matches `company`
  - If found: update Stage based on email_type mapping:
    - INTERVIEW_INVITE → "Phone Screen" or "Technical" (based on interview_format)
    - OFFER → "Offer"
    - REJECTION → "Rejected"
    - Update Last Activity to today
  - If not found: create new Applications row with Company, Stage = "Applied", Last Activity = today, Recruiter Contact = linked to the contact created/updated in Node 5

### Node 7: Conditional — Create Calendar Event
- Type: Conditional → if `interview_date` is not null
- Action: Google Calendar — Create Event
  - Title: "Interview: [role] at [company]"
  - Date/time: `interview_date`
  - Duration: 60 minutes default
  - Description: `summary` + link to Notion contact page (if you captured the page ID in Node 5)

---

## Step 6: Test the Flow

Send yourself a mock email from a different email address:

**Test 1 — Interview invite:**
```
Subject: Interview invitation — Software Engineer Internship at Stripe
From: recruiter@stripe.com
Body: Hi the candidate, I'm Sarah from Stripe recruiting. I'd love to schedule 
a 30-minute phone screen for our SWE internship position. 
Are you available Tuesday July 8 at 2pm EST?
```

Expected result:
- Node 2: classifies as INTERVIEW_INVITE
- Node 4: extracts Sarah's info, interview_date = "2026-07-08"
- Node 5: creates a new Notion contact for Sarah / Stripe
- Node 6: creates or updates Applications DB row for Stripe → stage = "Phone Screen"
- Node 7: creates Google Calendar event for July 8

**Test 2 — Rejection:**
```
Subject: Re: Software Engineer Internship Application — the candidate
From: no-reply@greenhouse.io
Body: Thank you for applying to [Company]. After careful review, 
we've decided to move forward with other candidates.
```

Expected result:
- Node 2: classifies as REJECTION
- Node 4: extracts company info
- Node 5: creates/updates Notion contact with Status = 🔴 Cold
- Node 6: updates Applications DB → stage = Rejected
- Node 7: skips (no interview_date)

**Test 3 — Unrelated email:**
```
Subject: Your recruiting strategy for your blog
```

Expected result:
- Node 2: classifies as UNRELATED
- Node 3: stops the flow

---

## Credit Math Check

With BYOK for Sonnet (Node 4):
- Node 2 (Haiku): 2 credits
- Node 3 (Filter): 1 credit
- Nodes 5-7 (Notion/Calendar MCP): ~3 credits
- **Total: ~6 credits per qualifying email**

At 10 recruiting emails/day × 30 days = 1,800 credits/month.
Free tier: 5,000 credits/month.
**You're fine.** 1,800 < 5,000 with room to spare.

---

## Ghost Checker (Moved to Cowork)

The daily ghost checker that was originally going to be a second Gumloop trigger moved to Cowork since the 1-trigger limit is used for email. See `cowork/daily-brief.md` for the full prompt.

It runs as a scheduled Cowork task at 9am weekdays and checks for:
- Applications where Days in Stage > 14 (ghosted)
- Contacts where Follow-Up Date = today
- Unread recruiting emails from the last 12 hours

---

## Deliverable Checklist

- [ ] Gmail "recruiting" label created and filter set up
- [ ] Gumloop account created + YC deal activated
- [ ] Anthropic API key added as BYOK (or noted that Pro upgrade is needed)
- [ ] Gmail, Notion MCP, Google Calendar integrations connected in Gumloop
- [ ] 7-node flow built and saved
- [ ] Test 1 (interview invite) passes — Notion contact created, Calendar event created
- [ ] Test 2 (rejection) passes — Applications DB updated to Rejected
- [ ] Test 3 (unrelated) passes — flow stops at Node 3

---

## What Comes Next

Phase 5 (Inbox Signal Dashboard) is a 10-minute step — it's a React artifact you open in Claude.ai. It complements this pipeline by giving you a visual view of all email activity.

Phase 6 (Cowork Setup) sets up the ghost checker and daily brief that handle what Gumloop can't.
