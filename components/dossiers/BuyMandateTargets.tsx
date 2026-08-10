"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBuyMandateTargets, promoteTargetToFunnel, runChasseForDeal, getDealChasse, type BuyTarget, type DealChasseInfo } from "@/actions/prospection";
import { Crosshair, Loader2, ArrowUpRight, Plus, Check, Play, Pencil, ListFilter } from "lucide-react";

// Vue Cibles d'un mandat d'acquisition (buy-side v75) : les fiches univers
// trouvées par les chasses rattachées à ce mandat, avec le lancement de la
// chasse SUR PLACE (plus besoin de passer par Prospection). Chaque cible
// pointe vers son tiroir 360 dans Prospection (navigation deux sens). Rendu
// dans l'onglet « sourcing » de la fiche mandat, uniquement pour un deal ma_buy.
export function BuyMandateTargets({ dealId }: { dealId: string }) {
  const [targets, setTargets] = useState<BuyTarget[] | null>(null);
  const [suivies, setSuivies] = useState<Set<string>>(new Set());
  const [promoting, setPromoting] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [chasse, setChasse] = useState<DealChasseInfo | null>(null);

  useEffect(() => {
    let alive = true;
    getBuyMandateTargets(dealId).then((t) => { if (alive) setTargets(t); });
    getDealChasse(dealId).then((c) => { if (alive) setChasse(c); });
    return () => { alive = false; };
  }, [dealId]);

  async function lancerChasse() {
    if (!confirm("Lancer la chasse rattachée ? Les fiches trouvées rejoindront l'univers et apparaîtront ici.")) return;
    setRunning(true);
    setBanner(null);
    const res = await runChasseForDeal(dealId);
    setRunning(false);
    if (!res.success) { setBanner({ kind: "err", text: res.error }); return; }
    const d = res.data;
    setBanner({
      kind: "ok",
      text: `Chasse « ${d.chasse_name} » : ${d.imported.toLocaleString("fr-FR")} fiches dans l'univers${d.truncated ? " (résultat tronqué)" : ""}.`,
    });
    setTargets(await getBuyMandateTargets(dealId));
    setChasse(await getDealChasse(dealId));
  }

  async function suivre(t: BuyTarget) {
    setPromoting(t.siren);
    const res = await promoteTargetToFunnel(dealId, t.siren, t.fit_score);
    setPromoting(null);
    if (res.success) setSuivies((prev) => new Set(prev).add(t.siren));
    else alert(res.error);
  }

  const box: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 };

  if (targets === null) {
    return (
      <div style={{ ...box, display: "flex", alignItems: "center", gap: 8, color: "var(--text-4)", fontSize: 13 }}>
        <Loader2 size={14} className="animate-spin" /> Chargement des cibles…
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: targets.length ? 14 : 8 }}>
        <Crosshair size={15} color="#0F766E" />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Cibles des chasses rattachées</h3>
        {targets.length > 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 700, background: "var(--surface-3)", color: "var(--text-4)", borderRadius: 20, padding: "2px 9px" }}>{targets.length}</span>
        )}
        <button type="button" onClick={lancerChasse} disabled={running}
          title="Lance la chasse rattachée à ce mandat (préparée par la fiche de cadrage)"
          style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto", padding: "6px 13px", borderRadius: 8, border: "none", background: "#0F766E", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: running ? 0.6 : 1 }}>
          {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {running ? "Chasse en cours…" : "Lancer la chasse"}
        </button>
      </div>

      {/* Carte chasse : les critères de la recherche, visibles et modifiables
          sans quitter la fiche (deep-link ?profil= vers le composeur). */}
      {chasse && (
        <div style={{ marginBottom: 12, padding: "10px 13px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-2)" }}>{chasse.name}</span>
            {chasse.last_total_results != null && (
              <span style={{ fontSize: 11.5, color: "var(--text-5)" }}>{chasse.last_total_results.toLocaleString("fr-FR")} cibles au dernier comptage</span>
            )}
            <span style={{ flex: 1 }} />
            <Link href={`/protected/prospection?profil=${chasse.id}`}
              title="Ouvre le composeur de Prospection avec cette chasse chargée : critères modifiables, compteur live"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "#1a56db", textDecoration: "none" }}>
              <Pencil size={11} /> Modifier les critères
            </Link>
            <Link href={`/protected/prospection?chasse=${chasse.id}`}
              title="Voir les fiches de cette chasse dans Prospection (univers restreint à ses résultats)"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "#0F766E", textDecoration: "none" }}>
              <ListFilter size={11} /> Ses fiches dans Prospection
            </Link>
          </div>
          {chasse.resume.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
              {chasse.resume.map((r) => (
                <span key={r} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--surface-3)", color: "var(--text-4)", fontWeight: 600 }}>{r}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {banner && (
        <div style={{ marginBottom: 10, padding: "8px 11px", borderRadius: 8, fontSize: 12.5, fontWeight: 500, background: banner.kind === "ok" ? "#D1FAE5" : "#FEE2E2", color: banner.kind === "ok" ? "#065F46" : "#991B1B" }}>
          {banner.text}
        </div>
      )}

      {targets.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-4)", margin: 0, lineHeight: 1.6 }}>
          Aucune cible pour l&apos;instant. Analysez la fiche de cadrage ci-dessus (elle prépare la chasse), puis cliquez « Lancer la chasse » : les résultats apparaîtront ici, les mieux alignés à la fiche d&apos;abord. Les chasses se rattachent et s&apos;affinent aussi depuis <Link href="/protected/prospection" style={{ color: "#1a56db", fontWeight: 600 }}>Prospection</Link>.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {targets.map((t) => {
            const suivie = suivies.has(t.siren);
            return (
              <div key={t.siren} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nom}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {[t.secteur, t.ville, t.chasse_name && `via ${t.chasse_name}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {t.fit_score != null && (
                  <span title="Fit à la fiche de cadrage (secteur, taille, géographie)" style={{ fontSize: 11, fontWeight: 800, color: "#4338CA", background: "rgba(99,102,241,.12)", borderRadius: 6, padding: "3px 8px", flexShrink: 0 }}>
                    fit {t.fit_score}
                  </span>
                )}
                {t.cedabilite_score != null && (
                  <span title="Score de cédabilité (radar)" style={{ fontSize: 11, fontWeight: 800, color: "#0F766E", background: "rgba(15,118,110,.12)", borderRadius: 6, padding: "3px 8px", flexShrink: 0 }}>
                    radar {Math.round(t.cedabilite_score)}
                  </span>
                )}
                <button type="button" onClick={() => suivre(t)} disabled={suivie || promoting === t.siren}
                  title={suivie ? "Cible suivie dans le funnel" : "Suivre cette cible (entre dans le funnel d'approche)"}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid " + (suivie ? "#065F46" : "var(--border)"), background: suivie ? "#D1FAE5" : "var(--surface)", color: suivie ? "#065F46" : "var(--text-3)", fontSize: 11.5, fontWeight: 700, cursor: suivie ? "default" : "pointer", fontFamily: "inherit", flexShrink: 0, opacity: promoting === t.siren ? 0.6 : 1 }}>
                  {promoting === t.siren ? <Loader2 size={12} className="animate-spin" /> : suivie ? <Check size={12} /> : <Plus size={12} />}
                  {suivie ? "Suivie" : "Suivre"}
                </button>
                <Link href={`/protected/prospection?fiche=${t.siren}`} title="Fiche 360" style={{ flexShrink: 0, display: "flex" }}>
                  <ArrowUpRight size={14} color="var(--text-5)" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
