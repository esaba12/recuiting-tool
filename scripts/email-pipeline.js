// ─────────────────────────────────────────────────────────────────────────────
// Recruiting Email Pipeline — Google Apps Script
//
// SETUP (one time):
//   1. script.google.com → New project → paste this entire file
//   2. Project Settings (gear icon) → Script Properties → Add:
//        ANTHROPIC_KEY  =  sk-ant-api03-...
//        NOTION_KEY     =  ntn_[redacted]
//   3. Run setup() once manually — approve all permission prompts
//   4. Triggers (clock icon) → Add Trigger:
//        Function: processRecruitingEmails
//        Event: Time-driven → Every 10 minutes
//
// COST: ~$0.001/email with Haiku. 300 emails/month = $0.30 from your Anthropic credits.
// ─────────────────────────────────────────────────────────────────────────────

const CONTACTS_DB     = '6f941973-1fce-40c3-943c-4c908940e2a8'
const APPS_DB         = '49011c2e-8165-4373-a41b-f913b02d1052'
const INTERACTIONS_DB = '39753135-a476-819e-96b4-dc41ecab6364'
const DONE_LABEL      = 'recruiting-done' // visual marker in Gmail only — no longer used to gate processing, since threads can grow replies after being marked done
const RECRUITING_LABEL = 'recruiting'
// Recent Sent-folder threads not yet labeled — catches brand-new cold outreach the user
// sends that never went through an already-labeled thread. 30d bounds the first-run backfill.
const SENT_SCAN_QUERY = `in:sent -label:${RECRUITING_LABEL} newer_than:30d`

