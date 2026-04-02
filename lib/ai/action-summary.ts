/**
 * Génère un résumé IA structuré d'une action (meeting/call) via Claude API.
 */
export async function generateActionSummary(action: {
  type: string;
  title: string;
  start_datetime?: string | null;
  due_date?: string | null;
  notes?: string | null;
  contacts?: { name: string; role?: string }[];
  organizations?: { name: string; role?: string }[];
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `Tu es un assistant M&A / fundraising pour un cabinet de conseil.
Génère un résumé structuré et professionnel de cette action :

Type : ${action.type}
Titre : ${action.title}
Date : ${action.start_datetime ?? action.due_date ?? "Non précisée"}
Participants : ${(action.contacts ?? []).map(c => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ") || "Aucun"}
Organisations : ${(action.organizations ?? []).map(o => `${o.name}${o.role ? ` (${o.role})` : ""}`).join(", ") || "Aucune"}
Notes : ${action.notes ?? "Aucune"}

Format :
## Résumé
[2-3 phrases]

## Points clés
- [point 1]
- [point 2]

## Prochaines actions suggérées
- [action 1]
- [action 2]`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json.content?.[0]?.text ?? null;
  } catch {
    return null;
  }
}
