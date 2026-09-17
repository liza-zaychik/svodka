<h1 align="center">svodka</h1>
<p align="center"><b>One card a day instead of your inbox.</b></p>

<p align="center">
  <a href="https://claude.ai/code/artifact/d217ae0f-3304-4592-ba26-29bfe6609ec7"><img src="docs/card.png" width="420" alt="The daily card: needs action, unread, to check, marked"></a>
</p>

<p align="center">
  <a href="https://claude.ai/code/artifact/d217ae0f-3304-4592-ba26-29bfe6609ec7"><b>▶ Open the demo card</b></a> — made-up mail, nothing connected, nothing to install
</p>

<p align="center">
  <a href="https://github.com/liza-zaychik/svodka/generate"><img src="https://img.shields.io/badge/Use%20this%20template-2ea44f?style=for-the-badge&logo=github&logoColor=white" alt="Use this template"></a>
</p>

<p align="center"><a href="README.ru.md">По-русски</a></p>

---

Every morning svodka reads your Gmail, sorts it by rules you wrote in plain words, and
leaves you one card: what needs action, what is worth reading, and what it was not sure
about. Junk gets a label — nothing is ever deleted. You decide with a tap, from your
phone too. And it does not matter what language an email came in: the card speaks yours.

AI email assistants are great at sorting mail into smart folders and drafting replies
that often say nothing. You still have to go in and look. svodka is for the other case:
when your inbox gives you hives and you are still afraid of missing something important.

## Three steps

1. **Copy it.** Press *Use this template* above and make your own private copy.
2. **Say `/setup`.** Open the copy in Claude Code and type `/setup`. It asks a few
   questions about your rules and sets everything up — about twenty minutes, once.
3. **Read one card a day.** A short push arrives in the morning; the link always shows
   the latest summary. Or ignore it for a week — nothing breaks.

<details>
<summary>What those twenty minutes are spent on</summary>

- a key to your own mailbox: a free project in Google Cloud, the longest part;
- a token so the triage runs on your Claude subscription, not on paid API calls;
- both stored as secrets in your copy — you never paste them anywhere else;
- your card published at a permanent link;
- a dry run: a full summary in which nothing in your mailbox is touched.

`/setup` walks you through every step and checks each one. The same steps as a plain
checklist: [.claude/commands/setup.md](.claude/commands/setup.md).
</details>

## Questions people ask

### Will it delete my mail?
No. The only thing it does on its own is put a "🗑 To delete" label on junk. You empty
that label yourself, whenever you feel like it. The code has no delete command at all.
Mail goes to Trash only when you press the button on the card — and Trash keeps it for
30 days.

### What does the AI actually see?
The sender, the subject and the first 200 characters of each conversation — the grey
preview line you see in your inbox list. Only for the few emails that need action does
it read the full text, so the summary can tell you the real amount and deadline. You can
switch that off. Attachments are never opened and links are never followed.

### What if an email tries to trick it?
The triage never follows instructions found inside emails and never opens their links.
Anything that looks like phishing goes to "To check" with a warning — never to
"Needs action". And the triage step has no access to your mailbox at all: labels are
applied afterwards by plain code, within a hard limit per run.

### How much does it cost?
Nothing beyond what you already pay for. It runs on free GitHub machines (a run takes
about eight minutes a day) and on your Claude Pro or Max subscription. No servers,
no API bills.

### Do I have to look at it every day?
No. The card lives at one link and always shows the latest summary. The morning push
can be switched off; the summary keeps being built.

### What if I do not speak English?
The summary — every gist, subject and hint — is written in the language you choose.
The card's own buttons and headings come in English and Russian out of the box, and
`/setup` translates them into any other language.

### What do I need?
A Gmail account, a Claude Pro or Max subscription, a GitHub account, and the Gmail
connector switched on in Claude (Settings → Connectors) — the card's buttons use it.

## Making it yours

- **`rules.md`** — retention periods, the never-touch list, section priorities, in plain
  words. Claude reads it on every run. Start from [`rules.example.md`](rules.example.md).
- **`config.json`** — language, timezone, how many emails to show, label names, and the
  push switches `notify.ready` and `notify.failed`. See [`config.example.json`](config.example.json).
- **Dry run** — a full summary with nothing labelled. Add a repository variable
  `DRY_RUN` = `true` (Settings → Secrets and variables → Actions → Variables).
- **`ui.json`** — the card and push in a language other than English or Russian;
  `/setup` writes it for you.

<details>
<summary>How it works under the hood</summary>

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

Your computer does not need to be on, and there is no server. Keep your copy private:
Actions logs of public repositories are public, and yours mention how many emails you
get (never their contents).

Known limits: Gmail only, one mailbox per copy; GitHub sometimes starts scheduled runs
hours late, so the schedule is set early.
</details>

## License

[MIT](LICENSE)
