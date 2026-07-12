// Rajkumar, Saint-Jacques, Bojinov, Brynjolfsson, Aral, "A causal test of the strength of
// weak ties," Science 377(6612), 2022 — large-scale randomized experiments on LinkedIn's
// "People You May Know" (20M+ people, 5 years, 2B new ties, 600K new jobs) found an
// inverted-U relationship between tie strength and job transmission: the *weakest* ties
// aren't the best at producing referrals/job mobility, moderately weak ties are. So this
// intentionally does NOT just rank "most interactions first" — a contact you talk to
// constantly (strong tie) and a total stranger (near-zero tie) both score lower than
// someone you've had a few real touches with.
//
// tieStrengthBucket is a coarse 2-signal proxy (raw interaction count) standing in for
// the paper's real construct, which was measured at LinkedIn's platform scale using
// message-frequency/mutual-connection data this app doesn't have. Present it in the UI
// as an inspectable, overridable sort nudge — not a hard filter.
export function tieStrengthBucket(contact, interactions) {
  const count = interactions.filter(i => i.contactId === contact.id).length
  if (count === 0) return 'cold'
  if (count <= 2) return 'weak'
  if (count <= 6) return 'moderate'
  return 'strong'
}

const TIE_STRENGTH_SCORE = { cold: 0, weak: 2, moderate: 3, strong: 1 }
const AFFINITY_BONUS = 1

// contact.affinity already includes 'UMich' whenever isUMichAlum is checked (the two
// fields are kept in sync on write — see ContactDetailModal), so affinity.length alone
// covers both without double-counting.
export function affinityScore(contact, interactions) {
  const tieScore = TIE_STRENGTH_SCORE[tieStrengthBucket(contact, interactions)]
  const affinityCount = contact.affinity?.length || 0
  return tieScore + Math.min(affinityCount, 2) * AFFINITY_BONUS
}
