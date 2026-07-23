// Multi-tenant data layer — replaces the old notion.js (which hardcoded one
// person's Notion workspace DB IDs). Every table is scoped by user_id + RLS
// (see supabase/migrations/*_init.sql), so this file never needs to filter by
// user itself — Postgres does it via `auth.uid() = user_id` policies, keyed
// off the signed-in user's session that lib/supabaseClient.js's `supabase`
// client already carries. Every exported function here keeps the EXACT same
// name/signature/return shape as the old notion.js so every component that
// imported it (ContactDetailModal, LogInteractionModal, PipelineTab, etc.)
// needed zero changes beyond the import path.
import { supabase } from './lib/supabaseClient.js'
import { DEMO_CONTACTS, DEMO_APPLICATIONS, DEMO_INTERACTIONS, DEMO_CALLS, nextDemoId } from './demoData.js'

function todayStr() { return new Date().toISOString().split('T')[0] }
function plusDays(n) { return new Date(Date.now() + n * 86400000).toISOString().split('T')[0] }
function daysBetween(a, b) { return Math.floor((a.getTime() - b.getTime()) / 86400000) }

function throwIfError(error, action) {
  if (error) throw new Error(`${action}: ${error.message}`)
}

// ── Demo mode (public /demo route — see App.jsx's DemoApp, no sign-in) ─────────
//
// Every exported function below checks isDemoMode() first and, if true, reads/writes an
// in-memory clone of demoData.js instead of ever touching Supabase — so a visitor to
// /demo gets a fully working CRM (add a contact, log an interaction, drag an application
// between stages) with zero backend calls and zero real auth. State lives in module-level
// arrays seeded lazily on first access and resets on page reload — deliberate: a shared
// public demo should never accumulate one visitor's edits into the next visitor's session.
function isDemoMode() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')
}

let demo = null
function demoStore() {
  if (!demo) {
    demo = {
      contacts: DEMO_CONTACTS.map(c => ({ ...c })),
      applications: DEMO_APPLICATIONS.map(a => ({ ...a })),
      interactions: DEMO_INTERACTIONS.map(i => ({ ...i })),
      calls: DEMO_CALLS.map(c => ({ ...c })),
    }
  }
  return demo
}

// ── Contacts ────────────────────────────────────────────────────────────────

function mapContactRow(r) {
  return {
    id: r.id,
    name: r.name,
    company: r.company || '',
    role: r.role || '',
    email: r.email || '',
    linkedin: r.linkedin || null,
    source: r.source || '',
    status: r.status || '🟡 Cooling',
    urgency: r.urgency || 'LOW',
    lastInteraction: r.last_interaction,
    followUpDate: r.follow_up_date,
    notes: r.notes || '',
    whatTheyDid: r.what_they_did || '',
    referredById: r.referred_by_id || null,
    followUpDraft: r.follow_up_draft || '',
    followUpDraftTier: r.follow_up_draft_tier,
    followUpDraftKind: r.follow_up_draft_kind || '',
    isUMichAlum: !!r.is_school_alum,
    affinity: r.affinity || [],
    wantsToSchedule: !!r.wants_to_schedule,
    scheduleBy: r.schedule_by,
    scheduleNote: r.schedule_note || '',
    referralStatus: r.referral_status || 'Not Asked',
  }
}

export async function searchContactByName(name) {
  if (isDemoMode()) {
    const firstWord = name.split(' ')[0].toLowerCase()
    const match = demoStore().contacts.find(c => c.name.toLowerCase().includes(firstWord))
    return match ? { id: match.id, name: match.name } : null
  }
  const firstWord = name.split(' ')[0]
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('archived', false)
    .ilike('name', `%${firstWord}%`)
    .limit(5)
  if (error) return null
  return data?.[0] || null
}

