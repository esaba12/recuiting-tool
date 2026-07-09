#!/usr/bin/env node
// One-time OAuth setup — run once, paste the printed refresh token into .env.
// Run: node google-calendar/get-refresh-token.js
//
// Prerequisite: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET already in .env (from a
// "Desktop app" type OAuth Client ID in Google Cloud Console — see .env.example
// for the full one-time Cloud Console setup steps).

require("dotenv").config();
const http = require("http");
const { exec } = require("child_process");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 8901; // 8765 was already bound by an unrelated process on this Mac
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing .env values: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required.");
  console.error("(Create a Desktop app OAuth Client ID in Google Cloud Console first — see .env.example.)");
  process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: "code",
  scope: SCOPE,
  access_type: "offline",
  prompt: "consent",
})}`;

async function exchangeCode(code) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || `Token exchange failed (${res.status})`);
  return data;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/oauth2callback") { res.writeHead(404); res.end(); return; }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h2>Authorization failed: ${error}</h2>You can close this tab.`);
    console.error(`\n❌ Authorization failed: ${error}`);
    server.close();
    process.exit(1);
  }

  try {
    const tokens = await exchangeCode(code);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h2>✅ Authorized — you can close this tab.</h2>");

    if (!tokens.refresh_token) {
      console.log("\n⚠️  No refresh_token returned — Google only issues one the FIRST time you grant consent for this client.");
      console.log("   Revoke access at https://myaccount.google.com/permissions and run this script again.");
    } else {
      console.log("\n✅ Success. Add this to your .env:\n");
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    }
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h2>Token exchange failed: ${e.message}</h2>`);
    console.error(`\n❌ ${e.message}`);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log(`\nOpening browser for Google authorization...\nIf it doesn't open, visit this URL manually:\n\n${authUrl}\n`);
  exec(`open "${authUrl}"`); // macOS
});
