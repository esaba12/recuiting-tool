# Cowork Task: Process Call
# Usage: On-demand after every Granola call — paste Granola summary at the bottom
# This is the same prompt as prompts/call-processing.md — kept here for quick Cowork access

Process this recruiting call summary. Extract structured data, then create the Notion entries. Show me the JSON first, then confirm each action.

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
  "follow_up_draft": "3-4 sentence thank you + next step email. Reference something specific. Under 120 words. Warm but professional.",
  "sentiment": "positive|neutral|negative"
}

Then:
1. Search Notion Contacts DB for contact_name. If found: update Last Interaction = today. If not found: create new row (Name, Company, Role, Email if available, Source = call_type, Status = "🟢 Warm", Last Interaction = today).
2. Create Calls DB row: Title = "[contact_name] @ [contact_company] — [today's date]", link to contact, populate all fields from JSON.
3. Create Google Calendar event: "Follow up with [contact_name] re: [contact_company]" on follow_up_date, 15 min, description = my_commitments.

Report: what you created/updated in each step. If anything failed, say why.

---
GRANOLA SUMMARY:
