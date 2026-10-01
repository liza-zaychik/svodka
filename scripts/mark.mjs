// Step 2.5: apply the "to delete" label to whatever triage judged to be junk.
// Deletes nothing — only labels threads and marks them as read.
//
// Triage sees sender, subject and the first 200 characters. Here the full text is
// read and checked against `neverMark` (scripts/keep.mjs, overridable in config.json):
// a mention of damage, a deposit, a claim or a fine keeps the email untouched,
// whatever triage decided. Unreadable mail is never marked either.

import { readFileSync } from "node:fs";
import { auth, ensureLabels, modifyThread, latestIncomingText } from "./gmail.mjs";
import { config, dryRun } from "./config.mjs";
import { keepReason } from "./keep.mjs";

const data = JSON.parse(readFileSync("out/svodka.json", "utf8"));

// Safeguard: never mark more than the limit in a single run.
const marked = (data.marked || []).filter((m) => m.threadId).slice(0, config.limits.marked);

if (!marked.length) {
  console.log("Nothing to mark.");
  process.exit(0);
}

await auth();
// In dry-run mode the mailbox is left untouched, but the full text is still read,
// so a dry run shows exactly what the rules would do.
const trashId = dryRun ? null : (await ensureLabels([config.labels.trash]))[config.labels.trash];

let ok = 0;
let kept = 0;
for (const m of marked) {
  let text;
  try {
    text = await latestIncomingText(m.threadId, 20000);
  } catch (e) {
    console.error("Could not read", m.threadId, "— keeping it:", e.message);
    kept++;
    continue;
  }

  if (keepReason(`${m.subj || ""}\n${text}`, config.neverMark)) {
    kept++;
    continue;
  }

  if (dryRun) {
    ok++;
    continue;
  }

  try {
    await modifyThread(m.threadId, [trashId], ["UNREAD"]);
    ok++;
  } catch (e) {
    console.error("Failed to mark", m.threadId, "—", e.message);
  }
}

// Counts only. Email subjects are not logged: Actions logs are kept for months,
// and in a public repository everyone can see them.
const tail = `${ok} of ${marked.length}; kept ${kept} that mention money or responsibility`;
console.log(dryRun ? `Dry run: would mark ${tail}.` : `Marked: ${tail}.`);
