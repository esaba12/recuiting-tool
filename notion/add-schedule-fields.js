#!/usr/bin/env node
// Adds a lightweight "want to schedule" queue to the Contacts DB: Wants To Schedule
// (checkbox, set via the quick-add "+ Schedule" flow), Schedule By (date — target date
// to have a call/coffee-chat set up by, distinct from Follow-Up Date which is for
// post-interaction follow-ups), Schedule Note (freeform context on why/what to discuss).
// Run: node notion/add-schedule-fields.js

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
const date = () => ({ date: {} });
const text = () => ({ rich_text: {} });

async function main() {
  console.log("Adding schedule-queue fields to Contacts DB...\n");
  await notionPatch(`/databases/${contactsId}`, { properties: {
    "Wants To Schedule": checkbox(),
    "Schedule By":       date(),
    "Schedule Note":     text(),
  }});
  console.log("✅ Contacts DB updated.");
}

main().catch(err => {
  console.error("\n❌", err.message);
  process.exit(1);
});
