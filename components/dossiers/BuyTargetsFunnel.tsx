"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getDealTargetFunnel,
  markFunnelStep,
  undoFunnelStep,
  markFollowupDone,
  type TargetFunnelRow,
} from "@/actions/funnel";
import { generateOutreachBriefForSuggestion } from "@/actions/suggestions";
import { createOutreachDraftForSuggestion, createFollowupDraftForSuggestion } from "@/actions/outreach";
import { FUNNEL_STEPS, funnelStepLabel, type FunnelStepKey } from "@/lib/crm/funnel";
import { Send, Loader2, ArrowUpRight, Sparkles, Mail, Check, RotateCw } from "lucide-react";

// Funnel d'approche des CIBLES d'un mandat d'acquisition : le même moteur que
// le funnel acquéreurs (étapes datées v73, brouillons Gmail, relances, score
// d'intention), lu avec les libellés du rôle target (« Approchée / NDA signé /
// Infos reçues / Offre envoyée »). Une cible « Suivie » atterrit ICI, plus
// dans un trou noir. L'outil PROPOSE (brouillons), Enguérand DISPOSE.

const STEP_FIELDS: Record<FunnelStepKey, keyof TargetFunnelRow> = {
  teaser_envoye: "teaser_sent_at",
  nda_signe: "nda_signed_at",
  im_envoye: "im_sent_at",
  offre_recue: "offer_received_at",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(iso));
}

