#!/usr/bin/env node
// Adds "Closed Date" (date) to the Applications DB — when an application reached a
// terminal outcome (Rejected/Accepted), paired with the existing "Applied Date" to show
// turnaround time per application. Auto-set alongside Stage by ApplicationDetailModal.jsx
// (app) and upsertApplication() (email pipeline) when Stage moves to Rejected/Accepted;
// otherwise editable by hand for stages set directly in Notion.
// Run: node notion/add-closed-date-field.js

require("dotenv").config();

const KEY = process.env.NOTION_API_KEY;
const appsId = process.env.APPS_DB_ID;

if (!KEY || !appsId) {
  console.error("Missing .env values: NOTION_API_KEY, APPS_DB_ID required.");
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

const date = () => ({ date: {} });

async function main() {
  console.log("Adding Closed Date field to Applications DB...\n");
  await notionPatch(`/databases/${appsId}`, { properties: {
    "Closed Date": date(),
  }});
  console.log("✅ Applications DB updated.");
}

main().catch(err => {
  console.error("\n❌", err.message);
  process.exit(1);
});
