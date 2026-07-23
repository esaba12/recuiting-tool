// Seed data for the public, no-sign-in /demo route (see db.js's isDemoMode() branch and
// App.jsx's DemoApp). Entirely fictional — a sample CS student's job search, not any real
// person's data — so this is safe to seed for anonymous portfolio visitors. Dates are
// computed relative to "today" (not hardcoded) so the demo always looks current whenever
// someone visits, rather than drifting stale.
//
// Shapes below intentionally match db.js's fetch* return shapes EXACTLY (camelCase, same
// keys) — the demo branch in db.js returns these arrays directly with zero mapping, so any
// component built against real data works unmodified against this data.

function daysFromNow(n) {
  return new Date(Date.now() + n * 86400000).toISOString().split('T')[0]
}

let idCounter = 1000
export function nextDemoId() {
  return `demo-${idCounter++}`
}

export const DEMO_CONTACTS = [
  {
    id: 'demo-c1', name: 'Priya Shah', company: 'Stripe', role: 'Recruiter', email: 'priya.shah@stripe.com',
    linkedin: 'https://linkedin.com/in/example', source: 'Referral', status: '🟢 Warm', urgency: 'HIGH',
    lastInteraction: daysFromNow(-2), followUpDate: daysFromNow(1), notes: 'Moving me to the recruiter screen next week.',
    whatTheyDid: 'University recruiter for Stripe\'s infra team.', referredById: null, followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: false, affinity: [], wantsToSchedule: true, scheduleBy: daysFromNow(2),
    scheduleNote: 'Wants to set up the recruiter screen', referralStatus: 'Not Asked', referredByName: null,
  },
  {
    id: 'demo-c2', name: 'Marcus Chen', company: 'Notion', role: 'SWE', email: 'marcus.chen@makenotion.com',
    linkedin: 'https://linkedin.com/in/example', source: 'Cold Outreach', status: '🟡 Cooling', urgency: 'MED',
    lastInteraction: daysFromNow(-9), followUpDate: daysFromNow(-1), notes: 'Great call about the infra team — said he\'d refer me.',
    whatTheyDid: 'SWE on the collaborative editing team, alum of the same program.', referredById: null, followUpDraft: '',
    followUpDraftTier: null, followUpDraftKind: '', isUMichAlum: true, affinity: ['Shared university'], wantsToSchedule: false,
    scheduleBy: null, scheduleNote: '', referralStatus: 'Asked', referredByName: null,
  },
  {
    id: 'demo-c3', name: 'Jordan Ellis', company: 'Figma', role: 'PM', email: 'jordan.ellis@figma.com',
    linkedin: '', source: 'LinkedIn', status: '🟢 Warm', urgency: 'MED',
    lastInteraction: daysFromNow(-4), followUpDate: daysFromNow(3), notes: 'Sent a great intro doc about the PM internship rotation.',
    whatTheyDid: 'PM on Figma\'s dev-mode team.', referredById: null, followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: false, affinity: [], wantsToSchedule: false, scheduleBy: null, scheduleNote: '',
    referralStatus: 'Not Asked', referredByName: null,
  },
  {
    id: 'demo-c4', name: 'Sofia Ramirez', company: 'Anthropic', role: 'SWE', email: 'sofia.ramirez@anthropic.com',
    linkedin: '', source: 'Career Fair', status: '⭐ Champion', urgency: 'HIGH',
    lastInteraction: daysFromNow(-1), followUpDate: daysFromNow(2), notes: 'Championing my app internally, said she\'d ping the hiring manager.',
    whatTheyDid: 'SWE on model behavior — met at the fall career fair.', referredById: null, followUpDraft: '',
    followUpDraftTier: null, followUpDraftKind: '', isUMichAlum: false, affinity: [], wantsToSchedule: false, scheduleBy: null,
    scheduleNote: '', referralStatus: 'Yes', referredByName: null,
  },
  {
    id: 'demo-c5', name: 'Devon Park', company: 'Ramp', role: 'SWE', email: 'devon.park@ramp.com',
    linkedin: '', source: 'Referral', status: '🔴 Cold', urgency: 'LOW',
    lastInteraction: daysFromNow(-32), followUpDate: null, notes: 'Coffee chat a month ago, no response since.',
    whatTheyDid: 'SWE on Ramp\'s platform team.', referredById: 'demo-c2', followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: false, affinity: [], wantsToSchedule: false, scheduleBy: null, scheduleNote: '',
    referralStatus: 'Not Asked', referredByName: 'Marcus Chen',
  },
  {
    id: 'demo-c6', name: 'Amara Osei', company: 'Vercel', role: 'SWE', email: 'amara.osei@vercel.com',
    linkedin: '', source: 'LinkedIn', status: '🟡 Cooling', urgency: 'MED',
    lastInteraction: daysFromNow(-11), followUpDate: daysFromNow(-3), notes: 'Answered a few questions about the interview loop.',
    whatTheyDid: 'SWE on the Next.js team.', referredById: null, followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: true, affinity: ['Shared university'], wantsToSchedule: false, scheduleBy: null,
    scheduleNote: '', referralStatus: 'Not Asked', referredByName: null,
  },
  {
    id: 'demo-c7', name: 'Liam Foster', company: 'Airbnb', role: 'Alumni', email: 'liam.foster@alumni.example.com',
    linkedin: '', source: 'Alumni Network', status: '✅ Closed', urgency: 'LOW',
    lastInteraction: daysFromNow(-60), followUpDate: null, notes: 'Great chat, but he switched teams — dead end for now.',
    whatTheyDid: 'Former SWE at Airbnb, now at a startup.', referredById: null, followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: true, affinity: ['Shared university'], wantsToSchedule: false, scheduleBy: null,
    scheduleNote: '', referralStatus: 'Not Asked', referredByName: null,
  },
]

