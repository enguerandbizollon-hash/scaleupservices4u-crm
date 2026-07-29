/**
 * Génère un résumé IA structuré d'une action (meeting/call) via Claude API.
 */
import { callClaude, isClaudeConfigured } from "@/lib/ai/anthropic";

export async function generateActionSummary(action: {
  type: string;
  title: string;
  start_datetime?: string | null;
  due_date?: string | null;
  notes?: string | null;
  contacts?: { name: string; role?: string }[];
  organizations?: { name: string; role?: string }[];
}): Promise<string | null> {
  if (!isClaudeConfigured()) return null;

  const prompt = `Tu es un assistant M&A pour un cabinet de conseil.
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

  const res = await callClaude({ prompt, maxTokens: 1000 });
  return res?.text ?? null;
}
