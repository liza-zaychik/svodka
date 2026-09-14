// One-off helper: gets a Gmail refresh token for GitHub Actions and stores it,
// together with your OAuth client, as repository secrets.
//
// Run from the repository folder:  node scripts/get-token.mjs
//
// It talks only to Google and, through the GitHub CLI, to your repository.
// When gh is available the tokens are never printed.

import http from "node:http";
import { createInterface } from "node:readline/promises";
import { exec, spawnSync } from "node:child_process";

const PORT = 8765;
const REDIRECT = `http://localhost:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/gmail.modify";

const rl = createInterface({ input: process.stdin, output: process.stdout });

console.log("\nCopy two values from your OAuth client page in Google Cloud.\n");
const clientId = (await rl.question("Client ID: ")).trim();
const clientSecret = (await rl.question("Client secret: ")).trim();
rl.close();

if (!clientId || !clientSecret) {
  console.error("\nBoth values are required. Run the script again.");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });

console.log("\nOpening the browser. Sign in to the mailbox svodka should read, and allow access.");
console.log('If Google says the app is not verified: "Advanced" → "Go to …". It is your own app.\n');
console.log("Browser did not open? Use this link:\n" + authUrl + "\n");

const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? 'start ""' : "xdg-open";
exec(`${opener} "${authUrl}"`);

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, REDIRECT);
    const got = url.searchParams.get("code");
    const err = url.searchParams.get("error");

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<meta charset="utf-8"><body style="font:16px -apple-system,sans-serif;padding:40px">` +
        (got ? "Done. You can close this tab and go back to the terminal." : "Something went wrong: " + err) +
        `</body>`
    );

    server.close();
    got ? resolve(got) : reject(new Error(err || "no code received"));
  });
  server.listen(PORT);
  setTimeout(() => { server.close(); reject(new Error("nobody signed in within 5 minutes")); }, 300000);
});

const resp = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
  }),
});

const data = await resp.json();

if (!data.refresh_token) {
  console.error("\nGoogle did not return a refresh token. Response:", data);
  console.error("\nUsually this helps: revoke access at myaccount.google.com/permissions and run again.");
  process.exit(1);
}

const secrets = {
  GMAIL_CLIENT_ID: clientId,
  GMAIL_CLIENT_SECRET: clientSecret,
  GMAIL_REFRESH_TOKEN: data.refresh_token,
};

// Straight into repository secrets: nothing is copied by hand, so nothing picks up
// a stray line break on the way.
const repo = spawnSync("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], { encoding: "utf8" });

if (repo.status === 0) {
  for (const [name, value] of Object.entries(secrets)) {
    const r = spawnSync("gh", ["secret", "set", name], { input: value, encoding: "utf8" });
    if (r.status !== 0) {
      console.error(`\nCould not store ${name}: ${r.stderr}`);
      process.exit(1);
    }
  }
  console.log(`\nDone. Stored GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN in ${repo.stdout.trim()}.`);
} else {
  console.log("\nThe GitHub CLI (gh) is not available here, so add these as repository secrets by hand");
  console.log("(Settings → Secrets and variables → Actions), each value as a single line:\n");
  for (const [name, value] of Object.entries(secrets)) console.log(`${name} = ${value}`);
}

console.log("\nThe token stays valid until you revoke access at myaccount.google.com/permissions.\n");
