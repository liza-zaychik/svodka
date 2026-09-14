// Talks to Gmail directly, without a connector: there is no connector in GitHub Actions.
// Needs three secrets: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

let accessToken = null;

/** Exchanges the long-lived refresh token for a one-hour access token. */
export async function auth() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error("Missing secrets GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN");
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  const data = await r.json();
  if (!data.access_token) throw new Error("Google did not grant access: " + JSON.stringify(data));
  accessToken = data.access_token;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// Gmail limits quota usage per minute and answers overuse with 429 or 403
// ("Quota exceeded … Units per minute per user"). That's not an error but a request to wait.
const RETRY_REASONS = /rateLimitExceeded|userRateLimitExceeded|Quota exceeded|quotaExceeded|backendError/;

async function call(path, init = {}) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(API + path, {
      ...init,
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    if (r.ok) return r.json();

    const text = await r.text();
    const retryable = r.status === 429 || r.status >= 500 || (r.status === 403 && RETRY_REASONS.test(text));
    if (!retryable || attempt >= 6) throw new Error(`Gmail ${r.status} on ${path}: ${text.slice(0, 600)}`);
    // Quota is counted per minute, so the pauses grow up to a minute.
    await sleep(Math.min(60000, 2000 * 2 ** attempt) + Math.random() * 1000);
  }
}

/**
 * Lists threads by iterating, page by page. Keyword search is deliberately not
 * used: it misses messages in non-English languages and inside threads.
 */
export async function listThreads(query, maxPages = 4) {
  const ids = [];
  let pageToken;
  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({ q: query, maxResults: "50" });
    if (pageToken) qs.set("pageToken", pageToken);
    const data = await call("/threads?" + qs);
    (data.threads || []).forEach((t) => ids.push(t.id));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

const header = (msg, name) =>
  (msg.payload?.headers || []).find((h) => h.name.toLowerCase() === name)?.value || "";

const clean = (s) =>
  (s || "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").slice(0, 200);

/**
 * The whole thread, including the mailbox owner's own replies. Without them there's no telling
 * whose turn it is: if the owner wrote last, the thread isn't waiting for anyone's reply.
 * Previously only incoming messages were collected — and replies got lost.
 * Message bodies are not read: only headers and the snippet.
 */
export async function getThread(id) {
  const t = await call(`/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);
  const msgs = (t.messages || [])
    .filter((m) => !(m.labelIds || []).some((l) => l === "DRAFT" || l === "TRASH"))
    .map((m) => ({
      labels: m.labelIds || [],
      date: Number(m.internalDate),
      from: header(m, "from"),
      subject: header(m, "subject"),
      snippet: clean(m.snippet),
    }))
    .sort((a, b) => a.date - b.date);
  if (!msgs.length) return null;

  const latest = msgs[msgs.length - 1];
  const incoming = msgs.filter((m) => !m.labels.includes("SENT"));
  const lastIncoming = incoming[incoming.length - 1] || latest;

  return {
    threadId: t.id,
    date: latest.date,
    from: lastIncoming.from,
    subject: lastIncoming.subject || latest.subject,
    snippet: latest.snippet,
    inThread: msgs.length,
    lastFromMe: latest.labels.includes("SENT"),
    labels: [...new Set(msgs.flatMap((m) => m.labels))],
  };
}

/** Fetches threads in batches so as not to hit Google's request limit. */
// threads.get costs 10 quota units against a limit of 250 per second — batches of 10 exceeded it.
export async function getThreads(ids, chunk = 5) {
  const out = [];
  for (let i = 0; i < ids.length; i += chunk) {
    const part = await Promise.all(ids.slice(i, i + chunk).map(getThread));
    out.push(...part.filter(Boolean));
    await sleep(300); // a steady pace instead of bursts, which are what exhaust the quota
  }
  return out;
}

const b64url = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

/** Saves the finished summary as a draft — this is the data channel to the card. */
export async function saveDraft(subject, body) {
  // No recipient on purpose: the draft is never sent anywhere, it's a data store.
  // With a "To: me" header Gmail responds "Invalid To header".
  const mime =
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    Buffer.from(body, "utf8").toString("base64");

  return call("/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw: b64url(mime) } }),
  });
}

/** Deletes previous summary drafts, except the one just saved. */
export async function dropOldDrafts(subjectPrefix, keepId) {
  const qs = new URLSearchParams({ q: `subject:${subjectPrefix}`, maxResults: "50" });
  const data = await call("/drafts?" + qs);
  for (const d of data.drafts || []) {
    if (d.id === keepId) continue;
    const full = await call(`/drafts/${d.id}?format=metadata&metadataHeaders=Subject`);
    if (header(full.message, "subject").startsWith(subjectPrefix)) {
      await fetch(`${API}/drafts/${d.id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + accessToken },
      });
    }
  }
}

