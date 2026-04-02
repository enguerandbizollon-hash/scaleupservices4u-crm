// Helper pour déclencher la sync GCal depuis les server actions
// Appel non-bloquant : fire-and-forget (silencieux si GCal non connecté)

export function syncToGCal(payload: {
  action: "create" | "update" | "delete";
  source_type: string;
  source_id: string;
  event: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    allDay: boolean;
    sourceUrl?: string;
  };
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  fetch(`${baseUrl}/api/gcal/sync-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {}); // silencieux si GCal non connecté ou erreur réseau
}
