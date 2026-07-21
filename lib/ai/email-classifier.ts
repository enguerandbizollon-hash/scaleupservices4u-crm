/**
 * lib/ai/email-classifier.ts — Classification IA d'un email vers un dossier
 *
 * Donné un email brut (sujet + preview), et la liste compacte des dossiers
 * actifs du user, retourne au plus un deal_id avec un score de confiance.
 *
 * L'IA peut aussi renvoyer null (deal_id null) si elle n'a pas assez
 * d'éléments. Dans ce cas, l'orchestrateur place le mail en boîte de tri.
 *
 * Modèle : claude-sonnet-4-20250514 (cf. CLAUDE.md §IA).
 *
 * Choix d'archi : pas de tool_use ici. Les sorties JSON strictes via
 * system prompt + parsing tolérant (cohérent avec matching-brain.ts).
 * Pour les classifications de masse, on garde le call simple et borné
 * en max_tokens pour contrôler le coût.
 */

export interface ActiveDealCandidate {
  id: string;
  name: string;
  deal_type: string;
  sector: string | null;
  organization_name: string | null;
}

export interface EmailClassifierInput {
  subject: string;
  bodyPreview: string;
  fromName: string;
  fromEmail: string;
  toEmails: string[];
  direction: "inbound" | "outbound";
  candidates: ActiveDealCandidate[];
}

export interface EmailClassifierOutput {
  deal_id: string | null;
  confidence: number; // 0-100
  reason: string;
}

const SYSTEM_PROMPT = `Tu classes des emails professionnels d'un cabinet de conseil M&A vers le dossier auquel ils appartiennent.

Règles impératives :
- Tu choisis au plus UN dossier parmi la liste fournie, jamais d'invention.
- Si rien ne correspond clairement, deal_id = null et confidence faible.
- Tu te bases sur : le sujet, l'expéditeur, le destinataire, l'extrait du corps, et le nom du dossier ou de l'organisation cliente.
- Pas de tiret cadratin (—) dans les textes, virgule ou point.
- Tu réponds uniquement par un objet JSON valide, sans texte hors JSON, sans backticks.`;

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function buildPrompt(input: EmailClassifierInput): string {
  const parts: string[] = [];
  parts.push(`Email à classer :`);
  parts.push(`- Direction : ${input.direction === "inbound" ? "reçu" : "envoyé"}`);
  parts.push(`- De : ${input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail}`);
  if (input.toEmails.length) parts.push(`- À : ${input.toEmails.join(", ")}`);
  parts.push(`- Sujet : ${input.subject || "(vide)"}`);
  parts.push(`- Extrait du corps :\n${input.bodyPreview.slice(0, 600)}`);

  parts.push(`\nDossiers actifs candidats :`);
  if (input.candidates.length === 0) {
    parts.push(`(aucun dossier actif)`);
  } else {
    for (const c of input.candidates) {
      const orgPart = c.organization_name ? ` · client ${c.organization_name}` : "";
      const sectorPart = c.sector ? ` · ${c.sector}` : "";
      parts.push(`- id=${c.id} | ${c.name} (${c.deal_type})${orgPart}${sectorPart}`);
    }
  }

  parts.push(`
Produit strictement ce JSON :
{
  "deal_id": "<uuid d'un dossier listé ou null si aucun match clair>",
  "confidence": <entier 0 à 100, ta certitude que ce dossier est le bon>,
  "reason": "1 phrase factuelle expliquant le choix"
}

Si confidence < 60, mets deal_id = null pour passer le mail en tri manuel.`);

  return parts.join("\n");
}

function isValidUuid(v: unknown): v is string {
  return typeof v === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function parseResponse(
  raw: string,
  validIds: Set<string>,
): EmailClassifierOutput | null {
  try {
    const parsed = JSON.parse(stripCodeFences(raw)) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null) return null;

    const dealRaw = parsed.deal_id;
    const dealId = isValidUuid(dealRaw) && validIds.has(dealRaw) ? dealRaw : null;
    const confidenceRaw = parsed.confidence;
    const confidence = typeof confidenceRaw === "number"
      ? Math.max(0, Math.min(100, Math.round(confidenceRaw)))
      : 0;
    const reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "";

    return { deal_id: dealId, confidence, reason };
  } catch {
    return null;
  }
}

/**
 * Appelle l'API Anthropic pour classer un email.
 * Retourne null si la clé API est absente ou l'appel échoue.
 * L'orchestrateur traite null comme "pas de classification IA possible".
 */
export async function classifyEmailWithAI(
  input: EmailClassifierInput,
): Promise<EmailClassifierOutput | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  if (input.candidates.length === 0) {
    return { deal_id: null, confidence: 0, reason: "Aucun dossier actif pour ce user." };
  }

  const validIds = new Set(input.candidates.map((c) => c.id));
  const prompt = buildPrompt(input);

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
        max_tokens: 250,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (typeof text !== "string") return null;
    return parseResponse(text, validIds);
  } catch {
    return null;
  }
}
