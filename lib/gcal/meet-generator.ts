import { getValidToken } from "./gcal-client";

/**
 * Génère un lien Google Meet via l'API GCal (conferenceData).
 * Crée un événement temporaire avec conferenceDataVersion=1.
 */
export async function generateMeetLink(userId: string): Promise<string | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: "Meet — ScaleUp CRM",
        start: { dateTime: new Date().toISOString() },
        end: { dateTime: new Date(Date.now() + 3600000).toISOString() },
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    }
  );

  if (!res.ok) return null;
  const json = await res.json();
  return json.conferenceData?.entryPoints?.[0]?.uri ?? null;
}
