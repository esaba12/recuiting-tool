#!/usr/bin/env node
// Creates the Interactions DB (universal touchpoint ledger: email/LinkedIn/call/meeting)
// and adds a "Referred By" self-relation to the Contacts DB.
// Run: node notion/add-interactions-db.js

require("dotenv").config();

const KEY    = process.env.NOTION_API_KEY;
const PARENT = process.env.PARENT_PAGE_ID;
const contactsId = process.env.CONTACTS_DB_ID;

if (!KEY || !PARENT || !contactsId) {
  console.error("Missing .env values: NOTION_API_KEY, PARENT_PAGE_ID, CONTACTS_DB_ID required.");
  process.exit(1);
}

const HEADERS = {
  "Authorization":  `Bearer ${KEY}`,
  "Notion-Version": "2022-06-28",
  "Content-Type":   "application/json",
};

async function notionPost(path, body) {
  const r = await fetch(`https://api.notion.com/v1${path}`, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
  const d = await r.json();
  if (d.object === "error") throw new Error(`Notion error: ${d.message} (${d.code})`);
  return d;
}

async function notionPatch(path, body) {
  const r = await fetch(`https://api.notion.com/v1${path}`, { method: "PATCH", headers: HEADERS, body: JSON.stringify(body) });
  const d = await r.json();
  if (d.object === "error") throw new Error(`Notion error: ${d.message} (${d.code})`);
  return d;
}

const title = ()           => ({ title: {} });
const text  = ()           => ({ rich_text: {} });
const date  = ()           => ({ date: {} });
const rel   = (database_id) => ({ relation: { database_id, type: "single_property", single_property: {} } });
const sel   = (options)    => ({ select: { options: options.map(([name, color]) => ({ name, color })) } });

async function createDB(title_str) {
  const db = await notionPost("/databases", {
    parent: { type: "page_id", page_id: PARENT },
    title:  [{ type: "text", text: { content: title_str } }],
    properties: { "Title": title() },
  });
  console.log(`✓ Created: ${title_str}  (${db.id})`);
  return db.id;
}

async function setProps(dbId, properties) {
  await notionPatch(`/databases/${dbId}`, { properties });
  console.log(`  + Properties set on ${dbId.slice(0, 8)}...`);
}

async function main() {
  console.log("\nCreating Interactions DB...\n");

  const interactionsId = await createDB("Interactions DB");

  await setProps(interactionsId, {
    "Title":       title(),
    "Contact":     rel(contactsId),
    "Type":        sel([["Email","blue"],["LinkedIn","purple"],["Call","green"],["Meeting","orange"],["Other","gray"]]),
    "Direction":   sel([["Inbound","yellow"],["Outbound","blue"],["N/A","gray"]]),
    "Date":        date(),
    "Channel Ref": text(),
    "Summary":     text(),
    "Body":        text(),
  });

  console.log("\nWiring Referred By self-relation on Contacts DB...\n");
  await setProps(contactsId, {
    "Referred By": rel(contactsId),
  });
  console.log("  ✓ Contacts.Referred By → Contacts (self)");

  console.log("\n✅ Interactions DB created and Referred By relation wired.\n");
  console.log("Add to .env:\n");
  console.log(`INTERACTIONS_DB_ID=${interactionsId}`);
}

main().catch(err => {
  console.error("\n❌", err.message);
  if (err.message.includes("unauthorized")) {
    console.error("   → Check your NOTION_API_KEY in .env");
  } else if (err.message.includes("object_not_found")) {
    console.error("   → Parent page not found or not shared with the integration.");
  }
  process.exit(1);
});
