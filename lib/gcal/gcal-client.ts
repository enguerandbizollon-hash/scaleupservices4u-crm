// Client Google Calendar — toutes les fonctions reçoivent userId
// Jamais de token global — isolation stricte par utilisateur

import { createClient } from "@/lib/supabase/server";

/**
 * Récupère un access token GCal valide pour l'utilisateur.
 * Rafraîchit automatiquement si expiré.
 * Retourne null si pas connecté.
 */
export async function getValidToken(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("gcal_access_token, gcal_refresh_token, gcal_token_expiry")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.gcal_access_token) return null;

  const isExpired = data.gcal_token_expiry
    ? new Date(data.gcal_token_expiry) < new Date(Date.now() + 60_000)
    : false;

  if (!isExpired) return data.gcal_access_token;
  if (!data.gcal_refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: data.gcal_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;
  const json = await res.json();
  if (!json.access_token) return null;

  await supabase
    .from("user_settings")
    .update({
      gcal_access_token: json.access_token,
      gcal_token_expiry: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId);

  return json.access_token;
}

export type GCalAttendee = { email: string; displayName?: string };

export async function createGCalEvent(
  token: string,
  event: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    allDay: boolean;
    sourceUrl?: string;
    attendees?: GCalAttendee[];
  },
): Promise<string | null> {
  const desc = [event.description, event.sourceUrl ? `Voir dans le CRM : ${event.sourceUrl}` : ""].filter(Boolean).join("\n\n");
  const body = {
    summary: event.summary,
    description: desc || undefined,
    start: event.allDay ? { date: event.start.split("T")[0] } : { dateTime: event.start, timeZone: "Europe/Paris" },
    end:   event.allDay ? { date: event.end.split("T")[0] }   : { dateTime: event.end,   timeZone: "Europe/Paris" },
    attendees: event.attendees ?? [],
    guestsCanModifyEvent: false,
    guestsCanInviteOthers: false,
  };

  // sendUpdates=all fait que Google envoie les emails d'invitation aux participants
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) return null;
  const json = await res.json();
  return json.id ?? null;
}

export async function updateGCalEvent(
  token: string,
  gcalEventId: string,
  updates: Partial<{
    summary: string;
    description: string;
    start: string;
    end: string;
    allDay: boolean;
    attendees: GCalAttendee[];
  }>,
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (updates.summary) body.summary = updates.summary;
  if (updates.description) body.description = updates.description;
  if (updates.start) {
    body.start = updates.allDay ? { date: updates.start.split("T")[0] } : { dateTime: updates.start, timeZone: "Europe/Paris" };
  }
  if (updates.end) {
    body.end = updates.allDay ? { date: updates.end.split("T")[0] } : { dateTime: updates.end, timeZone: "Europe/Paris" };
  }
  if (updates.attendees !== undefined) {
    body.attendees = updates.attendees;
  }

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcalEventId}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export async function deleteGCalEvent(token: string, gcalEventId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcalEventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
