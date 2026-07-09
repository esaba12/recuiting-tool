#!/usr/bin/env node
// Adds job-board triage fields to the Applications DB: Triage (review → sort into
// Applying/Maybe/Applied/Pass), Location, Source Repo (which GitHub board it came from).
// Run: node notion/add-triage-fields.js

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

const text = () => ({ rich_text: {} });
const sel  = (options) => ({ select: { options: options.map(([name, color]) => ({ name, color })) } });

async function main() {
  console.log("Adding Triage/Location/Source Repo to Applications DB...\n");
  await notionPatch(`/databases/${appsId}`, { properties: {
    "Triage":      sel([["Needs Review","gray"],["Applying","blue"],["Maybe","yellow"],["Applied","green"],["Pass","red"]]),
    "Location":    text(),
    "Source Repo": text(),
  }});
  console.log("✅ Applications DB updated.");
}

main().catch(err => {
  console.error("\n❌", err.message);
  process.exit(1);
});
