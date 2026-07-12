import { claudeJSON, CLAUDE_MODELS } from './claude.js'

// Escalation tier for an overdue follow-up, derived from days-overdue rather than a
// stored counter (no client-side scheduler exists — App.jsx only fetches on mount/
// manual refresh, so there's nothing to "advance" a counter on a timer). Tone should
// shift per tier, not just repeat: cold-outreach data shows follow-up #1 alone adds
// ~22% response rate, #2 adds ~11%, #3 adds ~3% — diminishing but real, and continuing
// to ask the same way after 11+ days reads as tone-deaf, not persistent.
export function escalationTier(daysOverdue) {
  if (daysOverdue >= 11) return 3
  if (daysOverdue >= 4) return 2
  return 1
}

const TIER_GUIDANCE = {
  1: 'Gentle nudge — assume they just haven\'t seen it yet, keep it light and short.',
  2: 'Direct but polite — reference that you reached out before, ask for one specific next step.',
  3: 'Final low-pressure check-in — explicitly give them an easy out ("no worries if the timing isn\'t right"), keep it very short.',
}

// content-block builder for both cold-open and follow-up drafts. For cold_open,
// personalizationContext is required — generic cold outreach gets <1% response vs.
// 10-15%+ for genuinely personalized messages, so a template fallback here would
// silently defeat the point of the feature. Enforced here (not just in the UI) so any
// future caller can't accidentally bypass it.
export function buildDraftPrompt({ contact, kind, tier, personalizationContext }) {
  const student = 'a CS student targeting SWE internships'

  if (kind === 'cold_open') {
    if (!personalizationContext?.trim()) {
      throw new Error('personalizationContext is required for a cold-open draft — a shared connection, mutual interest, or specific signal about the company/role. Generic messages get a fraction of the response rate of personalized ones.')
    }
    return `Draft a short cold-outreach LinkedIn message / email from ${student} to a new contact. Return ONLY valid JSON, no explanation, no markdown.

Contact: ${contact.name}${contact.company ? ` (${contact.company}${contact.role ? `, ${contact.role}` : ''})` : ''}
Personalization / reason for reaching out to them specifically: ${personalizationContext}

{
  "draft": "3-5 sentence message. Open with the specific personalization detail, not a generic greeting. State clearly and briefly what you're hoping for (advice, a short chat, a referral if it comes up naturally) without being pushy. No subject line needed for a LinkedIn DM.",
  "subjectLine": "a short email subject line, only if this reads more like an email than a DM — otherwise null"
}

Rules:
- Do not use the phrase "pick your brain."
- Do not fabricate details about the contact beyond what's given above.
- Keep it under 120 words.`
  }

  return `Draft a follow-up message from ${student} to a contact who hasn't responded to an earlier outreach. Return ONLY valid JSON, no explanation, no markdown.

Contact: ${contact.name}${contact.company ? ` (${contact.company}${contact.role ? `, ${contact.role}` : ''})` : ''}
This is follow-up tier ${tier} of 3. ${TIER_GUIDANCE[tier]}

{
  "draft": "2-4 sentence follow-up message matching the tone guidance above.",
  "subjectLine": null
}

Rules:
- Do not repeat the same phrasing a first message would use — this should read like a distinct, brief nudge, not a resend.
- Keep it under 80 words.
- Tier 3 must include an explicit low-pressure opt-out.`
}

export async function draftMessage({ contact, kind, tier, personalizationContext }) {
  const content = buildDraftPrompt({ contact, kind, tier, personalizationContext })
  return claudeJSON({ model: CLAUDE_MODELS.HAIKU, content, maxTokens: 400 })
}
