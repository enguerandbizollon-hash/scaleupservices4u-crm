import { getValidToken } from "./gcal-client";

/**
 * Génère un lien Google Meet via l'API GCal (conferenceData).
 * Crée un événement avec conferenceDataVersion=1 à la date fournie
 * (ou maintenant par défaut si aucun paramètre).
 */
export async function generateMeetLink(
  userId: string,
  startDatetime?: string,    // ISO string
  durationMinutes?: number,  // défaut 60
  title?: string,            // titre de l'action (sinon fallback générique)
): Promise<string | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  const start = startDatetime ? new Date(startDatetime) : new Date();
  const end = new Date(start.getTime() + (durationMinutes ?? 60) * 60000);

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: title ?? "Meeting — ScaleUp CRM",
        start: { dateTime: start.toISOString() },
        end:   { dateTime: end.toISOString() },
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
