const CONTACTS_DB = '6f941973-1fce-40c3-943c-4c908940e2a8'
const CALLS_DB    = '8ddef121-1744-45d2-aa52-7699a727e9c0'
const APPS_DB     = '49011c2e-8165-4373-a41b-f913b02d1052'

async function queryDB(dbId) {
  const pages = []
  let cursor
  do {
    const res = await fetch(`/notion/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `Notion ${res.status}`)
    }
    const data = await res.json()
    pages.push(...(data.results || []))
    cursor = data.has_more ? data.next_cursor : null
  } while (cursor)
  return pages
}

function str(prop)  { return prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || '' }
function sel(prop)  { return prop?.select?.name || '' }
function date(prop) { return prop?.date?.start || null }
function url(prop)  { return prop?.url || null }
function num(prop)  { return prop?.formula?.number ?? prop?.number ?? null }

async function notionPost(path, body) {
  const res = await fetch(`/notion/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Notion ${res.status}`)
  }
  return res.json()
}

export async function searchContactByName(name) {
  const res = await fetch(`/notion/v1/databases/${CONTACTS_DB}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter: { property: 'Name', title: { contains: name.split(' ')[0] } }, page_size: 5 }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.results?.[0] || null
}

export async function addContact({ name, company, role, email }) {
  const today = new Date().toISOString().split('T')[0]
  const followUp = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
  const ROLE_OPTIONS = ['SWE','PM','Recruiter','Alumni','Referral','Other']
  const roleSelect = ROLE_OPTIONS.find(r => role?.toLowerCase().includes(r.toLowerCase())) || 'Other'
  return notionPost('/pages', {
    parent: { database_id: CONTACTS_DB },
    properties: {
      'Name':             { title: [{ text: { content: name } }] },
      'Company':          company ? { rich_text: [{ text: { content: company } }] } : undefined,
      'Role':             { select: { name: roleSelect } },
      'Email':            email ? { email } : undefined,
      'Status':           { select: { name: '🟡 Cooling' } },
      'Last Interaction': { date: { start: today } },
      'Follow-Up Date':   { date: { start: followUp } },
    },
  })
}

export async function addCallEntry({ contactId, contactName, company, summary, keyInsights, commitments, followUpDraft }) {
  const today = new Date().toISOString().split('T')[0]
  const title = `${contactName} @ ${company || '?'} — ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`
  return notionPost('/pages', {
    parent: { database_id: CALLS_DB },
    properties: {
      'Title':           { title: [{ text: { content: title } }] },
      'Date':            { date: { start: today } },
      ...(contactId ? { 'Contact': { relation: [{ id: contactId }] } } : {}),
      'Summary':         summary       ? { rich_text: [{ text: { content: summary } }] }       : undefined,
      'Key Insights':    keyInsights   ? { rich_text: [{ text: { content: keyInsights } }] }   : undefined,
      'My Commitments':  commitments   ? { rich_text: [{ text: { content: commitments } }] }   : undefined,
      'Follow-Up Draft': followUpDraft ? { rich_text: [{ text: { content: followUpDraft } }] } : undefined,
    },
  })
}

export async function addApplication({ company, role, jdLink }) {
  return notionPost('/pages', {
    parent: { database_id: APPS_DB },
    properties: {
      'Company':     { title: [{ text: { content: company } }] },
      'Role':        role    ? { rich_text: [{ text: { content: role } }] }    : undefined,
      'JD Link':     jdLink  ? { url: jdLink }                                  : undefined,
      'Stage':       { select: { name: 'Wishlist' } },
    },
  })
}

export async function fetchContacts() {
  const pages = await queryDB(CONTACTS_DB)
  return pages.map(p => ({
    id:              p.id,
    name:            str(p.properties.Name),
    company:         str(p.properties.Company),
    role:            sel(p.properties.Role),
    email:           p.properties.Email?.email || '',
    linkedin:        url(p.properties.LinkedIn),
    status:          sel(p.properties.Status) || '🟡 Cooling',
    urgency:         sel(p.properties.Urgency) || 'LOW',
    lastInteraction: date(p.properties['Last Interaction']),
    followUpDate:    date(p.properties['Follow-Up Date']),
    notes:           str(p.properties.Notes),
    whatTheyDid:     str(p.properties["What They've Done For Me"]),
  }))
}

export async function fetchApplications() {
  const pages = await queryDB(APPS_DB)
  return pages.map(p => ({
    id:          p.id,
    company:     str(p.properties.Company),
    role:        str(p.properties.Role),
    stage:       sel(p.properties.Stage) || 'Applied',
    appliedDate: date(p.properties['Applied Date']),
    lastActivity: date(p.properties['Last Activity']),
    daysInStage: num(p.properties['Days in Stage']),
    jdLink:      url(p.properties['JD Link']),
    notes:       str(p.properties.Notes),
  }))
}
