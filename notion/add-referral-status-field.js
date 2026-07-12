#!/usr/bin/env node
// Adds "Referral Status" (select: Not Asked/Asked/Confirmed/Declined) to the Contacts DB —
// tracks whether a contact is going to give you a referral for a job application, distinct
// from Role's "Referral" option (their relationship type to you) and "Referred By" (who
// introduced *you* to this contact).
// Run: node notion/add-referral-status-field.js

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

const select = (options) => ({ select: { options: options.map(name => ({ name })) } });

async function main() {
  console.log("Adding Referral Status field to Contacts DB...\n");
  await notionPatch(`/databases/${contactsId}`, { properties: {
    "Referral Status": select(["Not Asked", "Asked", "Confirmed", "Declined"]),
  }});
  console.log("✅ Contacts DB updated.");
}

main().catch(err => {
  console.error("\n❌", err.message);
  process.exit(1);
});
