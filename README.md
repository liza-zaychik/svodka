# svodka

**A daily email summary for people who hate reading email.**

Once a day svodka reads your Gmail, sorts it by rules you wrote in plain words,
and gives you one card: what needs action, what is worth reading, and what it
was not sure about. Junk gets a label. Nothing is ever deleted. You decide with
a tap — from your phone too.

[Русская версия](README.ru.md)

## Why another email assistant

Most AI email tools ask you to trust them: *the AI will handle your inbox*.
svodka takes the opposite stance — **you can audit everything it does**.

- **Your rules, in plain words.** A grocery receipt is junk after a week, an
  electronics receipt is kept for a year for the warranty, a sign-in code is junk
  right away. You write this in `rules.md`, not as filters.
- **Nothing is deleted.** Junk gets the `🗑 To delete` label, and you clean it yourself.
- **Doubts are shown, not hidden.** Up to three conversations it was unsure about
  go into "To check", each with the reason.
- **Decisions stick.** "Keep" hides a conversation from future summaries — until
  someone replies in it.

## How it works

```
GitHub Actions, every morning (free)
  → reads your Gmail directly, with your own OAuth key
  → Claude sorts conversations by rules.md and writes a one-line gist
    for the ones you will actually read
  → code labels the junk and saves the summary as a Gmail draft
  → a short email lands in your inbox, so Gmail itself sends you the push

The card — a Claude artifact, published once, one permanent link
  → reads the latest draft when you open it
  → its buttons act on Gmail through your Claude Gmail connector
```

Your computer does not need to be on, and there is no server.

## What you need

- A Gmail account.
- A Claude Pro or Max subscription. Triage runs on it through `claude setup-token`,
  so there are no API bills.
- A GitHub account. A private repository and free Actions minutes are enough:
  a run takes about 8 minutes, around 250 minutes a month, and the free plan
  includes 2,000.
- The Gmail connector enabled in Claude (Settings → Connectors) — the card's
  buttons use it.

## Setup

1. **Use this template → Create a new repository.** Make it **private** — see
   [Privacy](#privacy-and-safety) for why.
2. Clone it and open the folder in Claude Code.
3. Run `/setup`. Claude asks a few questions about your rules, walks you through
   the Google Cloud key (about 15 minutes, once), stores the secrets, publishes
   your card and starts a dry run.

Prefer doing it by hand? `/setup` is a readable checklist:
[.claude/commands/setup.md](.claude/commands/setup.md).

## Configuration

- `rules.md` — retention periods, the never-touch list, section priorities.
  Plain words; Claude reads it on every run. Start from `rules.example.md`.
- `config.json` — summary language, timezone, section limits, label names, and push
  switches: `notify.ready` (the summary is ready), `notify.failed` (a run failed),
  `notify.email` (deliver the push as an email in your inbox). Set any of them to
  `false` to switch it off. See `config.example.json`.
- Repository variable `DRY_RUN=true` — the full summary, but no labels are applied.
- `.github/workflows/daily.yml` — the schedule.

## Privacy and safety

- **What Claude sees:** the sender, subject and the first 200 characters of each
  conversation's latest message. No message bodies, no attachments, and no links
  are opened.
- **Where the summary lives:** as a draft in your own mailbox. It is not stored
  anywhere else.
- **Logs:** only counters are logged. Keep the repository private anyway —
  Actions logs of public repositories are public.
- **Prompt injection:** the triage step has no Gmail access at all, only read and
  write access to two local files. Labels and drafts are applied afterwards by
  plain code, within hard limits. An email that tries to give instructions is
  flagged in "To check".
- **Deleting:** the pipeline contains no delete code. Mail goes to Trash only
  when you press the button in the card, and Gmail keeps Trash for 30 days.
- **Google's "unverified app" screen:** you create your own OAuth client, used
  only by you, so Google shows a warning once. That is expected.

## Limitations

- Gmail only, one mailbox per repository.
- GitHub may start scheduled runs hours late, so the schedule is set early.
- The card needs claude.ai: its buttons use your Claude Gmail connector.

## License

[MIT](LICENSE)
