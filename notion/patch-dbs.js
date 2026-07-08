#!/usr/bin/env node
// Patches the 4 existing databases with full schemas + relations.
// Run: node notion/patch-dbs.js

require("dotenv").config();

const KEY = process.env.NOTION_API_KEY;
if (!KEY) { console.error("NOTION_API_KEY missing in .env"); process.exit(1); }

const contactsId = "6f941973-1fce-40c3-943c-4c908940e2a8";
const callsId    = "8ddef121-1744-45d2-aa52-7699a727e9c0";
const appsId     = "49011c2e-8165-4373-a41b-f913b02d1052";
const lcId       = "9fc96722-d155-4333-9770-41130fb59a39";

const HEADERS = {
  "Authorization":  `Bearer ${KEY}`,
  "Notion-Version": "2022-06-28",
  "Content-Type":   "application/json",
};

async function patch(dbId, body) {
  const r = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
    method: "PATCH", headers: HEADERS, body: JSON.stringify(body),
  });
  const d = await r.json();
  if (d.object === "error") throw new Error(`${d.code}: ${d.message}`);
  return d;
}

const text     = ()  => ({ rich_text: {} });
const num      = ()  => ({ number: { format: "number" } });
const url      = ()  => ({ url: {} });
const checkbox = ()  => ({ checkbox: {} });
const date     = ()  => ({ date: {} });
const formula  = (e) => ({ formula: { expression: e } });
const rel      = (id) => ({ relation: { database_id: id, type: "single_property", single_property: {} } });
const sel      = (opts) => ({ select:       { options: opts.map(([n,c]) => ({ name: n, color: c })) } });
const msel     = (opts) => ({ multi_select: { options: opts.map(([n,c]) => ({ name: n, color: c })) } });

async function main() {
  console.log("Patching databases...\n");

  // ── Contacts DB ─────────────────────────────────────────────────────────
  // Already has all properties from the first successful patch.
  // Title is already "Name". Just need to add relations (done below).
  console.log("1/4  Contacts DB — already set, skipping properties.");

  // ── Calls DB ─────────────────────────────────────────────────────────────
  // Only has "Name:title". Rename it to "Title", add everything else.
  console.log("2/4  Calls DB...");
  await patch(callsId, { properties: {
    "Name":            { name: "Title", title: {} },   // rename existing title
    "Date":            date(),
    "Duration":        num(),
    "Summary":         text(),
    "Key Insights":    text(),
    "My Commitments":  text(),
    "Follow-Up Draft": text(),
    "Granola Link":    url(),
    "Full Transcript": text(),
    "Action Status":   sel([["Pending","yellow"],["Done","green"],["N/A","gray"]]),
  }});
  console.log("  ✓ Calls DB");

  // ── Applications DB ───────────────────────────────────────────────────────
  // Rename "Name" to "Company", add everything else.
  console.log("3/4  Applications DB...");
  await patch(appsId, { properties: {
    "Name":           { name: "Company", title: {} },  // rename
    "Role":           text(),
    "Stage":          sel([
      ["Wishlist","gray"],["Applied","blue"],["Phone Screen","yellow"],
      ["Technical","orange"],["Onsite","purple"],["Offer","green"],
      ["Rejected","red"],["Accepted","green"],
    ]),
    "Applied Date":   date(),
    "Last Activity":  date(),
    "JD Link":        url(),
    "Resume Version": text(),
    "Notes":          text(),
    "Days in Stage":  formula('dateBetween(now(), prop("Applied Date"), "days")'),
    "Follow-Up Due":  formula('dateAdd(prop("Applied Date"), 7, "days")'),
  }});
  console.log("  ✓ Applications DB");

  // ── LC Problems DB ────────────────────────────────────────────────────────
  // Rename "Name" to "Problem", add everything else.
  console.log("4/4  LC Problems DB...");
  await patch(lcId, { properties: {
    "Name":        { name: "Problem", title: {} },  // rename
    "Difficulty":  sel([["Easy","green"],["Medium","yellow"],["Hard","red"]]),
    "Topics":      msel([
      ["Array","blue"],["DP","purple"],["Graph","orange"],["Tree","green"],
      ["Sliding Window","yellow"],["Binary Search","pink"],["Hash Map","gray"],
      ["Two Pointers","blue"],["BFS","green"],["DFS","orange"],["Stack","red"],
      ["Heap","purple"],["Trie","yellow"],["Backtracking","pink"],["Greedy","gray"],
    ]),
    "Status":      sel([["Solved","green"],["Attempted","yellow"],["Needs Review","red"]]),
    "Solution Code": text(),
    "Time to Solve": num(),
    "Optimal":     checkbox(),
    "Review Date": formula(
      'if(prop("Difficulty") == "Easy", dateAdd(prop("Solved Date"), 7, "days"), ' +
      'if(prop("Difficulty") == "Medium", dateAdd(prop("Solved Date"), 3, "days"), ' +
      'dateAdd(prop("Solved Date"), 1, "days")))'
    ),
    "Notes":       text(),
    "Solved Date": date(),
  }});
  console.log("  ✓ LC Problems DB");

  // ── Relations ─────────────────────────────────────────────────────────────
  console.log("\nWiring relations...");
  await patch(contactsId, { properties: {
    "Linked Calls":        rel(callsId),
    "Linked Applications": rel(appsId),
  }});
  console.log("  ✓ Contacts → Calls + Applications");

  await patch(callsId, { properties: { "Contact": rel(contactsId) }});
  console.log("  ✓ Calls → Contacts");

  await patch(appsId,  { properties: { "Recruiter Contact": rel(contactsId) }});
  console.log("  ✓ Applications → Contacts");

  console.log("\n✅ All databases ready. Add to .env:\n");
  console.log(`CONTACTS_DB_ID=${contactsId}`);
  console.log(`CALLS_DB_ID=${callsId}`);
  console.log(`APPS_DB_ID=${appsId}`);
  console.log(`LC_DB_ID=${lcId}`);
}

main().catch(err => {
  console.error("\n❌", err.message);
  process.exit(1);
});