/** Labels: we need ids, not names. */
export async function labels() {
  const data = await call("/labels");
  return data.labels || [];
}

/** Counters (threadsUnread and others) only come with a separate request. */
export async function labelInfo(id) {
  return call(`/labels/${id}`);
}

/** Finds labels by name and creates the missing ones. Returns { name: id }. */
export async function ensureLabels(names) {
  const existing = await labels();
  const out = {};
  for (const name of names) {
    let found = existing.find((l) => l.name === name);
    if (!found) {
      found = await call("/labels", {
        method: "POST",
        body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }),
      });
      console.log(`Created label "${name}"`);
    }
    out[name] = found.id;
  }
  return out;
}

export async function modifyThread(threadId, add = [], remove = []) {
  return call(`/threads/${threadId}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
  });
}

/** Mailbox address — the notification email is addressed to its owner. */
export async function profile() {
  return call("/profile");
}

/** Threads with a label: a label filter, not keyword search. */
export async function threadsWithLabel(labelId, query = "") {
  const qs = new URLSearchParams({ labelIds: labelId, maxResults: "50" });
  if (query) qs.set("q", query);
  const data = await call("/threads?" + qs);
  return (data.threads || []).map((t) => t.id);
}

/**
 * Puts a message straight into the mailbox as if it had arrived. Nothing is sent anywhere:
 * this way Gmail itself delivers the push, and people don't need to install any apps.
 */
export async function importMessage(mime, labelIds) {
  return call("/messages/import?internalDateSource=receivedTime&neverMarkSpam=true", {
    method: "POST",
    body: JSON.stringify({ raw: b64url(mime), labelIds }),
  });
}

/** Moves a thread to Trash. Not a permanent delete: Gmail keeps Trash for 30 days. */
export async function trashThread(threadId) {
  return call(`/threads/${threadId}/trash`, { method: "POST" });
}

function findPart(part, mime) {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data) return part;
  for (const child of part.parts || []) {
    const found = findPart(child, mime);
    if (found) return found;
  }
  return null;
}

function decodePart(part) {
  const bytes = Buffer.from(part.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const type = (part.headers || []).find((h) => h.name.toLowerCase() === "content-type")?.value || "";
  const charset = /charset="?([^";\s]+)"?/i.exec(type)?.[1] || "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes); // Russian mail still comes in windows-1251 and koi8-r
  } catch {
    return bytes.toString("utf8");
  }
}

const htmlToText = (html) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

// Quoted history repeats earlier messages; only the new part needs reading.
// Forwarded content is kept on purpose: in a forward it is the point of the email.
const REPLY_MARKER = /^(On .+ wrote:|.+ (пишет|написал|написала|написал\(а\)):|-{2,} ?(Original Message|Исходное сообщение) ?-{2,})\s*$/im;

function freshText(text) {
  const cut = text.search(REPLY_MARKER);
  return (cut > 0 ? text.slice(0, cut) : text)
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Full text of the latest incoming message in a thread, as plain text.
 * Read only for conversations that need action — a handful a day.
 */
export async function latestIncomingText(threadId, maxChars = 3000) {
  const t = await call(`/threads/${threadId}?format=full`);
  const incoming = (t.messages || [])
    .filter((m) => !(m.labelIds || []).some((l) => l === "DRAFT" || l === "TRASH" || l === "SENT"))
    .sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
  const latest = incoming[incoming.length - 1];
  if (!latest) return "";

  const plain = findPart(latest.payload, "text/plain");
  const html = plain ? null : findPart(latest.payload, "text/html");
  const text = plain ? decodePart(plain) : html ? htmlToText(decodePart(html)) : "";
  return freshText(text).slice(0, maxChars);
}
