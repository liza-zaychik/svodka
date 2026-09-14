# svodka

**A daily email summary for people who hate reading email.**

Once a day svodka reads your Gmail, sorts it by rules you wrote in plain words,
and gives you one card: what needs action, what is worth reading, and what it
was not sure about. Junk gets a label. Nothing is ever deleted. You decide with
a tap — from your phone too.

[Русская версия](README.ru.md)

## Why another email assistant

AI email assistants are great at sorting mail into smart folders and drafting
replies for you — replies that often say nothing. But you still have to go into
your inbox and look. The folders are tidier; the inbox is still the inbox.

What if your inbox gives you hives — and you are still afraid of missing
something important?

svodka takes that fear away. You always have one link with a summary of your
mail. Open it or don't. Check it whenever you like, or get a short reminder email
every morning. But when you do open it, you will not miss the one message that
matters: a bill, a fine, a reply from a real person — at the top, in one line.

And it does not matter what language an email came in: the summary is written in yours.

How it stays trustworthy:

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

1. **Make your own copy.** On this page press **Use this template → Create a new
   repository**. Pick your account, give the copy a name (for example `svodka`),
   choose **Private** — only you will see it, and it will hold your rules and run
   logs — and press **Create repository**.

2. **Download it to your computer — "clone" it.** Cloning means downloading your
   copy as a folder you can work in. The easiest way is GitHub Desktop:
   1. Install [GitHub Desktop](https://desktop.github.com) and sign in with your GitHub account.
   2. Open **File → Clone repository**.
   3. On the **GitHub.com** tab pick your new copy.
   4. In **Local path** choose where the folder will live, for example
      `Documents/GitHub/svodka`, and press **Clone**.

   If you prefer a terminal, it is one command: `gh repo clone <your-account>/svodka`.

3. **Open the folder in Claude Code.** In the Claude desktop app, go to the
   **Code** tab and choose that folder.

4. **Run `/setup`.** Type `/setup` in the chat. Claude asks about your rules, walks
   you through the Google Cloud key (about 15 minutes, once), stores the secrets in
   your copy, publishes your card and starts a dry run — a run in which nothing in
   your mailbox gets labelled.

Prefer doing it without Claude? The same steps as a plain checklist:
[.claude/commands/setup.md](.claude/commands/setup.md).

## Configuration

- `rules.md` — retention periods, the never-touch list, section priorities.
  Plain words; Claude reads it on every run. Start from `rules.example.md`.
- `config.json` — summary language, timezone, section limits, label names, and push
  switches: `notify.ready` (the summary is ready), `notify.failed` (a run failed),
  `notify.email` (deliver the push as an email in your inbox). Set any of them to
  `false` to switch it off. See `config.example.json`.
- `ui.json` — buttons and headings of the card and the push in your language, if it is
  neither English nor Russian. `/setup` translates `ui/en.json` for you.
- **Dry run** — the summary is built, but nothing in your mailbox gets labelled.
  Switch it on with a repository variable `DRY_RUN` set to `true` (on GitHub:
  Settings → Secrets and variables → Actions → Variables). `/setup` turns it on
  for the first run.
- `.github/workflows/daily.yml` — the schedule.

## Privacy and safety

- **What Claude sees:** the sender, subject and the first 200 characters of each
  conversation's latest message. Only for the few emails in "Needs action" it reads
  the full text, so the gist carries the real amounts and deadlines — switch that
  off with `fullTextForAction: false` in `config.json`. Attachments are never read
  and links are never opened.
- **Where the summary lives:** as a draft in your own mailbox. It is not stored
  anywhere else.
- **Logs:** only counters are logged. Keep the repository private anyway —
  Actions logs of public repositories are public.
- **Phishing and prompt injection.** The triage never follows instructions found in
  emails and never opens their links. Anything that looks like phishing goes to
  "To check" with a warning — never to "Needs action".
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
