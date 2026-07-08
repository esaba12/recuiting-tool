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
  const threads = GmailApp.search('label:recruiting', 0, 25)
  const myEmail = Session.getActiveUser().getEmail().toLowerCase()

  if (!threads.length) {
    console.log('No recruiting threads found.')
    return
  }

  const doneLabel = getOrCreateLabel(DONE_LABEL)
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

      console.log(`→ "${subject}" from ${from} (${messages.length - seen} new message(s))`)

      const data = extractWithClaude(keys.anthropic, subject, from, body, date)

      if (!data || data.type === 'UNRELATED') {
        console.log('  Skipped — UNRELATED')
        thread.addLabel(doneLabel)
        props.setProperty(seenKey, String(messages.length))
        return
      }

      console.log(`  Type: ${data.type} | ${data.contact_name} @ ${data.company}`)

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
        logMessageInteraction(keys.notion, messages[i], contactId, threadId, myEmail)
      }

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

function extractWithClaude(apiKey, subject, from, body, date) {
  const prompt = `You are processing recruiting emails for the candidate, a a university CS sophomore (a strong GPA) targeting SWE internships Fall 2026.

Analyze this email. Return ONLY valid JSON — no explanation, no markdown.

If not recruiting-related: {"type":"UNRELATED"}

Otherwise return:
{
  "type": "REPLY|INTERVIEW_INVITE|OFFER|REJECTION|NEW_CONTACT|FOLLOW_UP_NEEDED",
  "contact_name": "their full name",
  "contact_email": "their email address",
  "company": "company name",
  "role": "role title or null",
  "summary": "2-sentence summary of what this email means for the candidate",
  "urgency": "HIGH|MED|LOW",
  "next_action": "one concrete action the candidate should take",
  "follow_up_draft": "3-sentence reply the candidate could send, or null",
  "interview_date": "YYYY-MM-DD if an interview is scheduled, or null",
  "interview_format": "phone|video|onsite|null"
}

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

function logMessageInteraction(notionKey, message, contactId, threadId, myEmail) {
  const fromHeader = message.getFrom() || ''
  const addrMatch  = fromHeader.match(/<(.+)>/)
  const fromAddr   = (addrMatch ? addrMatch[1] : fromHeader).toLowerCase()
  const direction  = fromAddr === myEmail ? 'Outbound' : 'Inbound'
  const date       = Utilities.formatDate(message.getDate(), 'UTC', 'yyyy-MM-dd')
  const title      = `Email — ${direction} — ${date}`

  notionReq(notionKey, 'post', '/pages', {
    parent:     { database_id: INTERACTIONS_DB },
    properties: {
      'Title':       { title: [{ text: { content: title } }] },
      'Date':        { date: { start: date } },
      ...(contactId ? { 'Contact': { relation: [{ id: contactId }] } } : {}),
      'Type':        { select: { name: 'Email' } },
      'Direction':   { select: { name: direction } },
      'Channel Ref': { rich_text: [{ text: { content: threadId } }] },
      'Summary':     { rich_text: [{ text: { content: message.getPlainBody().slice(0, 300) } }] },
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
  const [y, m, d] = data.interview_date.split('-').map(Number)
  const start = new Date(y, m - 1, d, 14, 0)
  const end   = new Date(y, m - 1, d, 15, 0)
  const title = `Interview — ${data.company}${data.role ? ` · ${data.role}` : ''}`
  const desc  = [
    data.summary,
    `Format: ${data.interview_format || 'TBD'}`,
    `Next action: ${data.next_action || '—'}`,
    data.follow_up_draft ? `\nDraft reply:\n${data.follow_up_draft}` : '',
  ].filter(Boolean).join('\n')

  CalendarApp.getDefaultCalendar().createEvent(title, start, end, { description: desc })
  console.log(`  Calendar event: ${title} on ${data.interview_date}`)
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
