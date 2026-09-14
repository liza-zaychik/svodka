// Step 1 of the daily run: collect threads and prepare them for triage.
// No decisions are made here. But everything code can compute exactly and quickly — merging,
// message age, whose turn it is — is computed here so the model isn't distracted by it.

import { writeFileSync, mkdirSync } from "node:fs";
import { auth, listThreads, getThreads, ensureLabels, labelInfo } from "./gmail.mjs";
import { config } from "./config.mjs";

const DAY = 24 * 60 * 60 * 1000;
const dayIn = (ms) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: config.timezone }); // YYYY-MM-DD

await auth();

// Muting labels and the notification label. They don't exist in the mailbox on the first run, so create them.
const labelIds = await ensureLabels([config.labels.trash, config.labels.done, config.labels.notify]);
const skipIds = [labelIds[config.labels.trash], labelIds[config.labels.done]];
const notifyId = labelIds[config.labels.notify];

// How many unread threads there are in the WHOLE mailbox, not how many we managed to load.
const unreadTotal = (await labelInfo("UNREAD")).threadsUnread ?? null;

// Iterate over threads instead of keyword search: search misses messages
// in non-English languages and in threads with replies.
const inboxIds = await listThreads("in:inbox", 4);
const unreadIds = await listThreads("is:unread", 3);
const ids = [...new Set([...inboxIds, ...unreadIds])];
console.log(`Threads in inbox: ${inboxIds.length}, unread: ${unreadIds.length}, unique total: ${ids.length}`);
console.log(`Total unread threads in mailbox: ${unreadTotal ?? "unknown"}`);

const threads = await getThreads(ids);

// A thread is already decided if it carries one of our labels and has nothing new.
// A new unread message brings the thread back into triage.
// Our own notification emails are never triaged.
const decided = (t) =>
  t.labels.includes(notifyId) || (t.labels.some((l) => skipIds.includes(l)) && !t.labels.includes("UNREAD"));
const fresh = threads.filter((t) => !decided(t));
console.log(`Already triaged earlier: ${threads.length - fresh.length}`);

fresh.sort((a, b) => b.date - a.date);

// Volume safeguard: the rest will come in the next run.
const CAP = config.limits.threadsPerRun;
if (fresh.length > CAP) {
  console.log(`Trimmed to the ${CAP} most recent — the other ${fresh.length - CAP} will come in the next run.`);
  fresh.length = CAP;
}
console.log(`Threads sent to triage: ${fresh.length}`);

const now = Date.now();
mkdirSync("out", { recursive: true });

// No indentation: the model reads this file, and extra whitespace means extra tokens and time.
writeFileSync(
  "out/mail.json",
  JSON.stringify({
    today: dayIn(now),
    unreadTotal,
    threads: fresh.map((t) => ({
      threadId: t.threadId,
      date: dayIn(t.date),
      ageDays: Math.floor((now - t.date) / DAY),
      from: t.from,
      subject: t.subject,
      snippet: t.snippet,
      inThread: t.inThread,
      unread: t.labels.includes("UNREAD"),
      lastFromMe: t.lastFromMe,
    })),
  })
);

console.log("Done: out/mail.json");
