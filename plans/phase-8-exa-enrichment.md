# Phase 8 — Exa Contact Enrichment

**Branch:** `cowork-setup` (worktree at `.worktrees/cowork-setup/`)  
**Time:** ~30 minutes  
**Day:** Day 4  
**Deliverable:** Weekly batch enrichment — all new contacts get LinkedIn URLs auto-filled in Notion

---

## What You're Building

A Cowork on-demand task that:
1. Queries Notion Contacts DB for all rows where `Exa Enriched` checkbox = unchecked
2. For each contact: searches Exa for their LinkedIn profile URL
3. Writes the LinkedIn URL back to the contact's Notion row
4. Checks the `Exa Enriched` box

You run this manually once a week (or trigger it from Cowork's scheduled task). Takes ~2-5 minutes depending on how many new contacts were added.

---

## Why Exa and Not Google Search

Exa ($250 YC credit) is purpose-built for structured web search with clean return formats. Searching for "Name + Company + LinkedIn" returns a structured result with the profile URL, current role, and a bio snippet — no scraping, no parsing HTML.

Cowork has Exa available as a native tool. You don't need API integration — just enable it in Cowork settings.

---

## Prerequisites

- Phase 6 complete — Cowork "Recruiting OS" project set up
- Exa enabled as a tool in Cowork (see Step 1)
- Contacts DB exists with `LinkedIn` (URL) and `Exa Enriched` (Checkbox) properties

---

## Step 1: Enable Exa in Cowork

In Claude Desktop → Recruiting OS project settings → Tools:
- Look for "Exa" or "Web Search" tools
- Enable Exa specifically if it's listed as a separate connector
- If Exa isn't available as a named connector, it may be available through Cowork's web search capability. Test with "Search Exa for [name] LinkedIn" and see if it returns results.

Note: Cowork's Exa integration is native — it uses your YC Exa credits automatically. No API key setup needed if you're signed in with your YC-linked account.

---

## Step 2: Test Exa Search Manually

In the Cowork "Recruiting OS" project, type:

```
Search Exa for "Sarah Chen Stripe LinkedIn" and return the profile URL and current role.
```

Expected result: a LinkedIn URL + role (e.g., "Sarah Chen — Technical Recruiter at Stripe — linkedin.com/in/sarahchen")

If this works, Exa is properly connected and you have credits.

---

## Step 3: Save the Enrichment Task

In Cowork → create saved prompt/skill:
- **Name:** Enrich New Contacts
- **Prompt:** (copy from `cowork/contact-enrichment.md`)

The prompt:
1. Queries Notion Contacts DB for all unchecked `Exa Enriched` rows
2. For each: calls Exa with "[Name] [Company] LinkedIn"
3. Extracts LinkedIn URL from result
4. Updates the Notion row: writes LinkedIn URL, checks `Exa Enriched`
5. Reports how many were enriched and which ones Exa couldn't find

---

## Step 4: First Real Run

Run "Enrich New Contacts" after Phase 4 is live (email pipeline has had a few days to create contacts). You should have 5-20 new contacts from emails.

Review the output:
- Were LinkedIn URLs found for most contacts?
- Any obvious errors (wrong person matched)?
- Any contacts Exa couldn't find (common for very common names — e.g., "John Smith at Google")?

For contacts Exa couldn't find: check the URL manually → paste it directly into their Notion row → check `Exa Enriched` manually.

---

## Step 5: Schedule It (Optional)

You can add this to your weekly Cowork routine. Two options:

**Option A — Scheduled task:**
In Cowork → Scheduled Tasks → New: run "Enrich New Contacts" every Sunday at 7pm (runs before the 8pm weekly memo, so the memo sees enriched contacts).

**Option B — Manual weekly trigger:**
Add it to your weekly habit: every Sunday before reviewing the weekly memo, run "Enrich New Contacts" in Cowork.

Option B is more reliable (doesn't depend on your laptop being on at a specific time) and takes only 10 seconds to trigger manually.

---

## What Exa Finds Per Contact

For each contact it enriches:
| Field | Written to Notion |
|---|---|
| LinkedIn URL | → `LinkedIn` property |
| Enriched status | → `Exa Enriched` checkbox checked |

Fields Exa finds but doesn't currently write (can add to prompt if useful):
- Current employer and role (verifies what you have)
- Public bio snippet
- Mutual connections (LinkedIn only shows this when logged in — Exa uses public data)

---

## Credit Math

Exa credits: $250 YC credit.

Approximate cost per Exa search: varies but typically $0.001-$0.01 per query.

At 20 new contacts/week × $0.01/search = $0.20/week = ~$10/year.

$250 covers ~25 years at this rate. Not a concern.

---

## Handling Edge Cases

**Common name with many LinkedIn results:**
- Exa returns the top match. If it's wrong, check manually.
- You can prompt Cowork: "For each contact, if you find multiple LinkedIn profiles, include the one that matches [Company] as the employer."

**Contact not on LinkedIn:**
- Exa returns no result or a non-LinkedIn URL.
- Cowork should report: "Could not find LinkedIn for [Name]" rather than writing a wrong URL.
- Add to the prompt: "If you cannot find a confident LinkedIn match, leave the LinkedIn field blank and do NOT check Exa Enriched — report the contact name instead."

**Name changed (married name, etc.):**
- Exa uses public name. If the email signature name differs from their LinkedIn name, you may not find them.
- Handle manually for these cases.

---

## Deliverable Checklist

- [ ] Exa enabled/verified in Cowork project
- [ ] Manual Exa test returns a LinkedIn URL
- [ ] "Enrich New Contacts" task saved in Cowork
- [ ] First real run completed — existing new contacts enriched
- [ ] Verified: LinkedIn URLs in Notion are correct (spot-check 3-5)
- [ ] Verified: Exa Enriched checkbox is checked for enriched contacts
- [ ] Decided on schedule vs manual trigger approach

---

## System Complete

After Phase 8, the full recruiting OS is live:

| Pipeline | Status after Phase 8 |
|---|---|
| Calls → Notion | ✅ Via Granola + Cowork (2 min per call) |
| Email → Notion | ✅ Gumloop auto-updates in real-time |
| LeetCode → Notion | ✅ LeetNotion extension, fully automatic |
| Weekly memo | ✅ Cowork Sunday 8pm |
| Daily brief | ✅ Cowork 9am weekdays |
| Contact enrichment | ✅ Cowork weekly (on-demand or scheduled) |
| Dashboard | ✅ React artifact in Claude.ai |

The next step from here is not more setup — it's the August recruiting season. The system is ready.
