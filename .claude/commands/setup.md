---
description: Set up svodka for your mailbox — rules, Gmail key, secrets, card, first run
---

Help the user set up svodka in this repository, step by step.

How to work:
- Speak the user's language. Keep messages short; explain every term in one phrase.
- Verify each step yourself (`gh`, workflow logs) instead of asking for screenshots.
- Never ask the user to paste tokens or secrets into the chat. Secrets go from their
  terminal straight into GitHub.
- Ask before anything that grants access or publishes something.

## 0. Prerequisites

- `gh auth status` — the GitHub CLI must be logged in. If `gh` is missing, help
  install it and run `gh auth login`.
- `gh repo view --json visibility` must say PRIVATE. If the repository is public,
  stop and explain: Actions logs and personal rules would be visible to everyone.
  Offer `gh repo edit --visibility private --accept-visibility-change-consequences`.
- Node.js 20 or newer.

## 1. Rules — a short questionnaire

Ask in two or three short rounds. Every question has a default; "ok" keeps it.

Main questions:
1. Summary language (default: the user's language).
2. Timezone.
3. How many unread conversations to show (12).
4. At most how many "to check" (3).
5. At most how many conversations per run (80).
6. Marketing and newsletters become junk after how many days (7).
7. Receipts: groceries / clothing and cosmetics / electronics (7 days / 2 months / 1 year).
8. Do they have business, accounting or tax mail? (Adds it to "never touch".)
9. Push notifications: when the summary is ready (yes), when a run fails (yes).

Offer "more details" for: past trips (6 months), appointment confirmations (right
after the event), stale confirmations (2 weeks), things that are junk immediately
(one-time codes, digests, review requests), the never-touch list, and the priority
order of the Unread section, and whether to read the full text of emails that need
action for more precise gists (`fullTextForAction`, default yes).

Then ask one open question: "Anything specific? For example, 'school newsletters are
junk after a week'." Add the answers to the rules in plain words.

Write:
- `rules.md` — based on `rules.example.md`, with the answers applied, in the summary language;
- `config.json` — `language`, `timezone`, `limits`, and `labels` (`trash`, `done`,
  `notify`) named in the summary language, for example "🗑 To delete", "✅ Done", "📬 Svodka",
  and the `notify` switches `ready` and `failed` from question 9 (`email` stays `true`).
  `config.example.json` shows every key.
- `ui.json` — only if the summary language is neither English nor Russian: translate the
  values of `ui/en.json` into that language, keeping the keys, `{placeholders}` and emoji
  exactly, and save it in the repository root. The card and the push use it; without it
  their buttons and headings stay in English (the summary itself is in any language anyway).

Set the schedule in `.github/workflows/daily.yml` to about 07:17 in the user's
timezone, converted to UTC. Keep the minute off the hour: GitHub delays runs
scheduled exactly on the hour the most.

Commit and push these files.

## 2. Gmail key (the user does this in Google Cloud, about 15 minutes)

Walk through it by menu, one step at a time:
1. Create a project (project picker at the top → New project).
2. ☰ → APIs & Services → Library → **Gmail API** → Enable.
   (Not "Gmail MCP API" or "Postmaster Tools".)
3. ☰ → APIs & Services → OAuth consent screen (Google Auth Platform):
   Branding — app name and support email; Audience — **External**.
4. Audience → **Publish app**. Otherwise Google revokes access every 7 days.
   Proceed through the warning about 100 users: only this one user will sign in.
5. Clients → Create client → **Desktop app** → keep the Client ID and secret open.

Then the user runs, in their own terminal, from the repository folder:

    node scripts/get-token.mjs

It asks for the Client ID and secret, opens Google sign-in (the "unverified app"
screen is expected: Advanced → Go to …), and stores `GMAIL_CLIENT_ID`,
`GMAIL_CLIENT_SECRET` and `GMAIL_REFRESH_TOKEN` as repository secrets via `gh`.
Check with `gh secret list`.

## 3. Claude subscription token

The user runs in their own terminal:

    claude setup-token

and then:

    gh secret set CLAUDE_CODE_OAUTH_TOKEN

pasting the token when asked (it is read from the terminal and never shown).
Warn: the token must be one line. If a run later fails with "line break in the
Authorization header", the terminal wrapped it — on macOS run
`pbpaste | tr -d '\n' | pbcopy` before pasting again.

## 4. The card

- The Gmail connector must be enabled in Claude (Settings → Connectors → Gmail).
- Publish `card/svodka.html` as an Artifact with these capabilities:
  `{"mcp":{"servers":[{"server":"Gmail","tools":["list_drafts","label_thread","unlabel_thread","trash_thread"]}]}}`.
  This needs the Artifact tool — Claude Code in the desktop app or on claude.ai/code.
  If it is not available here, say so and tell the user where to run this step.
- Store the link: `gh variable set CARD_URL --body "<artifact url>"`.
- Tell the user the first open asks "This artifact uses connectors" — press Continue.
  Suggest adding the link to the phone's home screen.

## 5. First run

1. Dry run first: `gh variable set DRY_RUN --body true`, then `gh workflow run daily.yml`.
   Watch it with `gh run watch`; read the counters in the log.
2. `gh workflow run notify-test.yml` — ask the user whether the push arrived.
3. Open the card together. If something is sorted wrongly, fix it in `rules.md`
   in plain words and run again.
4. When the user is happy: `gh variable delete DRY_RUN`.

Finish by saying when the next summary comes, where the rules live, and that
decisions are always reversible: Trash keeps mail for 30 days, labels can be removed.
