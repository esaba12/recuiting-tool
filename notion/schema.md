# Notion Database Schema Reference

Quick reference for all 4 databases. Full setup instructions in `plans/phase-1-notion-foundation.md`.

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
| Notes | Text | |
| Exa Enriched | Checkbox | Checked after Exa enrichment runs |

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
