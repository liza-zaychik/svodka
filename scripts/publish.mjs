// Step 3: put the triaged summary into the mailbox as a draft.
// The card picks it up from there — it has no other way to get the data.

import { readFileSync, writeFileSync } from "node:fs";
import { auth, saveDraft, dropOldDrafts, ensureLabels } from "./gmail.mjs";
import { config, dryRun, DRAFT_SUBJECT } from "./config.mjs";

const SECTIONS = ["act", "unread", "check", "marked"];

let data;
try {
  data = JSON.parse(readFileSync("out/svodka.json", "utf8"));
} catch (e) {
  console.error("out/svodka.json doesn't parse as JSON — triage wrote the wrong thing. The previous summary stays in place.");
  process.exit(1);
}

if (!SECTIONS.some((k) => Array.isArray(data[k]))) {
  console.error("out/svodka.json has no sections at all. The previous summary stays in place.");
  process.exit(1);
}

// Don't take the limits on trust — enforce them here.
const L = config.limits;
const cap = { act: Infinity, unread: L.unread, check: L.check, marked: L.marked };
for (const k of SECTIONS) data[k] = (Array.isArray(data[k]) ? data[k] : []).slice(0, cap[k]);

const { unreadTotal } = JSON.parse(readFileSync("out/mail.json", "utf8"));

await auth();
const ids = await ensureLabels([config.labels.trash, config.labels.done]);

const date = new Date().toLocaleDateString(config.language === "ru" ? "ru-RU" : "en-GB", {
  day: "2-digit",
  month: "2-digit",
  timeZone: config.timezone,
});

// The date, counters and service fields come from code, not the model: it can get numbers wrong when copying them.
const payload = {
  date,
  unreadTotal,
  language: config.language,
  dryRun,
  labels: {
    trash: { id: ids[config.labels.trash], name: config.labels.trash },
    done: { id: ids[config.labels.done], name: config.labels.done },
  },
  ...Object.fromEntries(SECTIONS.map((k) => [k, data[k]])),
};

console.log("Summary contains:", JSON.stringify(Object.fromEntries(SECTIONS.map((k) => [k, payload[k].length]))));

// New draft first, then clean up the old ones: if saving fails,
// the card is left with yesterday's summary rather than with nothing.
const draft = await saveDraft(`${DRAFT_SUBJECT} ${date}`, JSON.stringify(payload));
await dropOldDrafts(DRAFT_SUBJECT, draft.id);
console.log("Draft saved:", draft.id);

// The push takes its numbers from here — the same ones the card will show.
writeFileSync("out/svodka.json", JSON.stringify(payload));