export const DEMO_APPLICATIONS = [
  { id: 'demo-a1', company: 'Stripe', role: 'SWE Intern, Infrastructure', stage: 'Phone Screen', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-14), closedDate: null, lastActivity: daysFromNow(-2), daysInStage: 14, jdLink: 'https://stripe.com/jobs', notes: 'Recruiter screen scheduled via Priya.', createdTime: daysFromNow(-20) },
  { id: 'demo-a2', company: 'Anthropic', role: 'SWE Intern', stage: 'Interview', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-21), closedDate: null, lastActivity: daysFromNow(-1), daysInStage: 6, jdLink: 'https://anthropic.com/careers', notes: 'First technical round went well.', createdTime: daysFromNow(-25) },
  { id: 'demo-a3', company: 'Figma', role: 'PM Intern', stage: 'Applied', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-6), closedDate: null, lastActivity: daysFromNow(-4), daysInStage: 6, jdLink: 'https://figma.com/careers', notes: '', createdTime: daysFromNow(-6) },
  { id: 'demo-a4', company: 'Vercel', role: 'SWE Intern', stage: 'Applied', triage: 'Applied', location: 'Remote', sourceRepo: 'SimplifyJobs/Summer2027-Internships', appliedDate: daysFromNow(-18), closedDate: null, lastActivity: daysFromNow(-18), daysInStage: 18, jdLink: 'https://vercel.com/careers', notes: '', createdTime: daysFromNow(-18) },
  { id: 'demo-a5', company: 'Ramp', role: 'SWE Intern', stage: 'Offer', triage: 'Applied', location: 'New York, NY', sourceRepo: '', appliedDate: daysFromNow(-40), closedDate: null, lastActivity: daysFromNow(-5), daysInStage: 5, jdLink: 'https://ramp.com/careers', notes: 'Offer received, deciding by end of month.', createdTime: daysFromNow(-45) },
  { id: 'demo-a6', company: 'Notion', role: 'SWE Intern', stage: 'Rejected', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-50), closedDate: daysFromNow(-10), lastActivity: daysFromNow(-10), daysInStage: 10, jdLink: '', notes: 'Didn\'t move past the first round.', createdTime: daysFromNow(-55) },
  { id: 'demo-a7', company: 'Airbnb', role: 'SWE Intern', stage: 'Wishlist', triage: 'Needs Review', location: 'San Francisco, CA', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: null, closedDate: null, lastActivity: daysFromNow(-1), daysInStage: null, jdLink: 'https://careers.airbnb.com', notes: '', createdTime: daysFromNow(-1) },
  { id: 'demo-a8', company: 'Discord', role: 'SWE Intern', stage: 'Wishlist', triage: 'Needs Review', location: 'San Francisco, CA', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: null, closedDate: null, lastActivity: daysFromNow(-1), daysInStage: null, jdLink: 'https://discord.com/careers', notes: '', createdTime: daysFromNow(-1) },
  { id: 'demo-a9', company: 'Rippling', role: 'SWE Intern', stage: 'Applied', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: daysFromNow(-3), closedDate: null, lastActivity: daysFromNow(-3), daysInStage: 3, jdLink: '', notes: '', createdTime: daysFromNow(-3) },
  { id: 'demo-a10', company: 'Linear', role: 'SWE Intern', stage: 'Wishlist', triage: 'Maybe', location: 'Remote', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: null, closedDate: null, lastActivity: daysFromNow(-2), daysInStage: null, jdLink: '', notes: 'Small team, not sure about internship structure yet.', createdTime: daysFromNow(-2) },
]

