// Settings from config.json on top of the defaults.
// Numbers, label names and switches live here; the triage rules in words live in rules.md.

import { readFileSync, existsSync } from "node:fs";

const DEFAULTS = {
  language: "en",
  timezone: "UTC",
  limits: { threadsPerRun: 80, unread: 12, check: 3, marked: 60 },
  labels: { trash: "🗑 To delete", done: "✅ Done", notify: "📬 Svodka" },
  // Read the full text of emails that need action, so their gists carry real amounts and deadlines.
  fullTextForAction: true,
  notify: {
    ready: true, // push when the summary is ready
    failed: true, // push when a run fails
    email: true, // deliver the push as an email in your own inbox: Gmail sends it, nothing to install
  },
};

const own = existsSync("config.json") ? JSON.parse(readFileSync("config.json", "utf8")) : {};

export const config = {
  ...DEFAULTS,
  ...own,
  limits: { ...DEFAULTS.limits, ...(own.limits || {}) },
  labels: { ...DEFAULTS.labels, ...(own.labels || {}) },
  notify: { ...DEFAULTS.notify, ...(own.notify || {}) },
};

// The draft subject is the contract with the card, which finds the draft by it. Do not change.
export const DRAFT_SUBJECT = "SVODKA-DATA";

// Dry run: the summary is built, but no labels are applied in the mailbox.
export const dryRun = /^(1|true|yes)$/i.test(process.env.DRY_RUN || "");
