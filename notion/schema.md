# Notion Database Schema Reference

Quick reference for all 5 databases. Full setup instructions in `plans/phase-1-notion-foundation.md`.

---

## Contacts DB

| Property | Type | Options / Notes |
|---|---|---|
| Name | Title | |
| Company | Text | |
| Role | Select | SWE / PM / Recruiter / Alumni / Referral |
| Email | Email | |
| LinkedIn | URL | Auto-filled by Exa enrichment |
| Source | Select | Coffee chat / Email / Event / Referral / LinkedIn DM |
| Status | Select | 🟢 Warm / 🟡 Cooling / 🔴 Cold / ✅ Closed / ⭐ Champion |
| What They've Done For Me | Text | Referral / intro / insider info / mock interview |
| Last Interaction | Date | Updated on every call or email |
| Follow-Up Date | Date | Set by email pipeline or call processor |
| Urgency | Select | HIGH / MED / LOW |
| Linked Calls | Relation | → Calls DB |
| Linked Applications | Relation | → Applications DB |
| Referred By | Relation | → Contacts DB (self) — who introduced/referred you to this contact |
| Notes | Text | |
| Exa Enriched | Checkbox | Checked after Exa enrichment runs |
| Follow-Up Draft | Text | Persisted current draft (cold-open or follow-up), written by the outreach drafting subsystem (`lib/drafting.js` + `DraftPanel.jsx`). Added by `notion/add-followup-fields.js`. |
| Follow-Up Draft Tier | Number | Escalation tier (1/2/3) the persisted `Follow-Up Draft` was generated for — 0/empty for a cold-open draft. Used to know when to regenerate rather than reuse a stale draft. |
| Follow-Up Draft Kind | Select | `Cold Open` / `Follow-Up` |

---

## Interactions DB

Universal touchpoint ledger — every email, LinkedIn message, call, or meeting gets one row here, regardless of whether it also has a richer artifact elsewhere (e.g. a Calls DB entry). `Last Interaction`/`Follow-Up Date` on Contacts stay as quick-glance fields; this DB is the detailed history.

| Property | Type | Options / Notes |
|---|---|---|
| Title | Title | Format: "[Type] — [Contact] — [Date]" |
| Contact | Relation | → Contacts DB |
| Type | Select | Email / LinkedIn / Call / Meeting / Other |
| Direction | Select | Inbound / Outbound / N/A |
| Date | Date | |
| Channel Ref | Text | Gmail thread id, Calls DB page id, etc. |
| Summary | Text | One-liner (Claude-extracted or manual) |
| Body | Text | Raw pasted/extracted content, truncated |

---

## Calls DB

| Property | Type | Options / Notes |
|---|---|---|
| Title | Title | Format: "[Name] @ [Company] — [Date]" |
| Date | Date | |
| Duration | Number | Minutes |
| Contact | Relation | → Contacts DB |
| Summary | Text | |
| Key Insights | Text | |
| My Commitments | Text | |
| Follow-Up Draft | Text | Claude-drafted email |
| Granola Link | URL | |
| Full Transcript | Text | Paste from Granola (collapse column) |
| Action Status | Select | Pending / Done / N/A |

---

## Applications DB

| Property | Type | Options / Notes |
|---|---|---|
| Company | Title | |
| Role | Text | |
| Stage | Select | Wishlist / Applied / Phone Screen / Technical / Onsite / Offer / Rejected / Accepted |
| Triage | Select | Needs Review / Applying / Maybe / Applied / Pass — set by the Job Boards auto-import, sorted by the user. Rows with Triage=Needs Review or Pass (still at Stage=Wishlist) are excluded from Overview/Pipeline/Actions "active" stats. |
| Location | Text | From the job board listing |
| Source Repo | Text | Which GitHub job board README this row was auto-imported from |
| Applied Date | Date | |
| Last Activity | Date | Auto-updated by email pipeline |
| Recruiter Contact | Relation | → Contacts DB |
| JD Link | URL | |
| Resume Version | Text | |
| Notes | Text | |
| Days in Stage | Formula | `dateBetween(now(), prop("Applied Date"), "days")` |
| Follow-Up Due | Formula | `dateAdd(prop("Applied Date"), 7, "days")` |

---

## LC Problems DB

| Property | Type | Options / Notes |
|---|---|---|
| Problem | Title | "[Title] — LC #[number]" |
| Difficulty | Select | Easy / Medium / Hard |
| Topics | Multi-select | Array, DP, Graph, Tree, Sliding Window, etc. |
| Status | Select | Solved / Attempted / Needs Review |
| Solution Code | Text | Auto-saved by LeetNotion |
| Time to Solve | Number | Minutes |
| Optimal | Checkbox | |
| Review Date | Formula | See below |
| Notes | Text | |
| Solved Date | Date | Auto from LeetNotion |

**Review Date formula:**
```
if(prop("Difficulty") == "Easy", dateAdd(prop("Solved Date"), 7, "days"),
if(prop("Difficulty") == "Medium", dateAdd(prop("Solved Date"), 3, "days"),
dateAdd(prop("Solved Date"), 1, "days")))
```

**"Due for Review" view filter:**
- Review Date ≤ Today
- Status = Solved
- Sort: Review Date ascending

---

## Client-side state (localStorage keys)

Not in Notion — per-browser, set via the dashboard UI. Lost on cache clear; nothing here is backed up.

| Key | Shape | Set by |
|---|---|---|
| `rec_prefs` | `{ targetRoles, preferredLocations, interests, companyType, dealBreakers }` | `jobBoards/PreferencesPanel.jsx` — feeds the Job Boards AI fit-analysis prompt |
| `rec_target_companies` | `string[]` (company names) | `ReferralCoverageTab.jsx` (Network → Coverage view) — cross-referenced against Contacts/Applications by normalized company name (`lib/networkGraph.js`'s `normalizeCompanyName()`) to surface companies with no contact yet |