export const DEMO_INTERACTIONS = [
  { id: 'demo-i1', contactId: 'demo-c1', type: 'Email', direction: 'Inbound', date: daysFromNow(-2), channelRef: '', summary: 'Priya confirmed the recruiter screen is being scheduled.', body: '' },
  { id: 'demo-i2', contactId: 'demo-c4', type: 'Call', direction: 'Outbound', date: daysFromNow(-1), channelRef: '', summary: 'Great 20-min call — Sofia is championing my application internally.', body: '' },
  { id: 'demo-i3', contactId: 'demo-c2', type: 'Call', direction: 'Outbound', date: daysFromNow(-9), channelRef: '', summary: 'Marcus walked me through the infra team\'s interview loop and offered a referral.', body: '' },
  { id: 'demo-i4', contactId: 'demo-c3', type: 'LinkedIn', direction: 'Inbound', date: daysFromNow(-4), channelRef: '', summary: 'Jordan sent over a doc on Figma\'s PM rotation program.', body: '' },
  { id: 'demo-i5', contactId: 'demo-c6', type: 'LinkedIn', direction: 'Outbound', date: daysFromNow(-11), channelRef: '', summary: 'Asked Amara a few questions about Vercel\'s interview process.', body: '' },
  { id: 'demo-i6', contactId: 'demo-c5', type: 'Meeting', direction: 'Outbound', date: daysFromNow(-32), channelRef: '', summary: 'Coffee chat with Devon about the Ramp platform team.', body: '' },
  { id: 'demo-i7', contactId: 'demo-c7', type: 'Meeting', direction: 'Outbound', date: daysFromNow(-60), channelRef: '', summary: 'Intro call through the alumni network.', body: '' },
]

export const DEMO_CALLS = [
  {
    id: 'demo-cl1', title: 'Sofia Ramirez @ Anthropic', contactId: 'demo-c4', date: daysFromNow(-1),
    summary: 'Discussed the model behavior team\'s current projects and the internship interview loop.',
    keyInsights: 'Team is growing fast; she\'ll flag my app to the hiring manager this week.',
    fullTranscript: '',
  },
  {
    id: 'demo-cl2', title: 'Marcus Chen @ Notion', contactId: 'demo-c2', date: daysFromNow(-9),
    summary: 'Deep dive on Notion\'s collaborative editing infra and what the intern project scope usually looks like.',
    keyInsights: 'Referrals go through an internal form; he\'ll submit one this week.',
    fullTranscript: '',
  },
  {
    id: 'demo-cl3', title: 'Devon Park @ Ramp', contactId: 'demo-c5', date: daysFromNow(-32),
    summary: 'Coffee chat about Ramp\'s platform team and general internship search advice.',
    keyInsights: 'Suggested applying early since their intern class fills up fast.',
    fullTranscript: '',
  },
]
