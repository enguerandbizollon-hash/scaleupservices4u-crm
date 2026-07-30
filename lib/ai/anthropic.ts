/**
 * lib/ai/anthropic.ts — Client Anthropic central (phase 3, temps 1).
 *
 * Avant : 8 fichiers avec modèle hardcodé (claude-sonnet-4-20250514, deux
 * générations de retard), fetch dupliqué, zéro retry, zéro visibilité coût.
 *
 * Règles :
 * - Le modèle n'est JAMAIS hardcodé chez un appelant : claudeModel(tier).
 * - Deux tiers : "smart" (analyse, génération) et "fast" (classification
 *   de masse, coût réduit). Overrides env : ANTHROPIC_MODEL / ANTHROPIC_MODEL_FAST.
 * - Retry borné (3 tentatives, backoff simple) sur 429/5xx/surcharge.
 * - callClaude retourne l'usage (tokens) pour le suivi de coût ; null en
 *   échec, comme les appelants historiques (l'IA ne bloque jamais le CRM).
 */

export type ClaudeTier = "smart" | "fast";

const DEFAULT_MODELS: Record<ClaudeTier, string> = {
  smart: "claude-sonnet-5",
  fast: "claude-haiku-4-5-20251001",
};

export function claudeModel(tier: ClaudeTier = "smart"): string {
  if (tier === "fast") return process.env.ANTHROPIC_MODEL_FAST || DEFAULT_MODELS.fast;
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODELS.smart;
}

export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface ClaudeCallOptions {
  /** Message utilisateur texte simple (cas courant). */
  prompt?: string;
  /** Blocs de contenu bruts (documents, images) ; prioritaire sur prompt. */
  content?: unknown;
  system?: string;
  maxTokens?: number;
  tier?: ClaudeTier;
  temperature?: number;
}

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ClaudeResult {
  text: string;
  model: string;
  usage: ClaudeUsage | null;
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 529]);
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface ClaudeContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
}

export interface ClaudeRawOptions extends ClaudeCallOptions {
  /** Outils Anthropic (tool use), passés tels quels. */
  tools?: unknown[];
  toolChoice?: unknown;
}

export type ClaudeRawResult =
  | {
      ok: true;
      content: ClaudeContentBlock[];
      stop_reason: string | null;
      model: string;
      usage: ClaudeUsage | null;
    }
  | { ok: false; error: string };

/**
 * Appel Messages API bas niveau avec retry : réponse complète (blocs,
 * tool_use, usage) et erreur détaillée. Base de callClaude.
 */
export async function callClaudeRaw(opts: ClaudeRawOptions): Promise<ClaudeRawResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY manquante" };

  const model = claudeModel(opts.tier);
  const content = opts.content ?? opts.prompt;
  if (content == null) return { ok: false, error: "Contenu du message manquant" };

  const body = JSON.stringify({
    model,
    max_tokens: opts.maxTokens ?? 1000,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(opts.system ? { system: opts.system } : {}),
    ...(opts.tools ? { tools: opts.tools } : {}),
    ...(opts.toolChoice ? { tool_choice: opts.toolChoice } : {}),
    messages: [{ role: "user", content }],
  });

  let lastError = "Échec après retries";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        lastError = `API Anthropic ${res.status} : ${detail.slice(0, 200)}`;
        if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_ATTEMPTS) {
          await sleep(1_000 * attempt);
          continue;
        }
        // La cause réelle (crédits épuisés, clé invalide...) doit être
        // visible dans les logs serveur : les appelants dégradent en null.
        console.error("[anthropic]", lastError);
        return { ok: false, error: lastError };
      }

      const data = await res.json() as {
        content?: ClaudeContentBlock[];
        stop_reason?: string;
        usage?: ClaudeUsage;
        model?: string;
      };
      return {
        ok: true,
        content: data.content ?? [],
        stop_reason: data.stop_reason ?? null,
        model: data.model ?? model,
        usage: data.usage ?? null,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Erreur réseau Anthropic";
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1_000 * attempt);
        continue;
      }
    }
  }
  return { ok: false, error: lastError };
}

/**
 * Appel texte simple avec retry. Retourne null si non configuré ou en
 * échec définitif : les appelants traitent null comme « pas d'IA », le
 * CRM continue.
 */
export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeResult | null> {
  const res = await callClaudeRaw(opts);
  if (!res.ok) return null;
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  if (!text) return null;
  return { text, model: res.model, usage: res.usage };
}
