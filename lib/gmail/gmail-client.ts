import { getValidToken } from "@/lib/gcal/gcal-client";

/**
 * Récupère l'aperçu d'un thread Gmail.
 */
export async function getGmailThreadPreview(
  userId: string,
  threadId: string
): Promise<{ subject: string; snippet: string } | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return {
    subject: json.messages?.[0]?.payload?.headers
      ?.find((h: { name: string }) => h.name === "Subject")?.value ?? "",
    snippet: json.snippet ?? "",
  };
}

/**
 * Crée un brouillon Gmail.
 */
export async function createGmailDraft(
  userId: string,
  draft: { to: string[]; subject: string; body: string }
): Promise<string | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  const message = [
    `To: ${draft.to.join(", ")}`,
    `Subject: ${draft.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    draft.body,
  ].join("\n");

  const encoded = Buffer.from(message).toString("base64url");

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { raw: encoded } }),
    }
  );

  if (!res.ok) return null;
  const json = await res.json();
  return json.id ?? null;
}
