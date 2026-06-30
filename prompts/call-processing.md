# Call Processing Prompt
# Model: Claude Sonnet 4.6 (Cowork) | Usage: On-demand after every call
# How to use: Open Cowork → Recruiting OS → Process Call → paste Granola summary below the prompt

Process this recruiting call summary. Extract structured data, then create the Notion entries described below. Return the JSON first so I can review it, then confirm each Notion action you took.

Extract this JSON:
{
  "contact_name": "string — full name",
  "contact_company": "string — their employer",
  "contact_role": "string — their title",
  "contact_email": "string or null — email if mentioned in the call",
  "call_type": "coffee_chat|recruiter_screen|technical|networking|referral",
  "summary": "string — 3-sentence summary of the call",
  "key_insights": "string — what they shared about the company, role, or hiring process",
  "what_they_offered": "string or null — any referrals, intros, or help they offered. null if nothing concrete",
  "my_commitments": "string — what I said I would do (send resume, connect on LinkedIn, etc.)",
  "follow_up_date": "string — 3 days from today as ISO date (e.g. 2026-07-03)",
  "follow_up_draft": "string — 3-4 sentence thank you email that references something specific from the call. First person, warm but professional, under 120 words.",
  "sentiment": "positive|neutral|negative"
}

After extracting:

1. Search my Notion Contacts DB for a row where Name matches contact_name.
   - If found: update Last Interaction to today, update Urgency if sentiment is positive.
   - If NOT found: create a new row with Name, Company, Role, Email (if not null), Source = "Coffee chat" or matching call_type, Status = "🟢 Warm", Last Interaction = today.
   - In either case: capture the contact's Notion page ID for step 2.

2. Create a new row in my Notion Calls DB:
   - Title: "[contact_name] @ [contact_company] — [today's date as Month D, YYYY]"
   - Date: today
   - Contact: link to the contact page from step 1
   - Summary: from JSON
   - Key Insights: from JSON
   - My Commitments: from JSON
   - Follow-Up Draft: from JSON
   - Action Status: Pending

3. Create a Google Calendar event:
   - Title: "Follow up with [contact_name] re: [contact_company]"
   - Date: follow_up_date from JSON
   - Duration: 15 minutes
   - Description: my_commitments from JSON

Tell me what you did for each step. If any step failed, say exactly why.

---
GRANOLA SUMMARY:
[paste here]