export async function addContact({ name, company, role, email }) {
  const ROLE_OPTIONS = ['SWE', 'PM', 'Recruiter', 'Alumni', 'Referral', 'Other']
  const roleSelect = ROLE_OPTIONS.find(r => role?.toLowerCase().includes(r.toLowerCase())) || 'Other'
  if (isDemoMode()) {
    const id = nextDemoId()
    demoStore().contacts.push({
      id, name, company: company || '', role: roleSelect, email: email || '', linkedin: null, source: '',
      status: '🟡 Cooling', urgency: 'LOW', lastInteraction: todayStr(), followUpDate: plusDays(3), notes: '',
      whatTheyDid: '', referredById: null, followUpDraft: '', followUpDraftTier: null, followUpDraftKind: '',
      isUMichAlum: false, affinity: [], wantsToSchedule: false, scheduleBy: null, scheduleNote: '',
      referralStatus: 'Not Asked', referredByName: null,
    })
    return { id }
  }
  const { data, error } = await supabase.from('contacts').insert({
    name,
    company: company || null,
    role: roleSelect,
    email: email || null,
    status: '🟡 Cooling',
    last_interaction: todayStr(),
    follow_up_date: plusDays(3),
  }).select('id').single()
  throwIfError(error, 'addContact')
  return data
}

const CONTACT_FIELD_MAP = {
  name: 'name',
  company: 'company',
  email: 'email',
  linkedin: 'linkedin',
  notes: 'notes',
  whatTheyDid: 'what_they_did',
  followUpDraft: 'follow_up_draft',
  scheduleNote: 'schedule_note',
}

const CONTACT_DEMO_KEYS = [
  'name', 'company', 'role', 'email', 'linkedin', 'notes', 'whatTheyDid', 'followUpDraft', 'scheduleNote',
  'source', 'status', 'urgency', 'lastInteraction', 'followUpDate', 'referredById', 'followUpDraftTier',
  'followUpDraftKind', 'isUMichAlum', 'affinity', 'exaEnriched', 'wantsToSchedule', 'scheduleBy', 'referralStatus',
]

export async function updateContact(id, fields) {
  if (isDemoMode()) {
    const { contacts } = demoStore()
    const c = contacts.find(c => c.id === id)
    if (!c) return
    for (const k of CONTACT_DEMO_KEYS) if (k in fields) c[k] = fields[k]
    if ('referredById' in fields) {
      const ref = contacts.find(x => x.id === fields.referredById)
      c.referredByName = ref ? ref.name : null
    }
    return
  }
  const patch = {}
  for (const [jsKey, col] of Object.entries(CONTACT_FIELD_MAP)) {
    if (jsKey in fields) patch[col] = fields[jsKey] || ''
  }
  if ('role' in fields) patch.role = fields.role || null
  if ('source' in fields) patch.source = fields.source || null
  if ('status' in fields) patch.status = fields.status || null
  if ('urgency' in fields) patch.urgency = fields.urgency || null
  if ('lastInteraction' in fields) patch.last_interaction = fields.lastInteraction || null
  if ('followUpDate' in fields) patch.follow_up_date = fields.followUpDate || null
  if ('referredById' in fields) patch.referred_by_id = fields.referredById || null
  if ('followUpDraftTier' in fields) patch.follow_up_draft_tier = fields.followUpDraftTier ?? null
  if ('followUpDraftKind' in fields) patch.follow_up_draft_kind = fields.followUpDraftKind || null
  if ('isUMichAlum' in fields) patch.is_school_alum = !!fields.isUMichAlum
  if ('affinity' in fields) patch.affinity = fields.affinity || []
  if ('exaEnriched' in fields) patch.exa_enriched = !!fields.exaEnriched
  if ('wantsToSchedule' in fields) patch.wants_to_schedule = !!fields.wantsToSchedule
  if ('scheduleBy' in fields) patch.schedule_by = fields.scheduleBy || null
  if ('referralStatus' in fields) patch.referral_status = fields.referralStatus || null

  const { error } = await supabase.from('contacts').update(patch).eq('id', id)
  throwIfError(error, 'updateContact')
}

