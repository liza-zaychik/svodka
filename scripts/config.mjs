// Settings from config.json on top of the defaults.
// Numbers and label names live here; the triage rules, written in words, live in rules.md.

import { readFileSync, existsSync } from "node:fs";

const DEFAULTS = {
  language: "en",
  timezone: "UTC",
  limits: { threadsPerRun: 80, unread: 12, check: 3, marked: 60 },
  labels: { trash: "🗑 To delete", done: "✅ Done", notify: "📬 Svodka" },
  // Push via an email to your own mailbox: Gmail itself delivers the notification, nothing to install.
  notifyByEmail: true,
};

const own = existsSync("config.json") ? JSON.parse(readFileSync("config.json", "utf8")) : {};

export const config = {
  ...DEFAULTS,
  ...own,
  limits: { ...DEFAULTS.limits, ...(own.limits || {}) },
  labels: { ...DEFAULTS.labels, ...(own.labels || {}) },
};

// The draft subject is a contract with the card — that's how it finds the draft. Do not change.
export const DRAFT_SUBJECT = "SVODKA-DATA";

// Dry run: the summary is built, but no labels are applied in the mailbox.
export const dryRun = /^(1|true|yes)$/i.test(process.env.DRY_RUN || "");
