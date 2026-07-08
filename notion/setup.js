#!/usr/bin/env node
// Notion Database Setup Script — Recruiting OS
// Run: node notion/setup.js

require("dotenv").config();

const KEY    = process.env.NOTION_API_KEY;
const PARENT = process.env.PARENT_PAGE_ID;

if (!KEY || !PARENT) {
  console.error("Missing .env values: NOTION_API_KEY and PARENT_PAGE_ID required.");
  process.exit(1);
}

const HEADERS = {
  "Authorization":  `Bearer ${KEY}`,
  "Notion-Version": "2022-06-28",
  "Content-Type":   "application/json",
};

async function notionGet(path) {
  const r = await fetch(`https://api.notion.com/v1${path}`, { headers: HEADERS });
  return r.json();
}

async function notionPost(path, body) {
  const r = await fetch(`https://api.notion.com/v1${path}`, {
    method:  "POST",
    headers: HEADERS,
    body:    JSON.stringify(body),
  });
  const d = await r.json();
  if (d.object === "error") throw new Error(`Notion error: ${d.message} (${d.code})`);
  return d;
}

async function notionPatch(path, body) {
  const r = await fetch(`https://api.notion.com/v1${path}`, {
    method:  "PATCH",
    headers: HEADERS,
    body:    JSON.stringify(body),
  });
  const d = await r.json();
  if (d.object === "error") throw new Error(`Notion error: ${d.message} (${d.code})`);
  return d;
}

// ── Property type helpers ──────────────────────────────────────────────────
const title      = ()           => ({ title: {} });
const text       = ()           => ({ rich_text: {} });
const num        = ()           => ({ number: { format: "number" } });
const url        = ()           => ({ url: {} });
const email      = ()           => ({ email: {} });
const checkbox   = ()           => ({ checkbox: {} });
const date       = ()           => ({ date: {} });
const formula    = (expression) => ({ formula: { expression } });
const rel        = (database_id) => ({ relation: { database_id, type: "single_property", single_property: {} } });
const sel        = (options)    => ({
  select: { options: options.map(([name, color]) => ({ name, color })) }
});
const msel       = (options)    => ({
  multi_select: { options: options.map(([name, color]) => ({ name, color })) }
});

// ── Create an empty database (SDK creates empty, we patch props next) ──────
async function createDB(title_str) {
  const db = await notionPost("/databases", {
    parent: { type: "page_id", page_id: PARENT },
    title:  [{ type: "text", text: { content: title_str } }],
  });
  console.log(`✓ Created: ${title_str}  (${db.id})`);
  return db.id;
}

// ── Add/update properties on an existing database ──────────────────────────
async function setProps(dbId, properties) {
  await notionPatch(`/databases/${dbId}`, { properties });
  console.log(`  + Properties set on ${dbId.slice(0, 8)}...`);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\nCreating Recruiting OS databases...\n");

  const contactsId = await createDB("Contacts DB");
  const callsId    = await createDB("Calls DB");
  const appsId     = await createDB("Applications DB");
  const lcId       = await createDB("LC Problems DB");

  console.log("\nAdding properties...\n");

  // Contacts DB
  await setProps(contactsId, {
    "Name":                      title(),
    "Company":                   text(),
    "Role":                      sel([["SWE","blue"],["PM","green"],["Recruiter","purple"],["Alumni","orange"],["Referral","pink"]]),
    "Email":                     email(),
    "LinkedIn":                  url(),
    "Source":                    sel([["Coffee chat","yellow"],["Email","blue"],["Event","green"],["Referral","pink"],["LinkedIn DM","purple"]]),
    "Status":                    sel([["🟢 Warm","green"],["🟡 Cooling","yellow"],["🔴 Cold","red"],["✅ Closed","gray"],["⭐ Champion","orange"]]),
    "What They've Done For Me":  text(),
    "Last Interaction":          date(),
    "Follow-Up Date":            date(),
    "Urgency":                   sel([["HIGH","red"],["MED","yellow"],["LOW","gray"]]),
    "Notes":                     text(),
    "Exa Enriched":              checkbox(),
  });

  // Calls DB
  await setProps(callsId, {
    "Title":            title(),
    "Date":             date(),
    "Duration":         num(),
    "Summary":          text(),
    "Key Insights":     text(),
    "My Commitments":   text(),
    "Follow-Up Draft":  text(),
    "Granola Link":     url(),
    "Full Transcript":  text(),
    "Action Status":    sel([["Pending","yellow"],["Done","green"],["N/A","gray"]]),
  });

  // Applications DB
  await setProps(appsId, {
    "Company":        title(),
    "Role":           text(),
    "Stage":          sel([
      ["Wishlist","gray"],["Applied","blue"],["Phone Screen","yellow"],
      ["Technical","orange"],["Onsite","purple"],["Offer","green"],
      ["Rejected","red"],["Accepted","green"]
    ]),
    "Applied Date":   date(),
    "Last Activity":  date(),
    "JD Link":        url(),
    "Resume Version": text(),
    "Notes":          text(),
    "Days in Stage":  formula('dateBetween(now(), prop("Applied Date"), "days")'),
    "Follow-Up Due":  formula('dateAdd(prop("Applied Date"), 7, "days")'),
  });

  // LC Problems DB
  await setProps(lcId, {
    "Problem":       title(),
    "Difficulty":    sel([["Easy","green"],["Medium","yellow"],["Hard","red"]]),
    "Topics":        msel([
      ["Array","blue"],["DP","purple"],["Graph","orange"],["Tree","green"],
      ["Sliding Window","yellow"],["Binary Search","pink"],["Hash Map","gray"],
      ["Two Pointers","blue"],["BFS","green"],["DFS","orange"],["Stack","red"],
      ["Heap","purple"],["Trie","yellow"],["Backtracking","pink"],["Greedy","gray"],
    ]),
    "Status":        sel([["Solved","green"],["Attempted","yellow"],["Needs Review","red"]]),
    "Solution Code": text(),
    "Time to Solve": num(),
    "Optimal":       checkbox(),
    "Review Date":   formula(
      'if(prop("Difficulty") == "Easy", dateAdd(prop("Solved Date"), 7, "days"), ' +
      'if(prop("Difficulty") == "Medium", dateAdd(prop("Solved Date"), 3, "days"), ' +
      'dateAdd(prop("Solved Date"), 1, "days")))'
    ),
    "Notes":         text(),
    "Solved Date":   date(),
  });

  console.log("\nWiring relations...\n");

  await setProps(contactsId, {
    "Linked Calls":        rel(callsId),
    "Linked Applications": rel(appsId),
  });
  await setProps(callsId,   { "Contact":          rel(contactsId) });
  await setProps(appsId,    { "Recruiter Contact": rel(contactsId) });

  console.log("\n✅ All 4 databases created with full schemas and relations.\n");
  console.log("Copy these IDs into .env:\n");
  console.log(`CONTACTS_DB_ID=${contactsId}`);
  console.log(`CALLS_DB_ID=${callsId}`);
  console.log(`APPS_DB_ID=${appsId}`);
  console.log(`LC_DB_ID=${lcId}`);
}

main().catch(err => {
  console.error("\n❌", err.message);
  if (err.message.includes("unauthorized")) {
    console.error("   → Check your NOTION_API_KEY in .env");
  } else if (err.message.includes("object_not_found")) {
    console.error("   → Parent page not found or not shared with the integration.");
    console.error("   → In Notion: open page → ... → Connections → add your integration.");
  }
  process.exit(1);
});
