#!/usr/bin/env node
// Adds affinity fields to the Contacts DB: Is UMich Alum (fast one-click MVP signal) and
// Notable Affinity (generalizes past just UMich — same hometown, shared club/activity,
// warm intro). Distinct from the existing Role="Alumni" value, which describes this
// contact's *relationship type* to you (mutually exclusive with e.g. "SWE") — affinity
// describes a *shared background signal*, which a SWE at a target company can also have.
// Run: node notion/add-affinity-fields.js

require("dotenv").config();

const KEY = process.env.NOTION_API_KEY;
const contactsId = process.env.CONTACTS_DB_ID;

if (!KEY || !contactsId) {
  console.error("Missing .env values: NOTION_API_KEY, CONTACTS_DB_ID required.");
  process.exit(1);
}

const HEADERS = {
  "Authorization":  `Bearer ${KEY}`,
  "Notion-Version": "2022-06-28",
  "Content-Type":   "application/json",
};

async function notionPatch(path, body) {
  const r = await fetch(`https://api.notion.com/v1${path}`, { method: "PATCH", headers: HEADERS, body: JSON.stringify(body) });
  const d = await r.json();
  if (d.object === "error") throw new Error(`Notion error: ${d.message} (${d.code})`);
  return d;
}

const checkbox = () => ({ checkbox: {} });
const multiSel = (options) => ({ multi_select: { options: options.map(([name, color]) => ({ name, color })) } });

async function main() {
  console.log("Adding affinity fields to Contacts DB...\n");
  await notionPatch(`/databases/${contactsId}`, { properties: {
    "Is UMich Alum":   checkbox(),
    "Notable Affinity": multiSel([["UMich","blue"],["Same Hometown","green"],["Shared Club/Activity","yellow"],["Warm Intro","orange"]]),
  }});
  console.log("✅ Contacts DB updated.");
}

main().catch(err => {
  console.error("\n❌", err.message);
  process.exit(1);
});
