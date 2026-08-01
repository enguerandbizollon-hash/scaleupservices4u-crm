// Client Gmail — toutes les fonctions reçoivent userId
// Auth partagée avec GCal via getValidToken (mêmes scopes Google OAuth).
// Pas de token global, isolation stricte par utilisateur.
// Le paramètre optionnel `client` (Supabase) est requis en contexte cron
// (pas de session SSR) : y passer le client admin.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidToken } from "@/lib/gcal/gcal-client";

// =============================================================================
// Types
// =============================================================================

export interface GmailMessageHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
  headers?: GmailMessageHeader[];
}

interface GmailMessageRaw {
  id: string;
  threadId: string;
  internalDate?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailMessagePart;
}

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface ParsedGmailMessage {
  id: string;
  threadId: string;
  internalDate: Date;
  labelIds: string[];
  snippet: string;
  subject: string;
  from: { name: string; email: string } | null;
  to: { name: string; email: string }[];
  cc: { name: string; email: string }[];
  direction: "inbound" | "outbound";
  bodyText: string;
  bodyPreview: string;
}

// =============================================================================
// Légères API existantes (conservées pour compat ascendante)
// =============================================================================

/**
 * Récupère l'aperçu d'un thread Gmail.
 */
export async function getGmailThreadPreview(
  userId: string,
  threadId: string,
  client?: SupabaseClient
): Promise<{ subject: string; snippet: string } | null> {
  const token = await getValidToken(userId, client);
  if (!token) return null;

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { messages?: { payload?: GmailMessagePart }[]; snippet?: string };
  return {
    subject: json.messages?.[0]?.payload?.headers
      ?.find((h) => h.name === "Subject")?.value ?? "",
    snippet: json.snippet ?? "",
  };
}

/**
 * Brouillons Gmail (funnel acquéreur, plan R1 lot 3). L'outil ne POSTE
 * jamais : il dépose un brouillon, l'utilisateur relit et envoie depuis
 * Gmail. threadId + In-Reply-To permettent d'accrocher une relance au fil
 * d'origine. Résultat discriminé : l'UI doit distinguer « Google non
 * connecté » de « droits insuffisants » (reconnexion à faire depuis
 * Connecteurs) et d'une erreur API.
 */
export interface GmailDraftInput {
  to: string[];
  subject: string;
  body: string;
  threadId?: string | null;
  /** Message-ID RFC822 du message auquel on répond (via getThreadLastMessageMeta). */
  inReplyTo?: string | null;
  references?: string | null;
}

export type GmailDraftResult =
  | { ok: true; draftId: string; threadId: string | null }
  | { ok: false; reason: "no_token" | "insufficient_scope" | "api_error"; detail?: string };

/** Encodage RFC 2047 des en-têtes non ASCII (sujets accentués). */
function encodeHeaderUtf8(value: string): string {
  return /[^\x20-\x7E]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`
    : value;
}

/** Message MIME brut (exporté pur pour les tests). text/plain volontaire. */
export function buildRawMessage(input: GmailDraftInput): string {
  const headers = [
    `To: ${input.to.join(", ")}`,
    `Subject: ${encodeHeaderUtf8(input.subject)}`,
  ];
  if (input.inReplyTo) headers.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) headers.push(`References: ${input.references}`);
  headers.push("MIME-Version: 1.0");
  headers.push("Content-Type: text/plain; charset=utf-8");
  return [...headers, "", input.body].join("\r\n");
}

export async function createGmailDraft(
  userId: string,
  draft: GmailDraftInput,
  client?: SupabaseClient
): Promise<GmailDraftResult> {
  const token = await getValidToken(userId, client);
  if (!token) return { ok: false, reason: "no_token" };

  const encoded = Buffer.from(buildRawMessage(draft), "utf8").toString("base64url");
  const payload: { message: { raw: string; threadId?: string } } = { message: { raw: encoded } };
  if (draft.threadId) payload.message.threadId = draft.threadId;

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return {
      ok: false,
      reason: res.status === 403 ? "insufficient_scope" : "api_error",
      detail: detail.slice(0, 300),
    };
  }
  const json = (await res.json()) as { id?: string; message?: { threadId?: string } };
  if (!json.id) return { ok: false, reason: "api_error", detail: "Réponse Gmail sans id de brouillon" };
  return { ok: true, draftId: json.id, threadId: json.message?.threadId ?? null };
}

/**
 * Métadonnées du dernier message d'un fil (pour accrocher une relance :
 * In-Reply-To/References + sujet d'origine). Couvert par gmail.readonly.
 */
export async function getThreadLastMessageMeta(
  userId: string,
  threadId: string,
  client?: SupabaseClient
): Promise<{ messageId: string; rfcMessageId: string | null; subject: string | null } | null> {
  const token = await getValidToken(userId, client);
  if (!token) return null;

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=Subject`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    messages?: { id: string; payload?: { headers?: { name: string; value: string }[] } }[];
  };
  const last = json.messages?.[json.messages.length - 1];
  if (!last) return null;
  const header = (name: string) =>
    last.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? null;
  return { messageId: last.id, rfcMessageId: header("Message-ID"), subject: header("Subject") };
}

