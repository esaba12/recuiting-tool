#!/usr/bin/env node
// Adds outreach-drafting fields to the Contacts DB: Follow-Up Draft (persisted draft
// text — cold-open or follow-up), Follow-Up Draft Tier (escalation tier the persisted
// draft was generated for, used to know when to regenerate), Follow-Up Draft Kind
// (Cold Open vs Follow-Up). Run: node notion/add-followup-fields.js

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

const text = () => ({ rich_text: {} });
const num  = () => ({ number: { format: "number" } });
const sel  = (options) => ({ select: { options: options.map(([name, color]) => ({ name, color })) } });

async function main() {
  console.log("Adding Follow-Up Draft fields to Contacts DB...\n");
  await notionPatch(`/databases/${contactsId}`, { properties: {
    "Follow-Up Draft":      text(),
    "Follow-Up Draft Tier": num(),
    "Follow-Up Draft Kind": sel([["Cold Open","blue"],["Follow-Up","orange"]]),
  }});
  console.log("✅ Contacts DB updated.");
}

main().catch(err => {
  console.error("\n❌", err.message);
  process.exit(1);
});
