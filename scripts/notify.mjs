// Push notification that the summary is ready or that the run failed.
//
// The main channel is an email to your own mailbox: Gmail itself delivers the notification,
// nothing needs to be installed. The email isn't sent but put into the mailbox directly;
// the previous notification is archived at the same time, so they don't pile up.
//
// Additionally, if configured: ntfy (secret NTFY_TOPIC)
// and Telegram (secrets TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID).
//
// Email content is never sent out — only counters and a link to the card.
// A failed push delivery doesn't fail the run: the summary matters more than the notification about it.

import { readFileSync, existsSync } from "node:fs";
import { config } from "./config.mjs";
import { auth, profile, ensureLabels, threadsWithLabel, trashThread, importMessage } from "./gmail.mjs";

const mode = ["ok", "fail", "test"].includes(process.argv[2]) ? process.argv[2] : "ok";
const { NTFY_TOPIC, NTFY_SERVER, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CARD_URL, RUN_URL } = process.env;

const TEXT = {
  ru: {
    ok: { title: "📬 Сводка готова", body: (c) => `Требует действия: ${c.act} · проверить: ${c.check} · помечено: ${c.marked}`, open: "Открыть сводку" },
    fail: { title: "⚠️ Сводка не собралась", body: () => "Прогон упал. Прошлая сводка на месте, причина в логе.", open: "Открыть лог" },
    test: { title: "📬 Проверка уведомления", body: () => "Если это пришло пушем — уведомления работают.", open: "Открыть сводку" },
    dry: "Пробный режим — ярлыки не ставились. ",
    sender: "Сводка",
  },
  en: {
    ok: { title: "📬 Summary is ready", body: (c) => `Needs action: ${c.act} · to check: ${c.check} · marked: ${c.marked}`, open: "Open summary" },
    fail: { title: "⚠️ Summary failed", body: () => "The run failed. The previous summary is still there; see the log.", open: "Open log" },
    test: { title: "📬 Notification test", body: () => "If this arrived as a push, notifications work.", open: "Open summary" },
    dry: "Dry run — no labels applied. ",
    sender: "Svodka",
  },
};
const t = TEXT[config.language] || TEXT.en;

const data = mode === "ok" && existsSync("out/svodka.json") ? JSON.parse(readFileSync("out/svodka.json", "utf8")) : {};
const n = (k) => (data[k] || []).length;
const title = t[mode].title;
const message = (data.dryRun ? t.dry : "") + t[mode].body({ act: n("act"), check: n("check"), marked: n("marked") });
const url = mode === "fail" ? RUN_URL : CARD_URL;

const warn = (what, e) => console.log(`::warning::Push via ${what} not delivered: ${e.message || e}`);
const sent = [];

if (config.notifyByEmail !== false && process.env.GMAIL_REFRESH_TOKEN) {
  try {
    await auth();
    const { emailAddress } = await profile();
    const labelId = (await ensureLabels([config.labels.notify]))[config.labels.notify];

    // The previous notification goes to Trash like any other email, so they do not pile up.
    // It is our own message, not the user’s mail, and Gmail keeps Trash for 30 days.
    for (const id of await threadsWithLabel(labelId)) {
      await trashThread(id);
    }

    const enc = (s) => `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
    const button = url
      ? `<a href="${url.replace(/"/g, "%22")}" style="display:inline-block;background:#2f5fd0;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${t[mode].open}</a>`
      : "";
    const html =
      `<div style="font:16px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;max-width:480px">` +
      `<p style="font-size:18px;font-weight:600;margin:0 0 8px">${title}</p>` +
      `<p style="margin:0 0 20px;color:#555">${message}</p>${button}</div>`;

    const mime = [
      // Not your own address: Gmail marks a message "from yourself" as sent and read, and there's no push.
      // The .invalid domain is reserved by the standard — nobody has such an address, and nobody ever can.
      `From: ${enc(t.sender)} <svodka@notify.invalid>`,
      `To: <${emailAddress}>`,
      `Subject: ${enc(`${title} · ${message}`)}`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(html, "utf8").toString("base64"),
    ].join("\r\n");

    // Into "Primary": by default push notifications only come from there. If Gmail won't
    // let us apply system labels, put it at least into "Inbox".
    try {
      await importMessage(mime, ["INBOX", "UNREAD", "IMPORTANT", "CATEGORY_PERSONAL", labelId]);
    } catch (e) {
      if (!String(e.message).startsWith("Gmail 400")) throw e;
      await importMessage(mime, ["INBOX", "UNREAD", labelId]);
    }
    sent.push("email");
  } catch (e) {
    warn("email", e);
  }
}

if (NTFY_TOPIC) {
  try {
    const r = await fetch(NTFY_SERVER || "https://ntfy.sh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: NTFY_TOPIC, title, message, ...(url ? { click: url } : {}) }),
    });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    sent.push("ntfy");
  } catch (e) {
    warn("ntfy", e);
  }
}

if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `${title}\n${message}`,
        ...(url ? { reply_markup: { inline_keyboard: [[{ text: t[mode].open, url }]] } } : {}),
      }),
    });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    sent.push("Telegram");
  } catch (e) {
    warn("Telegram", e);
  }
}

console.log(sent.length ? `Push sent (${sent.join(", ")}): ${title}` : "Push not sent — no channel worked.");

// In test mode a silent failure is worse than a crash.
if (mode === "test" && !sent.length) process.exit(1);
