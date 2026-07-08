# Gumloop Flow Spec: Email Intelligence

**Flow name:** Email Intelligence — Recruiting  
**Trigger:** Gmail — new email with label "recruiting"  
**This is the 1 active trigger. Do not add more triggers to your Gumloop account.**

---

## Node-by-Node Build Instructions

### Node 1: Gmail Trigger
- Type: Trigger → Gmail → New Email with Label
- Label: `recruiting`
- Outputs to use downstream: `subject`, `from_name`, `from_email`, `body`, `received_at`, `thread_id`

### Node 2: Claude Haiku — Classify
- Type: AI → Claude (Haiku model)
- Cost: 2 Gumloop credits
- Input variables: `{{subject}}`, `{{from_email}}`, first 400 chars of `{{body}}`
- Prompt: (copy from `prompts/email-classification.md` — paste without the header comment)
- Output variable name: `email_type`
- Parse mode: raw text (single word output)

### Node 3: Filter — Stop if UNRELATED
- Type: Filter / Condition
- Condition: `email_type` NOT EQUAL TO "UNRELATED"
- If false: stop flow
- Cost: 1 credit

### Node 4: Claude Sonnet — Extract JSON (BYOK)
- Type: AI → Claude (Sonnet 4.6 model) → Use Custom API Key (BYOK)
- Cost: 0 Gumloop credits (routes through your Anthropic key)
- Input variables: all Gmail fields from Node 1
- Prompt: (copy from `prompts/email-extraction.md`)
- Output: raw JSON string
- Add a JSON Parser node after this: parse the output into individual variables:
  `contact_name`, `contact_email`, `company`, `role`, `email_type_extracted`, `summary`, `urgency`, `next_action`, `follow_up_draft`, `interview_date`, `interview_format`

### Node 5: Notion MCP — Upsert Contact
- Type: Notion MCP
- Database ID: [Contacts DB ID from context.md]
- Action: Search for existing page where Email property = `{{contact_email}}`
  
  **Branch A — Contact found:**
  - Update existing page:
    - Last Interaction → today's date
    - Urgency → `{{urgency}}`
    - Status → map based on email_type:
      - REPLY → keep current (don't overwrite)
      - INTERVIEW_INVITE → "🟢 Warm"
      - OFFER → "🟢 Warm"
      - REJECTION → "🔴 Cold"
      - NEW_CONTACT → "🟡 Cooling"
  
  **Branch B — Contact not found:**
  - Create new page with:
    - Name: `{{contact_name}}`
    - Company: `{{company}}`
    - Role: `{{role}}`
    - Email: `{{contact_email}}`
    - Source: "Email"
    - Status: "🟢 Warm"
    - Urgency: `{{urgency}}`
    - Last Interaction: today
    - Follow-Up Date: today + 7 days (if urgency = HIGH or MED)
  
- Capture output: `contact_page_id` (the Notion page ID of the created/updated row)

### Node 6: Notion MCP — Update Applications DB
- Type: Notion MCP
- Database ID: [Applications DB ID from context.md]
- Run condition: only if `email_type` is INTERVIEW_INVITE, OFFER, or REJECTION
  
  **Search** for existing page where Company property = `{{company}}`
  
  **Branch A — Application found:**
  - Update Stage based on email_type:
    - INTERVIEW_INVITE + interview_format="phone" → "Phone Screen"
    - INTERVIEW_INVITE + interview_format="video" → "Phone Screen" (or "Technical" if context says technical)
    - INTERVIEW_INVITE + interview_format="onsite" → "Onsite"
    - OFFER → "Offer"
    - REJECTION → "Rejected"
  - Update Last Activity: today
  
  **Branch B — Application not found:**
  - Create new page with:
    - Company: `{{company}}`
    - Role: `{{role}}`
    - Stage: derived from email_type (OFFER → "Offer", REJECTION → "Rejected", INVITE → "Phone Screen")
    - Last Activity: today
    - Recruiter Contact: `{{contact_page_id}}` (from Node 5)
      ```json
      {"Recruiter Contact": {"relation": [{"id": "{{contact_page_id}}"}]}}
      ```

### Node 7: Conditional → Google Calendar
- Type: Conditional
- Condition: `interview_date` is not null AND not empty
- If true: Google Calendar → Create Event
  - Title: "Interview: {{role}} at {{company}}"
  - Start time: `{{interview_date}}`
  - End time: `{{interview_date}}` + 60 minutes
  - Description: `{{summary}}\n\nContact: {{contact_name}} ({{contact_email}})\nNext action: {{next_action}}`
  - Calendar: your primary Google calendar

---

## Credit Math Verification

| Node | Model/Type | Cost |
|---|---|---|
| Node 1 | Trigger | 0 |
| Node 2 | Haiku | 2 |
| Node 3 | Filter | 1 |
| Node 4 | Sonnet BYOK | 0 |
| JSON Parser | Utility | 1 |
| Node 5 | Notion MCP | 1-2 |
| Node 6 | Notion MCP | 1-2 |
| Node 7 | Calendar | 1 |
| **Total** | | **~7-8 credits/email** |

At 10 emails/day × 30 days = ~2,400 credits/month. Free tier = 5,000/month. ✅

---

## Testing Checklist

Before going live, test with these 3 email types:

**Test 1 — Interview invite:**
Send mock email: "Hi Alex, I'd love to schedule a phone screen for our SWE intern role at Stripe. Are you available Tuesday July 8 at 2pm?"
Expected: Node 2 = INTERVIEW_INVITE, Node 5 creates contact, Node 6 creates/updates application to Phone Screen, Node 7 creates calendar event

**Test 2 — Rejection:**
Send mock email from greenhouse.io domain: "Thank you for applying. We've decided to move forward with other candidates."
Expected: Node 2 = REJECTION, Node 5 creates contact with Status 🔴 Cold, Node 6 sets stage to Rejected, Node 7 skips

**Test 3 — Unrelated:**
Send mock email: "Check out this networking strategy..."
Expected: Node 2 = UNRELATED, Node 3 stops the flow

---

## Gmail Filter (one-time setup)

Paste this in Gmail Settings → Filters → Matches:
```
subject:(interview OR "phone screen" OR application OR recruiter OR hiring OR "next steps" OR offer OR internship OR "coffee chat" OR "thank you for applying" OR "moving forward" OR "unfortunately") OR from:(@greenhouse.io OR @lever.co OR @workday.com OR @myworkdayjobs.com)
```
Action: Apply label `recruiting`. Do NOT skip inbox.