export async function fetchContacts() {
  if (isDemoMode()) return demoStore().contacts.map(c => ({ ...c }))
  const { data, error } = await supabase.from('contacts').select('*').eq('archived', false)
  throwIfError(error, 'fetchContacts')
  const contacts = (data || []).map(mapContactRow)
  const byId = Object.fromEntries(contacts.map(c => [c.id, c]))
  return contacts.map(c => ({ ...c, referredByName: c.referredById ? (byId[c.referredById]?.name || null) : null }))
}

export async function archiveContact(id) {
  if (isDemoMode()) {
    const { contacts } = demoStore()
    const i = contacts.findIndex(c => c.id === id)
    if (i !== -1) contacts.splice(i, 1)
    return
  }
  const { error } = await supabase.from('contacts').update({ archived: true }).eq('id', id)
  throwIfError(error, 'archiveContact')
}

// ── Calls ───────────────────────────────────────────────────────────────────

export async function addCallEntry({ contactId, contactName, company, summary, keyInsights, commitments, followUpDraft }) {
  const title = `${contactName} @ ${company || '?'} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  if (isDemoMode()) {
    const id = nextDemoId()
    demoStore().calls.push({ id, title, contactId: contactId || null, date: todayStr(), summary: summary || '', keyInsights: keyInsights || '', fullTranscript: '' })
    return { id }
  }
  const { data, error } = await supabase.from('calls').insert({
    title,
    date: todayStr(),
    contact_id: contactId || null,
    summary: summary || null,
    key_insights: keyInsights || null,
    my_commitments: commitments || null,
    follow_up_draft: followUpDraft || null,
  }).select('id').single()
  throwIfError(error, 'addCallEntry')
  return data
}

export async function fetchCalls() {
  if (isDemoMode()) return demoStore().calls.map(c => ({ ...c }))
  const { data, error } = await supabase.from('calls').select('*')
  throwIfError(error, 'fetchCalls')
  return (data || []).map(r => ({
    id: r.id,
    title: r.title || '',
    contactId: r.contact_id || null,
    date: r.date,
    summary: r.summary || '',
    keyInsights: r.key_insights || '',
    fullTranscript: r.full_transcript || '',
  }))
}

// ── Applications ─────────────────────────────────────────────────────────────

export async function addApplication({ company, role, jdLink, location, sourceRepo, datePosted }) {
  if (isDemoMode()) {
    const id = nextDemoId()
    demoStore().applications.push({
      id, company, role: role || '', stage: 'Wishlist', triage: 'Needs Review', location: location || '',
      sourceRepo: sourceRepo || '', appliedDate: null, closedDate: null, lastActivity: todayStr(), daysInStage: null,
      jdLink: jdLink || '', notes: datePosted ? `Posted ${datePosted}` : '', createdTime: todayStr(),
    })
    return { id }
  }
  const { data, error } = await supabase.from('applications').insert({
    company,
    role: role || null,
    jd_link: jdLink || null,
    location: location || null,
    source_repo: sourceRepo || null,
    notes: datePosted ? `Posted ${datePosted}` : null,
    stage: 'Wishlist',
    triage: 'Needs Review',
  }).select('id').single()
  throwIfError(error, 'addApplication')
  return data
}

export async function updateApplicationTriage(id, triage, currentStage) {
  if (isDemoMode()) {
    const a = demoStore().applications.find(a => a.id === id)
    if (!a) return
    a.triage = triage
    if (triage === 'Applied' && (!currentStage || currentStage === 'Wishlist')) {
      a.stage = 'Applied'
      a.appliedDate = todayStr()
    }
    return
  }
  const patch = { triage }
  if (triage === 'Applied' && (!currentStage || currentStage === 'Wishlist')) {
    patch.stage = 'Applied'
    patch.applied_date = todayStr()
  }
  const { error } = await supabase.from('applications').update(patch).eq('id', id)
  throwIfError(error, 'updateApplicationTriage')
}

export async function updateApplication(id, fields) {
  if (isDemoMode()) {
    const a = demoStore().applications.find(a => a.id === id)
    if (!a) return
    for (const k of ['company', 'role', 'location', 'jdLink', 'notes', 'stage', 'appliedDate', 'closedDate']) {
      if (k in fields) a[k] = fields[k]
    }
    return
  }
  const patch = {}
  if ('company' in fields) patch.company = fields.company || ''
  if ('role' in fields) patch.role = fields.role || ''
  if ('location' in fields) patch.location = fields.location || ''
  if ('jdLink' in fields) patch.jd_link = fields.jdLink || null
  if ('notes' in fields) patch.notes = fields.notes || ''
  if ('stage' in fields) patch.stage = fields.stage || null
  if ('appliedDate' in fields) patch.applied_date = fields.appliedDate || null
  if ('closedDate' in fields) patch.closed_date = fields.closedDate || null
  const { error } = await supabase.from('applications').update(patch).eq('id', id)
  throwIfError(error, 'updateApplication')
}

export async function fetchApplications() {
  if (isDemoMode()) return demoStore().applications.map(a => ({ ...a }))
  const { data, error } = await supabase.from('applications').select('*').eq('archived', false)
  throwIfError(error, 'fetchApplications')
  const now = new Date()
  return (data || []).map(r => ({
    id: r.id,
    company: r.company || '',
    role: r.role || '',
    stage: r.stage || 'Applied',
    triage: r.triage || 'Needs Review',
    location: r.location || '',
    sourceRepo: r.source_repo || '',
    appliedDate: r.applied_date,
    closedDate: r.closed_date,
    lastActivity: r.last_activity,
    daysInStage: r.applied_date ? daysBetween(now, new Date(r.applied_date)) : null,
    jdLink: r.jd_link,
    notes: r.notes || '',
    createdTime: r.created_at,
  }))
}

export async function archiveApplication(id) {
  if (isDemoMode()) {
    const { applications } = demoStore()
    const i = applications.findIndex(a => a.id === id)
    if (i !== -1) applications.splice(i, 1)
    return
  }
  const { error } = await supabase.from('applications').update({ archived: true }).eq('id', id)
  throwIfError(error, 'archiveApplication')
}

// ── Interactions ─────────────────────────────────────────────────────────────

export async function addInteraction({ contactId, contactName, type, direction, date: interactionDate, channelRef, summary, body }) {
  const date = interactionDate || todayStr()
  const title = `${type} — ${contactName || '?'} — ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  if (isDemoMode()) {
    const id = nextDemoId()
    demoStore().interactions.push({ id, contactId: contactId || null, type: type || '', direction: direction || '', date, channelRef: channelRef || '', summary: summary || '', body: body ? body.slice(0, 2000) : '' })
    return { id, title }
  }
  const { data, error } = await supabase.from('interactions').insert({
    contact_id: contactId || null,
    type: type || null,
    direction: direction || null,
    date,
    channel_ref: channelRef || null,
    summary: summary || null,
    body: body ? body.slice(0, 2000) : null,
  }).select('id').single()
  throwIfError(error, 'addInteraction')
  return { id: data.id, title }
}

export async function fetchInteractions() {
  if (isDemoMode()) {
    return demoStore().interactions.map(i => ({ ...i })).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }
  const { data, error } = await supabase.from('interactions').select('*')
  throwIfError(error, 'fetchInteractions')
  return (data || [])
    .map(r => ({
      id: r.id,
      contactId: r.contact_id || null,
      type: r.type || '',
      direction: r.direction || '',
      date: r.date,
      channelRef: r.channel_ref || '',
      summary: r.summary || '',
      body: r.body || '',
    }))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
}
