// Step 2b: full text for the few conversations that need action,
// so their gists carry the real amounts and deadlines.
// Everything else stays triaged by sender, subject and snippet only.

import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { auth, latestIncomingText } from "./gmail.mjs";
import { config } from "./config.mjs";

const OUT = "out/bodies.json";
rmSync(OUT, { force: true });

if (!config.fullTextForAction) {
  console.log("Full text is switched off in config.json (fullTextForAction).");
  process.exit(0);
}

const act = (JSON.parse(readFileSync("out/svodka.json", "utf8")).act || []).filter((m) => m.threadId);
if (!act.length) {
  console.log("Nothing needs action — no full text to read.");
  process.exit(0);
}

await auth();

const bodies = {};
for (const m of act) {
  try {
    const text = await latestIncomingText(m.threadId);
    if (text) bodies[m.threadId] = text;
  } catch (e) {
    console.error("Could not read", m.threadId, "—", e.message);
  }
}

writeFileSync(OUT, JSON.stringify(bodies));
// Counts only: the logs must not contain email text.
console.log(`Full text read for ${Object.keys(bodies).length} of ${act.length} conversations that need action.`);