export function BuyTargetsFunnel({ dealId, refreshKey }: { dealId: string; refreshKey?: number }) {
  const [rows, setRows] = useState<TargetFunnelRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const reload = useCallback(async () => {
    setRows(await getDealTargetFunnel(dealId));
  }, [dealId]);

  useEffect(() => {
    let alive = true;
    getDealTargetFunnel(dealId).then((r) => { if (alive) setRows(r); });
    return () => { alive = false; };
  }, [dealId, refreshKey]);

  async function act(key: string, fn: () => Promise<{ success: boolean; error?: string }>, okMsg?: string) {
    setBusy(key);
    setBanner(null);
    try {
      const res = await fn();
      if (!res.success) setBanner({ kind: "err", text: res.error ?? "Échec." });
      else if (okMsg) setBanner({ kind: "ok", text: okMsg });
      await reload();
    } catch {
      setBanner({ kind: "err", text: "Action échouée (réseau). Réessayez." });
    } finally {
      setBusy(null);
    }
  }

  const box: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 };

  if (rows === null) {
    return (
      <div style={{ ...box, display: "flex", alignItems: "center", gap: 8, color: "var(--text-4)", fontSize: 13 }}>
        <Loader2 size={14} className="animate-spin" /> Chargement du funnel d&apos;approche…
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: rows.length ? 4 : 8 }}>
        <Send size={15} color="#4338CA" />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Approche des cibles suivies</h3>
        {rows.length > 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 700, background: "var(--surface-3)", color: "var(--text-4)", borderRadius: 20, padding: "2px 9px" }}>{rows.length}</span>
        )}
      </div>
      {rows.length > 0 && (
        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--text-5)", lineHeight: 1.5 }}>
          Cliquez une étape quand elle est faite (re-cliquez pour annuler). Les brouillons se déposent dans Gmail : vous relisez et envoyez.
        </p>
      )}

      {banner && (
        <div style={{ marginBottom: 10, padding: "8px 11px", borderRadius: 8, fontSize: 12.5, fontWeight: 500, background: banner.kind === "ok" ? "#D1FAE5" : "#FEE2E2", color: banner.kind === "ok" ? "#065F46" : "#991B1B" }}>
          {banner.text}
        </div>
      )}

      {rows.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-4)", margin: 0, lineHeight: 1.6 }}>
          Aucune cible suivie pour l&apos;instant. Cliquez « Suivre » sur une cible du bloc ci-dessus : elle entre ici, avec son contact dirigeant, ses étapes d&apos;approche et ses relances.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => {
            const relanceDue = r.next_followup_at && r.next_followup_at <= new Date().toISOString().slice(0, 10);
            return (
              <div key={r.id} style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{r.organization_name}</span>
                  {r.intent_score != null && (
                    <span title="Score d'intention (étapes, réactivité, engagement, fraîcheur)" style={{ fontSize: 10.5, fontWeight: 800, color: "#4338CA", background: "rgba(99,102,241,.12)", borderRadius: 6, padding: "2px 7px" }}>
                      intention {Math.round(r.intent_score)}
                    </span>
                  )}
                  {!r.has_contact && (
                    <span title="Aucun contact rattaché : les brouillons Gmail ont besoin d'un destinataire" style={{ fontSize: 10.5, fontWeight: 700, color: "#92400E", background: "#FEF3C7", borderRadius: 6, padding: "2px 7px" }}>
                      sans contact
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  {r.next_followup_at && (
                    <span title="Prochaine relance planifiée" style={{ fontSize: 11, fontWeight: 700, color: relanceDue ? "#991B1B" : "var(--text-4)" }}>
                      relance {fmtDate(r.next_followup_at)}
                    </span>
                  )}
                  {r.organization_siren && (
                    <Link href={`/protected/prospection?fiche=${r.organization_siren}`} title="Fiche 360" style={{ display: "flex" }}>
                      <ArrowUpRight size={13} color="var(--text-5)" />
                    </Link>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {FUNNEL_STEPS.map((step) => {
                    const done = !!r[STEP_FIELDS[step.key]];
                    const label = funnelStepLabel(step.key, "target");
                    const key = `${r.id}:${step.key}`;
                    return (
                      <button key={step.key} type="button" disabled={busy === key}
                        onClick={() => act(key, () => (done ? undoFunnelStep(r.id, step.key) : markFunnelStep(r.id, step.key)))}
                        title={done ? `${label} le ${fmtDate(r[STEP_FIELDS[step.key]] as string)}. Cliquer pour annuler.` : `Marquer : ${label}`}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 16,
                          border: "1px solid " + (done ? "#065F46" : "var(--border)"),
                          background: done ? "#D1FAE5" : "var(--surface)",
                          color: done ? "#065F46" : "var(--text-3)",
                          fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                          opacity: busy === key ? 0.6 : 1,
                        }}>
                        {done && <Check size={11} />}
                        {label}{done && ` ${fmtDate(r[STEP_FIELDS[step.key]] as string)}`}
                      </button>
                    );
                  })}

                  <span style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />

                  {!r.has_brief && (
                    <button type="button" disabled={busy === `${r.id}:brief`}
                      onClick={() => act(`${r.id}:brief`, () => generateOutreachBriefForSuggestion(r.id), "Brief d'approche généré. Créez maintenant le brouillon Gmail.")}
                      title="L'IA rédige l'angle d'approche du dirigeant pour le compte du repreneur (rien n'est envoyé)"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 16, border: "none", background: "#192348", color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: busy === `${r.id}:brief` ? 0.6 : 1 }}>
                      {busy === `${r.id}:brief` ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} Brief IA
                    </button>
                  )}
                  <button type="button" disabled={busy === `${r.id}:draft`}
                    onClick={() => act(`${r.id}:draft`, () => createOutreachDraftForSuggestion(r.id), "Brouillon déposé dans Gmail : relisez et envoyez, puis marquez l'étape.")}
                    title="Dépose un brouillon d'approche initiale dans Gmail (à partir du brief IA)"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-3)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: busy === `${r.id}:draft` ? 0.6 : 1 }}>
                    {busy === `${r.id}:draft` ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />} Brouillon
                  </button>
                  <button type="button" disabled={busy === `${r.id}:relance`}
                    onClick={() => act(`${r.id}:relance`, () => createFollowupDraftForSuggestion(r.id), "Brouillon de relance déposé dans Gmail.")}
                    title="Dépose un brouillon de relance adapté à l'étape courante, accroché au fil d'origine"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-3)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: busy === `${r.id}:relance` ? 0.6 : 1 }}>
                    {busy === `${r.id}:relance` ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />} Relance
                  </button>
                  {relanceDue && (
                    <button type="button" disabled={busy === `${r.id}:done`}
                      onClick={() => act(`${r.id}:done`, () => markFollowupDone(r.id), "Relance tracée, prochaine échéance posée à J+7.")}
                      title="Marque la relance comme faite et repropose une échéance à J+7"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 16, border: "1px solid #065F46", background: "var(--surface)", color: "#065F46", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: busy === `${r.id}:done` ? 0.6 : 1 }}>
                      {busy === `${r.id}:done` ? <Loader2 size={11} className="animate-spin" /> : <RotateCw size={11} />} Relance faite
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