function getKeys() {
  const p = PropertiesService.getScriptProperties()
  return {
    anthropic: p.getProperty('ANTHROPIC_API_KEY'),
    notion:    p.getProperty('NOTION_API_KEY'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — runs every 10 minutes via trigger
// ─────────────────────────────────────────────────────────────────────────────

function processRecruitingEmails() {
  const keys    = getKeys()
  const props   = PropertiesService.getScriptProperties()
  const myEmail = Session.getActiveUser().getEmail().toLowerCase()

  // Two discovery sources, deduped by thread ID since a thread can appear in both:
  // (1) threads already labeled 'recruiting' (inbound emails, or previously-discovered
  // sent threads — see the label-application step below), and (2) recent Sent-folder
  // threads not yet labeled, which catches brand-new cold outreach the user sends.
  const labeledThreads = GmailApp.search(`label:${RECRUITING_LABEL}`, 0, 25)
  const sentThreads     = GmailApp.search(SENT_SCAN_QUERY, 0, 25)
  const threadsById     = new Map()
  ;[...labeledThreads, ...sentThreads].forEach(t => threadsById.set(t.getId(), t))
  const threads = [...threadsById.values()]

  if (!threads.length) {
    console.log('No recruiting threads found.')
    return
  }

  const doneLabel       = getOrCreateLabel(DONE_LABEL)
  const recruitingLabel = getOrCreateLabel(RECRUITING_LABEL)
  console.log(`Scanning ${threads.length} thread(s)`)

  threads.forEach(thread => {
    const threadId = thread.getId()
    const seenKey  = `msgcount_${threadId}`
    try {
      const messages = thread.getMessages()
      const seen     = Number(props.getProperty(seenKey) || 0)

      if (messages.length <= seen) return // nothing new since last run

      const msg      = messages[messages.length - 1]
      const subject  = msg.getSubject()
      const from     = msg.getFrom()
      const body     = msg.getPlainBody().slice(0, 4000)
      const date     = Utilities.formatDate(msg.getDate(), 'UTC', 'yyyy-MM-dd')

      // Deterministic meeting signals, extracted before the Claude call so they can be fed
      // in as hints — an attached .ics or a Zoom/Meet/Teams link is more reliable evidence
      // of a real scheduled meeting than asking Claude to spot a date in free text.
      const invite      = extractCalendarInvite(msg)
      const meetingLink = (invite && invite.meetingLink) || extractMeetingLink(body)

      console.log(`→ "${subject}" from ${from} (${messages.length - seen} new message(s))`)

      const data = extractWithClaude(keys.anthropic, subject, from, body, date, invite, meetingLink)

      if (!data || data.type === 'UNRELATED') {
        console.log('  Skipped — UNRELATED')
        thread.addLabel(doneLabel)
        props.setProperty(seenKey, String(messages.length))
        return
      }

      // Claude's own meeting_link guess (from prompt JSON) is only a fallback for cases the
      // regex above missed — the deterministic sources win when present.
      data.meeting_link = meetingLink || data.meeting_link || null

      if (invite) {
        // An attached calendar invite is ground truth for timing — overrides Claude's
        // text-guessed date/format rather than merely supplementing it.
        data.interview_date = Utilities.formatDate(invite.start, 'UTC', 'yyyy-MM-dd')
        data.interview_time = invite
        if (!['INTERVIEW_INVITE', 'OFFER'].includes(data.type)) data.type = 'INTERVIEW_INVITE'
        if (!data.interview_format) data.interview_format = data.meeting_link ? 'video' : data.interview_format
      }

      // Header-derived address is authoritative — Claude never guesses contact_email from
      // body text, since that breaks when the newest message is outbound (its 'from' header
      // is the user's own address, not the recruiter's). See findCounterpartAddress().
      const counterpart = findCounterpartAddress(messages, myEmail)
      data.contact_email = counterpart.email || null
      if (!data.contact_name && counterpart.displayName) data.contact_name = counterpart.displayName

      console.log(`  Type: ${data.type} | ${data.contact_name} @ ${data.company}${data.meeting_link ? ` | ${data.meeting_link}` : ''}`)

      const contactId = upsertContact(keys.notion, data)

      if (['INTERVIEW_INVITE', 'OFFER', 'REJECTION'].includes(data.type)) {
        upsertApplication(keys.notion, data)
      }

      if (data.interview_date) {
        createCalendarEvent(data)
      }

      // Log every message new since the last run as its own Interactions row (no LLM call —
      // classification above already ran once against the newest message).
      // Simplifying assumption: the whole thread maps to the one contact resolved above,
      // even if a second person is CC'd on some messages.
      for (let i = seen; i < messages.length; i++) {
        const isNewest = i === messages.length - 1
        logMessageInteraction(keys.notion, messages[i], contactId, threadId, myEmail, isNewest ? data.meeting_link : null)
      }

      // A thread discovered via the Sent-folder search (not already labeled) gets the
      // 'recruiting' label applied now that it's confirmed relevant — keeps Gmail's own
      // label view consistent and means future runs find it via the primary labeled search.
      const labelNames = thread.getLabels().map(l => l.getName())
      if (!labelNames.includes(RECRUITING_LABEL)) thread.addLabel(recruitingLabel)

      thread.addLabel(doneLabel)
      props.setProperty(seenKey, String(messages.length))
      console.log('  ✓ Written to Notion')

    } catch (e) {
      console.error(`  ✗ ${e.message}`)
      // Don't update seenKey — will retry next run
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAUDE — classify + extract in one Haiku call
// ─────────────────────────────────────────────────────────────────────────────

function extractWithClaude(apiKey, subject, from, body, date, invite, meetingLink) {
  // Deterministic signals (calendar invite attachment, Zoom/Meet/Teams link) are handed to
  // Claude as hints rather than left for it to re-derive from free text — see
  // extractCalendarInvite()/extractMeetingLink() and their callers in processRecruitingEmails().
  const inviteHint = invite
    ? `\n\nThis email has a calendar invite attached: "${invite.summary || subject}", scheduled for ${Utilities.formatDate(invite.start, 'UTC', 'yyyy-MM-dd HH:mm')} UTC${invite.location ? ` at/via ${invite.location}` : ''}. Treat this as strong evidence of a real scheduled interview/meeting.`
    : ''
  const linkHint = meetingLink ? `\n\nA video meeting link was found in this email: ${meetingLink}` : ''

  const prompt = `You are processing recruiting emails for a CS student targeting SWE internships.

Analyze this email. Return ONLY valid JSON — no explanation, no markdown.

If not recruiting-related: {"type":"UNRELATED"}

Otherwise return:
{
  "type": "REPLY|INTERVIEW_INVITE|OFFER|REJECTION|NEW_CONTACT|FOLLOW_UP_NEEDED",
  "contact_name": "the recruiter/contact's full name if mentioned in the body or signature, else null — their email address is resolved separately from message headers, not from this field",
  "company": "company name",
  "role": "role title or null",
  "summary": "2-sentence summary of what this email means for the candidate",
  "urgency": "HIGH|MED|LOW",
  "next_action": "one concrete action the candidate should take",
  "follow_up_draft": "3-sentence reply the candidate could send, or null",
  "interview_date": "YYYY-MM-DD if an interview is scheduled, or null",
  "interview_format": "phone|video|onsite|null",
  "meeting_link": "the Zoom/Google Meet/Teams/etc. video call URL if one is mentioned in the body, else null"
}${inviteHint}${linkHint}

Subject: ${subject}
From: ${from}
Date: ${date}
Body:
${body}`

  const resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method:             'post',
    muteHttpExceptions: true,
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    payload: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })

  if (resp.getResponseCode() !== 200) {
    throw new Error(`Claude ${resp.getResponseCode()}: ${resp.getContentText().slice(0, 200)}`)
  }

  const text  = JSON.parse(resp.getContentText()).content[0].text
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in Claude response')
  return JSON.parse(match[0])
}

// ─────────────────────────────────────────────────────────────────────────────
// ADDRESS PARSING — deterministic counterpart resolution from Gmail headers
// ─────────────────────────────────────────────────────────────────────────────

function parseAddress(headerStr) {
  if (!headerStr) return null
  const m = headerStr.match(/(.*)<(.+)>/)
  if (m) return { displayName: m[1].replace(/["']/g, '').trim(), email: m[2].trim().toLowerCase() }
  const email = headerStr.trim().toLowerCase()
  return email ? { displayName: '', email } : null
}

function parseAddressList(headerStr) {
  if (!headerStr) return []
  return headerStr.split(',').map(parseAddress).filter(Boolean)
}

// Resolves the "other party" on a thread from the newest message's headers, so contact
// identification doesn't depend on Claude guessing an email address out of body text —
// which breaks when the newest message is one the user sent (the From header is then the
// user's own address, not the recruiter's). Checks From, then To, then Cc, in that order,
// skipping any address that's the user's own. Simplifying assumption: the whole thread maps
// to one contact even if a second person is CC'd — same assumption the interaction-logging
// loop in processRecruitingEmails() already makes.
function findCounterpartAddress(messages, myEmail) {
  const msg  = messages[messages.length - 1]
  const from = parseAddress(msg.getFrom())
  if (from && from.email !== myEmail) return from

  const candidates = [...parseAddressList(msg.getTo()), ...parseAddressList(msg.getCc())]
  return candidates.find(a => a.email !== myEmail) || { displayName: '', email: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTION helpers
// ─────────────────────────────────────────────────────────────────────────────

function notionReq(notionKey, method, path, body) {
  const opts = {
    method,
    muteHttpExceptions: true,
    headers: {
      'Authorization':  `Bearer ${notionKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type':   'application/json',
    },
  }
  if (body) opts.payload = JSON.stringify(body)

  const resp = UrlFetchApp.fetch(`https://api.notion.com/v1${path}`, opts)
  const code = resp.getResponseCode()
  if (code >= 400) throw new Error(`Notion ${code}: ${resp.getContentText().slice(0, 200)}`)
  return JSON.parse(resp.getContentText())
}

function upsertContact(notionKey, data) {
  const today    = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd')
  const followUp = Utilities.formatDate(new Date(Date.now() + 3 * 86400000), 'UTC', 'yyyy-MM-dd')

  // Try to find existing contact by email
  let existingId = null
  if (data.contact_email) {
    const res = notionReq(notionKey, 'post', `/databases/${CONTACTS_DB}/query`, {
      filter:    { property: 'Email', email: { equals: data.contact_email } },
      page_size: 1,
    })
    existingId = res.results?.[0]?.id
  }

  const sharedProps = {
    'Company':          { rich_text: [{ text: { content: data.company || '' } }] },
    'Status':           { select: { name: '🟡 Cooling' } },
    'Last Interaction': { date: { start: today } },
    'Follow-Up Date':   { date: { start: followUp } },
    'Urgency':          { select: { name: data.urgency || 'LOW' } },
    'Notes':            { rich_text: [{ text: { content: data.summary || '' } }] },
    ...(data.contact_email ? { 'Email': { email: data.contact_email } } : {}),
  }

  if (existingId) {
    notionReq(notionKey, 'patch', `/pages/${existingId}`, { properties: sharedProps })
    console.log(`  Contact updated: ${existingId}`)
    return existingId
  } else {
    const created = notionReq(notionKey, 'post', '/pages', {
      parent:     { database_id: CONTACTS_DB },
      properties: {
        'Name': { title: [{ text: { content: data.contact_name || 'Unknown' } }] },
        ...sharedProps,
      },
    })
    console.log(`  Contact created: ${data.contact_name}`)
    return created.id
  }
}

function logMessageInteraction(notionKey, message, contactId, threadId, myEmail, meetingLink) {
  const from      = parseAddress(message.getFrom())
  const direction = (from && from.email === myEmail) ? 'Outbound' : 'Inbound'
  const date      = Utilities.formatDate(message.getDate(), 'UTC', 'yyyy-MM-dd')
  const title     = `Email — ${direction} — ${date}`
  const plainBody = message.getPlainBody()
  // Surface the meeting link at the top of the summary (only passed for the newest message,
  // the one that was actually classified) so it's visible at a glance in the Interactions row.
  const summary   = meetingLink ? `📅 Meeting link: ${meetingLink}\n\n${plainBody}` : plainBody

  notionReq(notionKey, 'post', '/pages', {
    parent:     { database_id: INTERACTIONS_DB },
    properties: {
      'Title':       { title: [{ text: { content: title } }] },
      'Date':        { date: { start: date } },
      ...(contactId ? { 'Contact': { relation: [{ id: contactId }] } } : {}),
      'Type':        { select: { name: 'Email' } },
      'Direction':   { select: { name: direction } },
      'Channel Ref': { rich_text: [{ text: { content: threadId } }] },
      'Summary':     { rich_text: [{ text: { content: summary.slice(0, 300) } }] },
      'Body':        { rich_text: [{ text: { content: plainBody.slice(0, 2000) } }] },
    },
  })
}

function upsertApplication(notionKey, data) {
  const today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd')
  const stageMap = {
    INTERVIEW_INVITE: 'Phone Screen',
    OFFER:            'Offer',
    REJECTION:        'Rejected',
  }
  const stage = stageMap[data.type] || 'Applied'

  // Check if application already exists
  const res = notionReq(notionKey, 'post', `/databases/${APPS_DB}/query`, {
    filter:    { property: 'Company', title: { contains: (data.company || '').slice(0, 20) } },
    page_size: 1,
  })
  const existing = res.results?.[0]

  const props = {
    'Stage':         { select: { name: stage } },
    'Last Activity': { date: { start: today } },
    ...(stage === 'Rejected' ? { 'Closed Date': { date: { start: today } } } : {}),
    ...(data.role ? { 'Role': { rich_text: [{ text: { content: data.role } }] } } : {}),
  }

  if (existing) {
    notionReq(notionKey, 'patch', `/pages/${existing.id}`, { properties: props })
    console.log(`  Application updated → ${stage}`)
  } else {
    notionReq(notionKey, 'post', '/pages', {
      parent:     { database_id: APPS_DB },
      properties: {
        'Company': { title: [{ text: { content: data.company || 'Unknown' } }] },
        ...props,
        'Applied Date': { date: { start: today } },
      },
    })
    console.log(`  Application created → ${stage}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE CALENDAR
// ─────────────────────────────────────────────────────────────────────────────

function createCalendarEvent(data) {
  if (!data.interview_date) return

  // A parsed calendar-invite attachment gives an exact start/end — prefer it over the
  // 2–3pm placeholder window, which is only a fallback for text-only date mentions with no
  // attached invite (see extractCalendarInvite()).
  let start, end
  if (data.interview_time && data.interview_time.start) {
    start = data.interview_time.start
    end   = data.interview_time.end || new Date(start.getTime() + 60 * 60000)
  } else {
    const [y, m, d] = data.interview_date.split('-').map(Number)
    start = new Date(y, m - 1, d, 14, 0)
    end   = new Date(y, m - 1, d, 15, 0)
  }

  const title = `Interview — ${data.company}${data.role ? ` · ${data.role}` : ''}`
  const desc  = [
    data.summary,
    `Format: ${data.interview_format || 'TBD'}`,
    data.meeting_link ? `Meeting link: ${data.meeting_link}` : '',
    `Next action: ${data.next_action || '—'}`,
    data.follow_up_draft ? `\nDraft reply:\n${data.follow_up_draft}` : '',
  ].filter(Boolean).join('\n')

  const opts = { description: desc }
  if (data.meeting_link) opts.location = data.meeting_link

  CalendarApp.getDefaultCalendar().createEvent(title, start, end, opts)
  console.log(`  Calendar event: ${title} on ${data.interview_date}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// MEETING SIGNALS — calendar invites (.ics attachments) and video-call links, detected
// deterministically rather than relying on Claude to spot a date/link in free text. An
// attached invite in particular is authoritative: it has an exact start/end time, unlike a
// date guessed from prose ("let's meet next Tuesday").
// ─────────────────────────────────────────────────────────────────────────────

const MEETING_LINK_RE = /https?:\/\/[^\s<>"')\]]*(?:zoom\.us\/j\/|meet\.google\.com\/|teams\.microsoft\.com\/l\/meetup-join|teams\.live\.com\/meet|webex\.com\/(?:meet|join))[^\s<>"')\]]*/i

function extractMeetingLink(text) {
  if (!text) return null
  const m = text.match(MEETING_LINK_RE)
  return m ? m[0].replace(/[.,)\]]+$/, '') : null
}

// RFC 5545 line-folding: a line that's too long continues on the next physical line, which
// starts with a space or tab. Unfold before parsing so a folded DTSTART/DESCRIPTION doesn't
// silently truncate at the fold point.
function unfoldIcs(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function icsField(text, name) {
  // Matches "NAME:value" and "NAME;PARAM=x:value" (e.g. DTSTART;TZID=America/New_York:...)
  const m = text.match(new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, 'im'))
  return m ? m[1].trim() : null
}

// Handles both UTC form (DTSTART:20260815T140000Z) and local/floating form
// (DTSTART:20260815T140000 or DTSTART;TZID=...:20260815T140000). TZID-qualified values are
// treated as local time — good enough here since events this script creates already land on
// the script owner's default calendar timezone.
function parseIcsDate(value) {
  if (!value) return null
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s, isUtc] = m
  return isUtc
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
    : new Date(+y, +mo - 1, +d, +h, +mi, +s)
}

function extractCalendarInvite(message) {
  let attachments
  try {
    attachments = message.getAttachments({ includeInlineImages: false })
  } catch (e) {
    return null
  }
  const ics = attachments.find(a =>
    /\.ics$/i.test(a.getName() || '') || (a.getContentType() || '').indexOf('text/calendar') !== -1)
  if (!ics) return null

  try {
    const text        = unfoldIcs(ics.getDataAsString())
    const start        = parseIcsDate(icsField(text, 'DTSTART'))
    if (!start) return null
    const end           = parseIcsDate(icsField(text, 'DTEND'))
    const summary       = icsField(text, 'SUMMARY')
    const location       = icsField(text, 'LOCATION')
    const description    = (icsField(text, 'DESCRIPTION') || '').replace(/\\n/g, '\n')
    const meetingLink    = extractMeetingLink(location) || extractMeetingLink(description)

    return { start, end, summary, location, meetingLink }
  } catch (e) {
    console.error(`  ICS parse failed: ${e.message}`)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP & TESTING
// ─────────────────────────────────────────────────────────────────────────────

function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name)
}

// Run this once manually to verify everything is wired up
function setup() {
  const keys = getKeys()

  if (!keys.anthropic) {
    console.log('MISSING: Add ANTHROPIC_API_KEY to Script Properties (gear icon → Script Properties)')
    return
  }
  if (!keys.notion) {
    console.log('MISSING: Add NOTION_API_KEY to Script Properties (gear icon → Script Properties)')
    return
  }

  getOrCreateLabel(DONE_LABEL)
  getOrCreateLabel(RECRUITING_LABEL)
  console.log('✓ Labels created')
  console.log('✓ API keys found')
  console.log('✓ Setup complete')
  console.log('')
  console.log('Next: Triggers (clock icon) → Add Trigger → processRecruitingEmails → Time-driven → Every 10 minutes')
}

// Send yourself a test email, then run this to process it immediately
function runNow() {
  processRecruitingEmails()
}
