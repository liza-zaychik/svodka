// Step 2.5: apply the "to delete" label to whatever triage judged to be junk.
// Deletes nothing — only labels threads and marks them as read.

import { readFileSync } from "node:fs";
import { auth, ensureLabels, modifyThread } from "./gmail.mjs";
import { config, dryRun } from "./config.mjs";

const data = JSON.parse(readFileSync("out/svodka.json", "utf8"));

// Safeguard: never mark more than the limit in a single run.
const marked = (data.marked || []).filter((m) => m.threadId).slice(0, config.limits.marked);

if (!marked.length) {
  console.log("Nothing to mark.");
  process.exit(0);
}

// In dry-run mode the mailbox is left untouched. Email subjects are not logged:
// Actions logs are kept for months, and in a public repository everyone can see them.
if (dryRun) {
  console.log(`Dry run: would mark ${marked.length}, not applying labels.`);
  process.exit(0);
}

await auth();
const trashId = (await ensureLabels([config.labels.trash]))[config.labels.trash];

let ok = 0;
for (const m of marked) {
  try {
    await modifyThread(m.threadId, [trashId], ["UNREAD"]);
    ok++;
  } catch (e) {
    console.error("Failed to mark", m.threadId, "—", e.message);
  }
}

console.log(`Marked: ${ok} of ${marked.length}`);
