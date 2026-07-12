const CONTACTS_DB     = '6f941973-1fce-40c3-943c-4c908940e2a8'
const CALLS_DB        = '8ddef121-1744-45d2-aa52-7699a727e9c0'
const APPS_DB         = '49011c2e-8165-4373-a41b-f913b02d1052'
const INTERACTIONS_DB = '39753135-a476-819e-96b4-dc41ecab6364'

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
function bool(prop) { return prop?.checkbox || false }
function multiSel(prop) { return (prop?.multi_select || []).map(o => o.name) }

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

async function notionPatch(path, body) {
  const res = await fetch(`/notion/v1${path}`, {
    method: 'PATCH',
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

export async function addApplication({ company, role, jdLink, location, sourceRepo, datePosted }) {
  return notionPost('/pages', {
    parent: { database_id: APPS_DB },
    properties: {
      'Company':     { title: [{ text: { content: company } }] },
      'Role':        role       ? { rich_text: [{ text: { content: role } }] }       : undefined,
      'JD Link':     jdLink     ? { url: jdLink }                                     : undefined,
      'Location':    location   ? { rich_text: [{ text: { content: location } }] }   : undefined,
      'Source Repo': sourceRepo ? { rich_text: [{ text: { content: sourceRepo } }] } : undefined,
      'Notes':       datePosted ? { rich_text: [{ text: { content: `Posted ${datePosted}` } }] } : undefined,
      'Stage':       { select: { name: 'Wishlist' } },
      'Triage':      { select: { name: 'Needs Review' } },
    },
  })
}

// Only patches Triage (+ cascading Stage/Applied Date effects) — used by the Job Boards review flow.
export async function updateApplicationTriage(id, triage, currentStage) {
  const properties = { 'Triage': { select: { name: triage } } }
  if (triage === 'Applied' && (!currentStage || currentStage === 'Wishlist')) {
    properties['Stage'] = { select: { name: 'Applied' } }
    properties['Applied Date'] = { date: { start: new Date().toISOString().split('T')[0] } }
  }
  return notionPatch(`/pages/${id}`, { properties })
}

// Patchable field -> Notion property builder for an existing Application. Only include
// keys you want to change. Auto-filling Closed Date when Stage moves to a terminal value
// is handled by the caller (ApplicationDetailModal.jsx), not here, so this stays a plain
// field mapper like updateContact.
export async function updateApplication(id, fields) {
  const properties = {}
  if ('company' in fields)     properties['Company']      = { title: [{ text: { content: fields.company || '' } }] }
  if ('role' in fields)        properties['Role']          = { rich_text: [{ text: { content: fields.role || '' } }] }
  if ('location' in fields)    properties['Location']      = { rich_text: [{ text: { content: fields.location || '' } }] }
  if ('jdLink' in fields)      properties['JD Link']       = { url: fields.jdLink || null }
  if ('notes' in fields)       properties['Notes']         = { rich_text: [{ text: { content: fields.notes || '' } }] }
  if ('stage' in fields)       properties['Stage']         = fields.stage ? { select: { name: fields.stage } } : { select: null }
  if ('appliedDate' in fields) properties['Applied Date']  = { date: fields.appliedDate ? { start: fields.appliedDate } : null }
  if ('closedDate' in fields)  properties['Closed Date']   = { date: fields.closedDate ? { start: fields.closedDate } : null }
  return notionPatch(`/pages/${id}`, { properties })
}

export async function fetchContacts() {
  const pages = await queryDB(CONTACTS_DB)
  const contacts = pages.map(p => ({
    id:              p.id,
    name:            str(p.properties.Name),
    company:         str(p.properties.Company),
    role:            sel(p.properties.Role),
    email:           p.properties.Email?.email || '',
    linkedin:        url(p.properties.LinkedIn),
    source:          sel(p.properties.Source),
    status:          sel(p.properties.Status) || '🟡 Cooling',
    urgency:         sel(p.properties.Urgency) || 'LOW',
    lastInteraction: date(p.properties['Last Interaction']),
    followUpDate:    date(p.properties['Follow-Up Date']),
    notes:           str(p.properties.Notes),
    whatTheyDid:     str(p.properties["What They've Done For Me"]),
    referredById:    p.properties['Referred By']?.relation?.[0]?.id || null,
    followUpDraft:     str(p.properties['Follow-Up Draft']),
    followUpDraftTier: num(p.properties['Follow-Up Draft Tier']),
    followUpDraftKind: sel(p.properties['Follow-Up Draft Kind']),
    isUMichAlum:     bool(p.properties['Is UMich Alum']),
    affinity:        multiSel(p.properties['Notable Affinity']),
    wantsToSchedule: bool(p.properties['Wants To Schedule']),
    scheduleBy:      date(p.properties['Schedule By']),
    scheduleNote:    str(p.properties['Schedule Note']),
    referralStatus:  sel(p.properties['Referral Status']) || 'Not Asked',
  }))
  const byId = Object.fromEntries(contacts.map(c => [c.id, c]))
  return contacts.map(c => ({ ...c, referredByName: c.referredById ? (byId[c.referredById]?.name || null) : null }))
}

// Patchable field -> Notion property builder. Only include keys you want to change.
export async function updateContact(id, fields) {
  const properties = {}
  if ('name' in fields)      properties['Name']             = { title: [{ text: { content: fields.name || '' } }] }
  if ('company' in fields)   properties['Company']          = { rich_text: [{ text: { content: fields.company || '' } }] }
  if ('role' in fields)      properties['Role']             = fields.role ? { select: { name: fields.role } } : { select: null }
  if ('email' in fields)     properties['Email']            = { email: fields.email || null }
  if ('linkedin' in fields)  properties['LinkedIn']         = { url: fields.linkedin || null }
  if ('source' in fields)    properties['Source']           = fields.source ? { select: { name: fields.source } } : { select: null }
  if ('status' in fields)    properties['Status']           = fields.status ? { select: { name: fields.status } } : { select: null }
  if ('urgency' in fields)   properties['Urgency']          = fields.urgency ? { select: { name: fields.urgency } } : { select: null }
  if ('notes' in fields)     properties['Notes']            = { rich_text: [{ text: { content: fields.notes || '' } }] }
  if ('whatTheyDid' in fields) properties["What They've Done For Me"] = { rich_text: [{ text: { content: fields.whatTheyDid || '' } }] }
  if ('lastInteraction' in fields) properties['Last Interaction'] = { date: fields.lastInteraction ? { start: fields.lastInteraction } : null }
  if ('followUpDate' in fields)    properties['Follow-Up Date']  = { date: fields.followUpDate ? { start: fields.followUpDate } : null }
  if ('referredById' in fields)    properties['Referred By']     = { relation: fields.referredById ? [{ id: fields.referredById }] : [] }
  if ('followUpDraft' in fields)     properties['Follow-Up Draft']      = { rich_text: [{ text: { content: fields.followUpDraft || '' } }] }
  if ('followUpDraftTier' in fields) properties['Follow-Up Draft Tier'] = { number: fields.followUpDraftTier ?? null }
  if ('followUpDraftKind' in fields) properties['Follow-Up Draft Kind'] = fields.followUpDraftKind ? { select: { name: fields.followUpDraftKind } } : { select: null }
  if ('isUMichAlum' in fields) properties['Is UMich Alum']   = { checkbox: !!fields.isUMichAlum }
  if ('affinity' in fields)    properties['Notable Affinity'] = { multi_select: (fields.affinity || []).map(name => ({ name })) }
  if ('wantsToSchedule' in fields) properties['Wants To Schedule'] = { checkbox: !!fields.wantsToSchedule }
  if ('scheduleBy' in fields)      properties['Schedule By']       = { date: fields.scheduleBy ? { start: fields.scheduleBy } : null }
  if ('scheduleNote' in fields)    properties['Schedule Note']     = { rich_text: [{ text: { content: fields.scheduleNote || '' } }] }
  if ('referralStatus' in fields)  properties['Referral Status']   = fields.referralStatus ? { select: { name: fields.referralStatus } } : { select: null }
  return notionPatch(`/pages/${id}`, { properties })
}

export async function addInteraction({ contactId, contactName, type, direction, date: interactionDate, channelRef, summary, body }) {
  const today = interactionDate || new Date().toISOString().split('T')[0]
  const title = `${type} — ${contactName || '?'} — ${new Date(today).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`
  return notionPost('/pages', {
    parent: { database_id: INTERACTIONS_DB },
    properties: {
      'Title':       { title: [{ text: { content: title } }] },
      'Date':        { date: { start: today } },
      ...(contactId ? { 'Contact': { relation: [{ id: contactId }] } } : {}),
      'Type':        type      ? { select: { name: type } }      : undefined,
      'Direction':   direction ? { select: { name: direction } } : undefined,
      'Channel Ref': channelRef ? { rich_text: [{ text: { content: channelRef } }] } : undefined,
      'Summary':     summary   ? { rich_text: [{ text: { content: summary } }] }   : undefined,
      'Body':        body      ? { rich_text: [{ text: { content: body.slice(0, 2000) } }] } : undefined,
    },
  })
}

export async function fetchInteractions() {
  const pages = await queryDB(INTERACTIONS_DB)
  return pages.map(p => ({
    id:         p.id,
    contactId:  p.properties.Contact?.relation?.[0]?.id || null,
    type:       sel(p.properties.Type),
    direction:  sel(p.properties.Direction),
    date:       date(p.properties.Date),
    channelRef: str(p.properties['Channel Ref']),
    summary:    str(p.properties.Summary),
    body:       str(p.properties.Body),
  })).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
}

export async function fetchApplications() {
  const pages = await queryDB(APPS_DB)
  return pages.map(p => ({
    id:          p.id,
    company:     str(p.properties.Company),
    role:        str(p.properties.Role),
    stage:       sel(p.properties.Stage) || 'Applied',
    triage:      sel(p.properties.Triage) || 'Needs Review',
    location:    str(p.properties.Location),
    sourceRepo:  str(p.properties['Source Repo']),
    appliedDate: date(p.properties['Applied Date']),
    closedDate:  date(p.properties['Closed Date']),
    lastActivity: date(p.properties['Last Activity']),
    daysInStage: num(p.properties['Days in Stage']),
    jdLink:      url(p.properties['JD Link']),
    notes:       str(p.properties.Notes),
    createdTime: p.created_time,
  }))
}

export async function archiveApplication(id) {
  return notionPatch(`/pages/${id}`, { archived: true })
}

export async function archiveContact(id) {
  return notionPatch(`/pages/${id}`, { archived: true })
}