// =============================================================================
// Nouvelles API : ingestion automatique (V57)
// =============================================================================

/**
 * Liste les IDs de messages Gmail correspondant à une query (syntaxe Gmail).
 * Gère la pagination interne, plafonne à `maxResults` total.
 */
export async function listGmailMessageIds(
  userId: string,
  opts: { query: string; maxResults?: number },
  client?: SupabaseClient
): Promise<{ id: string; threadId: string }[]> {
  const token = await getValidToken(userId, client);
  if (!token) return [];

  const limit = opts.maxResults ?? 100;
  const collected: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;

  while (collected.length < limit) {
    const remaining = limit - collected.length;
    const pageSize = Math.min(remaining, 100);
    const params = new URLSearchParams({
      q: opts.query,
      maxResults: String(pageSize),
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return collected;

    const json = (await res.json()) as GmailListResponse;
    const ids = json.messages ?? [];
    collected.push(...ids);
    if (!json.nextPageToken || ids.length === 0) break;
    pageToken = json.nextPageToken;
  }

  return collected;
}

/**
 * Récupère un message Gmail complet (headers + corps) et le parse.
 */
export async function getGmailMessage(
  userId: string,
  messageId: string,
  client?: SupabaseClient
): Promise<ParsedGmailMessage | null> {
  const token = await getValidToken(userId, client);
  if (!token) return null;

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;

  const raw = (await res.json()) as GmailMessageRaw;
  return parseGmailMessage(raw);
}

// =============================================================================
// Parsing : helpers internes exportés pour tests
// =============================================================================

const EMAIL_ADDRESS_RE = /([^\s<,]+@[^\s>,]+)/;

export function parseAddressList(value: string | undefined | null): { name: string; email: string }[] {
  if (!value) return [];
  // Split sur virgule en respectant les guillemets, suffisant pour Gmail.
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseAddressSingle)
    .filter((v): v is { name: string; email: string } => v !== null);
}

function parseAddressSingle(raw: string): { name: string; email: string } | null {
  const m = raw.match(EMAIL_ADDRESS_RE);
  if (!m) return null;
  const email = m[1].replace(/[<>]/g, "").trim().toLowerCase();
  const namePart = raw.replace(EMAIL_ADDRESS_RE, "").replace(/[<>"]/g, "").trim();
  return { name: namePart, email };
}

function decodeBase64Url(data: string): string {
  try {
    return Buffer.from(data, "base64url").toString("utf-8");
  } catch {
    return "";
  }
}

function extractPlainText(part: GmailMessagePart | undefined): string {
  if (!part) return "";
  // text/plain direct
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  // multipart : préférer text/plain, fallback text/html (strippé)
  if (part.parts?.length) {
    const plain = part.parts.find((p) => p.mimeType === "text/plain");
    if (plain?.body?.data) return decodeBase64Url(plain.body.data);

    for (const sub of part.parts) {
      const text = extractPlainText(sub);
      if (text) return text;
    }

    const html = part.parts.find((p) => p.mimeType === "text/html");
    if (html?.body?.data) {
      return stripHtml(decodeBase64Url(html.body.data));
    }
  }
  // Fallback racine HTML
  if (part.mimeType === "text/html" && part.body?.data) {
    return stripHtml(decodeBase64Url(part.body.data));
  }
  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function headerValue(headers: GmailMessageHeader[] | undefined, name: string): string {
  if (!headers) return "";
  const h = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function parseGmailMessage(raw: GmailMessageRaw): ParsedGmailMessage | null {
  if (!raw.id) return null;

  const headers = raw.payload?.headers ?? [];
  const subject = headerValue(headers, "Subject");
  const fromRaw = headerValue(headers, "From");
  const toRaw = headerValue(headers, "To");
  const ccRaw = headerValue(headers, "Cc");

  const from = parseAddressList(fromRaw)[0] ?? null;
  const to = parseAddressList(toRaw);
  const cc = parseAddressList(ccRaw);

  const labelIds = raw.labelIds ?? [];
  // SENT = j'ai envoyé le mail (sortant), INBOX = j'ai reçu (entrant)
  const direction: "inbound" | "outbound" = labelIds.includes("SENT") && !labelIds.includes("INBOX")
    ? "outbound"
    : "inbound";

  const internalDate = raw.internalDate
    ? new Date(parseInt(raw.internalDate, 10))
    : new Date();

  const bodyText = extractPlainText(raw.payload);
  const bodyPreview = bodyText.slice(0, 500);

  return {
    id: raw.id,
    threadId: raw.threadId,
    internalDate,
    labelIds,
    snippet: raw.snippet ?? "",
    subject,
    from,
    to,
    cc,
    direction,
    bodyText,
    bodyPreview,
  };
}
