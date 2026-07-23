// One-time migration: pulls an existing Notion workspace's Contacts/Calls/
// Applications/Interactions into the new multi-tenant Supabase schema, under
// ONE target user's account (identified by email). Run once per person moving
// off the old single-tenant Notion setup — most likely just the original
// owner, since every new signup starts empty and adds their own data going
// forward.
//
// Usage:
//   node scripts/migrate-notion-to-supabase.js you@example.com
//
// Reads from the repo-root .env: NOTION_API_KEY, CONTACTS_DB_ID, CALLS_DB_ID,
// APPS_DB_ID, INTERACTIONS_DB_ID, SUPABASE_URL (or VITE_SUPABASE_URL),
// SUPABASE_SERVICE_ROLE_KEY. Safe to re-run — it wipes and re-inserts this
// user's rows each time rather than appending duplicates.
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const ws = require('ws')

const NOTION_API_KEY = process.env.NOTION_API_KEY
const CONTACTS_DB = process.env.CONTACTS_DB_ID
const CALLS_DB = process.env.CALLS_DB_ID
const APPS_DB = process.env.APPS_DB_ID
const INTERACTIONS_DB = process.env.INTERACTIONS_DB_ID
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const targetEmail = process.argv[2]

async function main() {
  if (!targetEmail) {
    console.error('Usage: node scripts/migrate-notion-to-supabase.js you@example.com')
    process.exit(1)
  }
  for (const [name, val] of Object.entries({ NOTION_API_KEY, CONTACTS_DB, CALLS_DB, APPS_DB, INTERACTIONS_DB, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
    if (!val) { console.error(`Missing ${name} in .env`); process.exit(1) }
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } })

  const { data: userList, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) throw listErr
  const user = userList.users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase())
  if (!user) {
    console.error(`No signed-up user found with email ${targetEmail} — sign up in the app first, then re-run this script.`)
    process.exit(1)
  }
  console.log(`Migrating into user ${user.id} (${user.email})`)

  console.log('Fetching from Notion...')
  const [contactPages, callPages, appPages, interactionPages] = await Promise.all([
    queryDB(CONTACTS_DB), queryDB(CALLS_DB), queryDB(APPS_DB), queryDB(INTERACTIONS_DB),
  ])
  console.log(`  Contacts: ${contactPages.length}, Calls: ${callPages.length}, Applications: ${appPages.length}, Interactions: ${interactionPages.length}`)

  // Wipe this user's existing rows so the script is idempotent.
  for (const table of ['interactions', 'calls', 'applications', 'contacts']) {
    await db.from(table).delete().eq('user_id', user.id)
  }

  // ── Contacts (two passes: insert, then wire up Referred By self-relation) ──
  const notionIdToNewId = {}
  const contactRows = contactPages.map(p => {
    const row = {
      user_id: user.id,
      name: str(p.properties.Name) || '(unnamed)',
      company: str(p.properties.Company) || null,
      role: sel(p.properties.Role) || null,
      email: p.properties.Email?.email || null,
      linkedin: url(p.properties.LinkedIn),
      source: sel(p.properties.Source) || null,
      status: sel(p.properties.Status) || '🟡 Cooling',
      urgency: sel(p.properties.Urgency) || 'LOW',
      last_interaction: date(p.properties['Last Interaction']),
      follow_up_date: date(p.properties['Follow-Up Date']),
      notes: str(p.properties.Notes) || null,
      what_they_did: str(p.properties["What They've Done For Me"]) || null,
      follow_up_draft: str(p.properties['Follow-Up Draft']) || null,
      follow_up_draft_tier: num(p.properties['Follow-Up Draft Tier']),
      follow_up_draft_kind: sel(p.properties['Follow-Up Draft Kind']) || null,
      is_school_alum: bool(p.properties['Is UMich Alum']),
      affinity: multiSel(p.properties['Notable Affinity']),
      exa_enriched: bool(p.properties['Exa Enriched']),
      wants_to_schedule: bool(p.properties['Wants To Schedule']),
      schedule_by: date(p.properties['Schedule By']),
      schedule_note: str(p.properties['Schedule Note']) || null,
      referral_status: sel(p.properties['Referral Status']) || 'Not Asked',
    }
    return { notionId: p.id, referredByNotionId: p.properties['Referred By']?.relation?.[0]?.id || null, row }
  })

  if (contactRows.length) {
    const { data: inserted, error } = await db.from('contacts')
      .insert(contactRows.map(c => c.row))
      .select('id')
    if (error) throw error
    inserted.forEach((r, i) => { notionIdToNewId[contactRows[i].notionId] = r.id })

    const updates = contactRows
      .filter(c => c.referredByNotionId && notionIdToNewId[c.referredByNotionId])
      .map(c => db.from('contacts').update({ referred_by_id: notionIdToNewId[c.referredByNotionId] }).eq('id', notionIdToNewId[c.notionId]))
    await Promise.all(updates)
    console.log(`  Inserted ${inserted.length} contacts`)
  }

  // ── Calls ─────────────────────────────────────────────────────────────────
  const callRows = callPages.map(p => ({
    user_id: user.id,
    title: str(p.properties.Title) || null,
    contact_id: mapContact(p.properties.Contact, notionIdToNewId),
    date: date(p.properties.Date),
    duration: num(p.properties.Duration),
    summary: str(p.properties.Summary) || null,
    key_insights: str(p.properties['Key Insights']) || null,
    my_commitments: str(p.properties['My Commitments']) || null,
    follow_up_draft: str(p.properties['Follow-Up Draft']) || null,
    granola_link: url(p.properties['Granola Link']),
    full_transcript: str(p.properties['Full Transcript']) || null,
    action_status: sel(p.properties['Action Status']) || 'Pending',
  }))
  if (callRows.length) {
    const { error } = await db.from('calls').insert(callRows)
    if (error) throw error
    console.log(`  Inserted ${callRows.length} calls`)
  }

  // ── Applications ─────────────────────────────────────────────────────────
  const appRows = appPages.map(p => ({
    user_id: user.id,
    company: str(p.properties.Company) || '(unnamed)',
    role: str(p.properties.Role) || null,
    stage: sel(p.properties.Stage) || 'Applied',
    triage: sel(p.properties.Triage) || 'Needs Review',
    location: str(p.properties.Location) || null,
    source_repo: str(p.properties['Source Repo']) || null,
    applied_date: date(p.properties['Applied Date']),
    closed_date: date(p.properties['Closed Date']),
    last_activity: date(p.properties['Last Activity']),
    jd_link: url(p.properties['JD Link']),
    resume_version: str(p.properties['Resume Version']) || null,
    notes: str(p.properties.Notes) || null,
  }))
  if (appRows.length) {
    const { error } = await db.from('applications').insert(appRows)
    if (error) throw error
    console.log(`  Inserted ${appRows.length} applications`)
  }

  // ── Interactions ──────────────────────────────────────────────────────────
  const interactionRows = interactionPages.map(p => ({
    user_id: user.id,
    contact_id: mapContact(p.properties.Contact, notionIdToNewId),
    type: sel(p.properties.Type) || null,
    direction: sel(p.properties.Direction) || null,
    date: date(p.properties.Date),
    channel_ref: str(p.properties['Channel Ref']) || null,
    summary: str(p.properties.Summary) || null,
    body: str(p.properties.Body) || null,
  }))
  if (interactionRows.length) {
    const { error } = await db.from('interactions').insert(interactionRows)
    if (error) throw error
    console.log(`  Inserted ${interactionRows.length} interactions`)
  }

  console.log('Done. Sign in as that user in the app to see the migrated data.')
}

function mapContact(relationProp, notionIdToNewId) {
  const notionId = relationProp?.relation?.[0]?.id
  return notionId ? (notionIdToNewId[notionId] || null) : null
}

// ── Notion API helpers (mirrors the old app/src/notion.js field parsers) ────

async function queryDB(dbId) {
  const pages = []
  let cursor
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `Notion ${res.status} for db ${dbId}`)
    }
    const data = await res.json()
    pages.push(...(data.results || []))
    cursor = data.has_more ? data.next_cursor : null
  } while (cursor)
  return pages
}

function str(prop) { return prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || '' }
function sel(prop) { return prop?.select?.name || '' }
function date(prop) { return prop?.date?.start || null }
function url(prop) { return prop?.url || null }
function num(prop) { return prop?.formula?.number ?? prop?.number ?? null }
function bool(prop) { return prop?.checkbox || false }
function multiSel(prop) { return (prop?.multi_select || []).map(o => o.name) }

main().catch(e => { console.error(e); process.exit(1) })
