# Phase 1 — Notion Foundation

**Branch:** `notion-setup` (worktree at `.worktrees/notion-setup/`)  
**Time:** ~2 hours  
**Day:** Day 1  
**Deliverable:** Notion hub ready to receive data from all 4 pipelines

---

## What You're Building

A Notion workspace with exactly 4 databases:

| DB | Purpose | Auto-populated by |
|---|---|---|
| Contacts DB | Master CRM — one row per person | Email pipeline, Cowork call processor |
| Calls DB | One row per call | Cowork call processor (manual trigger) |
| Applications DB | One row per company/role | Email pipeline |
| LeetCode Problems DB | One row per problem solved | LeetNotion extension (Phase 2) |

These 4 databases are the entire "hub" of the system. Everything else just reads from or writes to them.

---

## Prerequisites

- Notion account (free tier is fine)
- That's it. No other accounts needed yet.

---

## Step 1: Create Notion Account (skip if you have one)

Go to notion.so → Sign up free. Use your personal email (not school email — you'll want access after graduation).

---

## Step 2: Create the 4 Databases

Create each database as a **full-page database** (not inline). This matters because Gumloop's Notion MCP and the LeetNotion extension both target databases by their Database ID, which only full-page databases expose cleanly.

### 2a — Contacts DB

Create a new page titled "Contacts DB". Click the `/` command → select "Table — Full Page".

Add these properties (in this order — order matters for readability):

| Property Name | Type | Notes |
|---|---|---|
| Name | Title | Default — rename from "Name" if it's already there |
| Company | Text | |
| Role | Select | Add options: SWE / PM / Recruiter / Alumni / Referral |
| Email | Email | |
| LinkedIn | URL | |
| Source | Select | Options: Coffee chat / Email / Event / Referral / LinkedIn DM |
| Status | Select | Options: 🟢 Warm / 🟡 Cooling / 🔴 Cold / ✅ Closed / ⭐ Champion |
| What They've Done For Me | Text | |
| Last Interaction | Date | |
| Follow-Up Date | Date | |
| Urgency | Select | Options: HIGH / MED / LOW |
| Linked Calls | Relation | → link to Calls DB (set up AFTER creating Calls DB) |
| Linked Applications | Relation | → link to Applications DB (set up AFTER) |
| Notes | Text | |
| Exa Enriched | Checkbox | |

### 2b — Calls DB

New page → "Calls DB" → Table — Full Page.

| Property Name | Type | Notes |
|---|---|---|
| Title | Title | Format: "[Name] @ [Company] — [Date]" — filled by Claude |
| Date | Date | |
| Duration | Number | Unit: minutes |
| Contact | Relation | → Contacts DB |
| Summary | Text | |
| Key Insights | Text | |
| My Commitments | Text | |
| Follow-Up Draft | Text | |
| Granola Link | URL | Paste Granola meeting URL if shared |
| Full Transcript | Text | Pasted from Granola (collapse this column) |
| Action Status | Select | Options: Pending / Done / N/A |

After creating both, go back to Contacts DB → edit "Linked Calls" relation → point it at Calls DB.

### 2c — Applications DB

New page → "Applications DB" → Table — Full Page.

| Property Name | Type | Notes |
|---|---|---|
| Company | Title | |
| Role | Text | |
| Stage | Select | Options: Wishlist / Applied / Phone Screen / Technical / Onsite / Offer / Rejected / Accepted |
| Applied Date | Date | |
| Last Activity | Date | Auto-updated by email pipeline |
| Recruiter Contact | Relation | → Contacts DB |
| JD Link | URL | |
| Resume Version | Text | |
| Notes | Text | |
| Days in Stage | Formula | See formula below |
| Follow-Up Due | Formula | See formula below |

**Days in Stage formula:**
```
dateBetween(now(), prop("Applied Date"), "days")
```

**Follow-Up Due formula:**
```
dateAdd(prop("Applied Date"), 7, "days")
```

After creating, go back to Contacts DB → edit "Linked Applications" → point it at Applications DB.

### 2d — LeetCode Problems DB

New page → "LC Problems DB" → Table — Full Page.

**Option A (recommended):** Use the LeetNotion template. When you install the LeetNotion extension in Phase 2, it gives you a Notion template link. Duplicate that template and use it as this database — it comes pre-configured with all the right properties and a "Due for Review" view.

**Option B (manual):**

| Property Name | Type | Notes |
|---|---|---|
| Problem | Title | "[Title] — LC #[number]" |
| Difficulty | Select | Easy / Medium / Hard |
| Topics | Multi-select | Array, DP, Graph, Tree, Sliding Window, etc. |
| Status | Select | Solved / Attempted / Needs Review |
| Solution Code | Text | Full code block |
| Time to Solve | Number | Minutes |
| Optimal | Checkbox | Did you find the optimal solution? |
| Review Date | Formula | See formula below |
| Notes | Text | |
| Solved Date | Date | |

**Review Date formula (spaced repetition):**
```
if(prop("Difficulty") == "Easy", dateAdd(prop("Solved Date"), 7, "days"),
if(prop("Difficulty") == "Medium", dateAdd(prop("Solved Date"), 3, "days"),
dateAdd(prop("Solved Date"), 1, "days")))
```

**After creating:** Add a filtered view called "Due for Review":
- Filter: `Review Date ≤ Today` AND `Status = Solved`
- Sort: Review Date ascending
- This is your daily LC review queue.

---

## Step 3: Create Notion Integration (API Access)

Every pipeline except Granola writes to Notion via the Notion API. You need one internal integration to grant API access.

1. Go to notion.so/my-integrations
2. Click "New integration"
3. Name it: "Recruiting OS"
4. Select your workspace
5. Capabilities needed: Read content ✓, Update content ✓, Insert content ✓
6. Click Submit → Copy the "Internal Integration Secret" — this is your **Notion API key**

**Save this key** in `context.md` in this repo.

---

## Step 4: Share Each Database with the Integration

The Notion API can only access databases you explicitly share with your integration. For each of the 4 databases:

1. Open the database
2. Click the `...` menu (top right) → "Connections"
3. Search for "Recruiting OS" → click to add

Do this for all 4 databases.

---

## Step 5: Collect Database IDs

Each pipeline needs to know the Database ID to write to the right place.

**How to find a Database ID:**
1. Open the database
2. Look at the URL: `https://www.notion.so/[workspace]/[DATABASE_ID]?v=[view_id]`
3. The 32-character string between the last `/` and the `?` is the Database ID
4. Format it with hyphens: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

Save all 4 IDs in `context.md`.

---

## Step 6: Smoke Test

Manually add one row to the Contacts DB:
- Name: Test Contact
- Company: Test Corp
- Status: 🟢 Warm
- Urgency: LOW

Verify it appears. Verify Relations are linked (Calls DB and Applications DB should be selectable). Delete the test row.

---

## Deliverable Checklist

- [ ] 4 databases created with correct schemas
- [ ] Relation properties linked between DBs
- [ ] Notion internal integration created
- [ ] All 4 DBs shared with the integration
- [ ] All 4 DB IDs saved in context.md
- [ ] Notion API key saved in context.md
- [ ] LC Problems DB has "Due for Review" filtered view
- [ ] Applications DB has Days in Stage and Follow-Up Due formulas working
- [ ] Manually tested: can add a row to Contacts DB

---

## What Comes Next

Phase 2 (LeetCode Sync) connects the LeetNotion extension to the LC Problems DB — takes 15 minutes and will use the Database ID you collected here.

Phase 4 (Email Pipeline) uses the Contacts DB and Applications DB IDs in the Gumloop Notion MCP node.

Phase 7 (Call Processing) uses the Contacts DB and Calls DB IDs in Cowork prompts.
