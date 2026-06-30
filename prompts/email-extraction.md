# Email Extraction Prompt
# Model: Claude Sonnet 4.6 via BYOK | Cost: 0 Gumloop credits (~$0.003 Anthropic) | Node 4 in Gumloop flow

Extract recruiting data from this email. Return ONLY valid JSON, no explanation, no markdown, no code fences.

{
  "contact_name": "string — full name of the person emailing you",
  "contact_email": "string — their email address",
  "company": "string — company name",
  "role": "string or null — specific role title if mentioned",
  "email_type": "REPLY|INTERVIEW_INVITE|OFFER|REJECTION|NEW_CONTACT",
  "summary": "string — 2-sentence summary of what this email says",
  "urgency": "HIGH|MED|LOW — HIGH if time-sensitive action required, MED if reply needed soon, LOW if FYI",
  "next_action": "string — the specific next action you should take",
  "follow_up_draft": "string or null — a 3-sentence draft reply if a reply is needed, null if not",
  "interview_date": "string or null — ISO 8601 datetime if an interview is being scheduled (e.g. 2026-07-08T14:00:00), null otherwise",
  "interview_format": "phone|video|onsite|null"
}

Rules:
- contact_name and contact_email should be from the sender, not you
- If multiple dates are mentioned, use the first/earliest one for interview_date
- follow_up_draft should be written in first person as the candidate (a university CS sophomore, a strong GPA)
- Keep follow_up_draft professional but warm, under 100 words
- For rejection emails, follow_up_draft should be a gracious thank-you reply

Subject: {subject}
From: {sender_name} <{sender_email}>
Date: {date}
Body: {full_body}
