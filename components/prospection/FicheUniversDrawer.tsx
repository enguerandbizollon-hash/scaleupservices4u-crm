"use client";
// Tiroir de fiche univers : tout ce que la prospection sait d'une cible
// (finances par année, dirigeants, décomposition du radar, signaux BODACC,
// liens sources) et la suite du geste métier : promouvoir, créer le dossier.

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  X, Loader2, Building2, FolderPlus, ExternalLink, Gauge, ArrowUpRight,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  getUniversFicheDetail, createDossierFromUnivers, promoteUniversToOrganization,
  updateUniversStatut, enrichProspect360,
  type UniversFicheDetail, type UniversStatut,
} from "@/actions/prospection";
import { cedabiliteBand } from "@/lib/crm/cedabilite";
import { computeAgeFromBirth } from "@/lib/connectors/recherche-entreprises";
import { STATUT_META, SIGNAL_TYPE_LABELS, SEVERITY_COLORS } from "@/components/prospection/statut-meta";

function fmtAmt(n: number | null | undefined) {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function fmtSiren(s: string) {
  return s.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
}

function fmtDateFr(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("fr-FR");
}

type FicheNav = { siren: string; nom: string; statut: string };

export function FicheUniversDrawer({ siren, nomSeed, statutSeed, onClose, onLocalStatut, prevFiche = null, nextFiche = null, onNavigate }: {
  siren: string;
  nomSeed: string;
  statutSeed: string;
  onClose: () => void;
  onLocalStatut: (siren: string, statut: string) => void;
  /** Voisins dans l'ordre de la liste : revue fiche à fiche sans fermer. */
  prevFiche?: FicheNav | null;
  nextFiche?: FicheNav | null;
  onNavigate?: (fiche: FicheNav) => void;
}) {
  const [detail, setDetail] = useState<UniversFicheDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statut, setStatut] = useState(statutSeed);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Garde synchrone anti double-clic : `pending` ne bascule qu'au rendu
  // suivant, un second clic rapide (à travers deux confirm) passerait sinon.
  const busyRef = useRef(false);

  useEffect(() => {
    let alive = true;
    // Navigation fiche à fiche : on repart d'un tiroir propre.
    setDetail(null);
    setLoadError(null);
    setActionError(null);
    setCreatedNote(null);
    setEnrichError(null);
    setEnrichNote(null);
    setStatut(statutSeed);
    getUniversFicheDetail(siren).then((res) => {
      if (!alive) return;
      if (res.success) {
        setDetail(res.data);
        setStatut(res.data.statut);
      } else {
        setLoadError(res.error);
      }
    });
    return () => { alive = false; };
    // statutSeed volontairement hors dépendances : seul le SIREN déclenche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siren]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      // Flèches : revue fiche à fiche, sauf pendant une saisie.
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "ArrowLeft" && prevFiche && onNavigate) onNavigate(prevFiche);
      if (e.key === "ArrowRight" && nextFiche && onNavigate) onNavigate(nextFiche);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prevFiche, nextFiche, onNavigate]);

  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [enrichNote, setEnrichNote] = useState<string | null>(null);

  async function handleEnrich360() {
    if (enriching) return;
    setEnriching(true);
    setEnrichError(null);
    setEnrichNote(null);
    const res = await enrichProspect360(siren);
    if (res.success) {
      const fresh = await getUniversFicheDetail(siren);
      if (fresh.success) setDetail(fresh.data);
      if (res.data.pappers_note) setEnrichNote(`Pappers : ${res.data.pappers_note}`);
    } else {
      setEnrichError(res.error);
    }
    setEnriching(false);
  }

  function handleStatut(next: UniversStatut) {
    setStatut(next);
    onLocalStatut(siren, next);
    updateUniversStatut(siren, next).then((res) => {
      if (!res.success) setActionError(res.error);
    });
  }

  function handlePromote() {
    if (busyRef.current) return;
    const nom = detail?.nom ?? nomSeed;
    if (!confirm(`Promouvoir « ${nom} » en organisation CRM ?`)) return;
    busyRef.current = true;
    setActionError(null);
    startTransition(async () => {
      const res = await promoteUniversToOrganization(siren);
      busyRef.current = false;
      if (res.success) {
        setStatut("promu");
        onLocalStatut(siren, "promu");
        setDetail((d) => (d ? { ...d, statut: "promu", organization_id: res.data.organization_id } : d));
      } else {
        setActionError(res.error);
      }
    });
  }

  // Fin de l'éjection du flux (cran 2, audit 2026-07-30) : la création du
  // dossier réussit EN PLACE. On reste dans le triage, le lien vers le
  // dossier est là si on le veut, et le brouillon de screening se génère
  // en tâche de fond (la cloche préviendra).
  const [createdNote, setCreatedNote] = useState<string | null>(null);
  function handleCreateDossier() {
    if (busyRef.current) return;
    const nom = detail?.nom ?? nomSeed;
    if (!confirm(`Créer le dossier « Cession ${nom} » (organisation liée, dirigeant prérempli) ?`)) return;
    busyRef.current = true;
    setActionError(null);
    startTransition(async () => {
      const res = await createDossierFromUnivers(siren);
      busyRef.current = false;
      if (res.success) {
        setStatut("promu");
        onLocalStatut(siren, "promu");
        setDetail((d) => (d ? {
          ...d,
          statut: "promu",
          organization_id: res.data.organization_id,
          deal: { id: res.data.deal_id, name: res.data.deal_name },
        } : d));
        setCreatedNote(res.data.created_deal
          ? "Dossier créé. Le brouillon de screening se génère en arrière-plan, la cloche vous préviendra."
          : "Un dossier ouvert existait déjà pour cette organisation : fiche rattachée.");
      } else {
        setActionError(res.error);
      }
    });
  }

  // ── Styles maison ──
  const sectionTitle: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase",
    letterSpacing: ".05em", margin: "18px 0 8px",
  };
  const kvLabel: React.CSSProperties = { fontSize: 11, color: "var(--text-5)" };
  const kvValue: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--text-2)" };
  const extBtn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)",
    fontSize: 11.5, fontWeight: 600, textDecoration: "none",
  };

  const sm = STATUT_META[statut] ?? STATUT_META.nouveau;
  const band = cedabiliteBand(detail?.cedabilite_score ?? null);
  const years = detail ? Object.keys(detail.finances ?? {}).sort().reverse().slice(0, 4) : [];
  const creationYear = detail?.date_creation ? parseInt(String(detail.date_creation).slice(0, 4), 10) : null;
  const anciennete = creationYear && Number.isFinite(creationYear)
    ? new Date().getFullYear() - creationYear
    : null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.4)", zIndex: 60 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 94vw)", zIndex: 61,
        background: "var(--surface)", borderLeft: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)", lineHeight: 1.25 }}>
              {detail?.nom ?? nomSeed}
            </div>
            <div style={{ marginTop: 3, fontSize: 11.5, color: "var(--text-5)" }}>
              SIREN {fmtSiren(siren)}
              {detail?.first_seen_at && ` · dans l'univers depuis le ${fmtDateFr(detail.first_seen_at)}`}
            </div>
          </div>
          <select value={statut} onChange={(e) => handleStatut(e.target.value as UniversStatut)}
            disabled={statut === "promu"}
            style={{ fontSize: 11.5, padding: "3px 7px", borderRadius: 20, border: `1px solid ${sm.bg}`, background: sm.bg, color: sm.tx, cursor: "pointer", fontFamily: "inherit", outline: "none", flexShrink: 0 }}>
            {Object.entries(STATUT_META).map(([v, m]) => (
              <option key={v} value={v} disabled={v === "promu"}>{m.label}</option>
            ))}
          </select>
          {onNavigate && (prevFiche || nextFiche) && (
            <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
              <button onClick={() => prevFiche && onNavigate(prevFiche)} disabled={!prevFiche}
                title="Fiche précédente (flèche gauche)" aria-label="Fiche précédente"
                style={{ all: "unset", cursor: prevFiche ? "pointer" : "default", color: prevFiche ? "var(--text-3)" : "var(--text-6)", display: "flex", padding: 2, opacity: prevFiche ? 1 : 0.35 }}>
                <ChevronLeft size={17} />
              </button>
              <button onClick={() => nextFiche && onNavigate(nextFiche)} disabled={!nextFiche}
                title="Fiche suivante (flèche droite)" aria-label="Fiche suivante"
                style={{ all: "unset", cursor: nextFiche ? "pointer" : "default", color: nextFiche ? "var(--text-3)" : "var(--text-6)", display: "flex", padding: 2, opacity: nextFiche ? 1 : 0.35 }}>
                <ChevronRight size={17} />
              </button>
            </span>
          )}
          <button onClick={onClose} aria-label="Fermer"
            style={{ all: "unset", cursor: "pointer", color: "var(--text-4)", display: "flex", padding: 2 }}>
            <X size={17} />
          </button>
        </div>

        {/* Corps scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 20px" }}>
          {loadError && (
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "#FEF2F2", color: "#991B1B", fontSize: 12.5 }}>
              {loadError}
            </div>
          )}
          {!detail && !loadError && (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Loader2 size={18} className="animate-spin" color="var(--text-4)" />
            </div>
          )}

          {detail && (
            <>
              {/* Fiche 360 : la synthèse M&A d'abord, c'est elle qu'on lit */}
              <div style={sectionTitle}>Synthèse M&amp;A</div>
              {detail.synthese ? (
                <div style={{ padding: "11px 13px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {detail.synthese}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    {detail.synthese_updated_at && (
                      <span style={{ fontSize: 10.5, color: "var(--text-5)" }}>Générée le {fmtDateFr(detail.synthese_updated_at)}</span>
                    )}
                    <button onClick={handleEnrich360} disabled={enriching}
                      style={{ all: "unset", cursor: "pointer", fontSize: 11, color: "var(--text-4)", textDecoration: "underline" }}>
                      {enriching ? "Régénération…" : "Régénérer"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <button onClick={handleEnrich360} disabled={enriching}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "none", background: "#0F766E", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: enriching ? 0.6 : 1 }}>
                    {enriching ? <Loader2 size={12} className="animate-spin" /> : <Gauge size={12} />}
                    {enriching ? "Enrichissement…" : "Générer la fiche 360"}
                  </button>
                  <span style={{ fontSize: 11, color: "var(--text-5)" }}>Recherche web + Pappers + synthèse rédigée, quelques centimes</span>
                </div>
              )}
              {enrichError && (
                <div style={{ fontSize: 12, color: "#991B1B", background: "#FEF2F2", borderRadius: 8, padding: "6px 10px" }}>
                  {enrichError}
                </div>
              )}
              {enrichNote && (
                <div style={{ fontSize: 11.5, color: "#92400E", background: "#FEF3C7", borderRadius: 8, padding: "5px 10px" }}>
                  {enrichNote}
                </div>
              )}

              {/* Radar */}
              <div style={sectionTitle}><Gauge size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />Radar de cédabilité</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <span style={{ fontSize: 24, fontWeight: 800, padding: "4px 13px", borderRadius: 10, background: band.bg, color: band.tx }}>
                  {detail.cedabilite_score ?? "—"}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-2)" }}>{band.label}</div>
                  {(detail.cedabilite_raisons ?? []).length > 0 ? (
                    <ul style={{ margin: "4px 0 0", padding: 0, listStyle: "none", fontSize: 11.5, color: "var(--text-4)", lineHeight: 1.55 }}>
                      {(detail.cedabilite_raisons ?? []).map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  ) : (
                    <div style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 2 }}>
                      Pas encore scorée : le radar se calcule tout seul à la prochaine chasse ou veille.
                    </div>
                  )}
                </div>
              </div>

              {/* Identité */}
              <div style={sectionTitle}>Identité</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }}>
                <div><div style={kvLabel}>Secteur</div><div style={kvValue}>{detail.secteur ?? "—"}</div></div>
                <div><div style={kvLabel}>Code NAF</div><div style={kvValue}>{detail.naf ?? "—"}</div></div>
                <div><div style={kvLabel}>Ville</div><div style={kvValue}>{detail.ville ?? "—"}{detail.departement ? ` (${detail.departement})` : ""}</div></div>
                <div>
                  <div style={kvLabel}>Création</div>
                  <div style={kvValue}>
                    {creationYear ?? "—"}{anciennete != null ? ` · ${anciennete} ans` : ""}
                  </div>
                </div>
                <div><div style={kvLabel}>Effectif</div><div style={kvValue}>{detail.effectif_label ?? "—"}</div></div>
                <div><div style={kvLabel}>Catégorie</div><div style={kvValue}>{detail.categorie ?? "—"}</div></div>
              </div>

              {/* Finances */}
              <div style={sectionTitle}>Finances publiées</div>
              {years.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-5)" }}>Aucun compte publié dans la source.</div>
              ) : (() => {
                const hasEbitda = years.some((y) => detail.finances[y]?.ebitda != null);
                return (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ color: "var(--text-5)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em" }}>
                        <th style={{ textAlign: "left", fontWeight: 700, padding: "2px 0" }}>Année</th>
                        <th style={{ textAlign: "right", fontWeight: 700 }}>CA</th>
                        {hasEbitda && <th style={{ textAlign: "right", fontWeight: 700 }}>EBITDA</th>}
                        <th style={{ textAlign: "right", fontWeight: 700 }}>Résultat net</th>
                        <th style={{ textAlign: "right", fontWeight: 700 }}>Marge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {years.map((y) => {
                        const f = detail.finances[y] ?? {};
                        const ca = f.ca ?? null;
                        const rn = f.resultat_net ?? null;
                        const marge = ca != null && ca > 0 && rn != null ? (rn / ca) * 100 : null;
                        return (
                          <tr key={y} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "5px 0", fontWeight: 700, color: "var(--text-2)" }}>{y}</td>
                            <td style={{ textAlign: "right", color: "var(--text-2)" }}>{ca != null ? `${fmtAmt(ca)} EUR` : "—"}</td>
                            {hasEbitda && (
                              <td style={{ textAlign: "right", fontWeight: 600, color: f.ebitda == null ? "var(--text-5)" : "var(--text-1)" }}>
                                {f.ebitda != null ? fmtAmt(f.ebitda) : "—"}
                              </td>
                            )}
                            <td style={{ textAlign: "right", color: rn == null ? "var(--text-5)" : rn >= 0 ? "#065F46" : "#991B1B" }}>
                              {rn != null ? fmtAmt(rn) : "—"}
                            </td>
                            <td style={{ textAlign: "right", color: "var(--text-4)" }}>
                              {marge != null ? `${marge.toFixed(1)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}

              {/* Actionnariat (Pappers, bénéficiaires effectifs) */}
              <div style={sectionTitle}>Actionnariat</div>
              {detail.actionnariat && detail.actionnariat.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {detail.actionnariat.map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5 }}>
                      <span style={{ fontWeight: 700, color: "var(--text-2)" }}>
                        {[a.prenom, a.nom].filter(Boolean).join(" ")}
                      </span>
                      {a.representant_legal && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "#DBEAFE", color: "#1D4ED8" }}>
                          représentant légal
                        </span>
                      )}
                      {a.age != null && <span style={{ color: "var(--text-5)", fontSize: 11.5 }}>{a.age} ans</span>}
                      <span style={{ marginLeft: "auto", fontWeight: 700, color: "var(--text-1)" }}>
                        {a.pourcentage_parts != null ? `${a.pourcentage_parts}%` : "—"}
                      </span>
                      {a.pourcentage_parts_indirectes != null && a.pourcentage_parts_indirectes > 0 && (
                        <span style={{ fontSize: 10.5, color: "var(--text-5)" }}>
                          dont {a.pourcentage_parts_indirectes}% indirect
                        </span>
                      )}
                    </div>
                  ))}
                  {detail.actionnariat_updated_at && (
                    <div style={{ fontSize: 10.5, color: "var(--text-5)" }}>
                      Source Pappers, {fmtDateFr(detail.actionnariat_updated_at)}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-5)" }}>
                  Répartition du capital et âges : s&apos;alimente avec la fiche 360 (Pappers requis).
                </div>
              )}

              {/* Dirigeants */}
              <div style={sectionTitle}>Dirigeants</div>
              {detail.dirigeants.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-5)" }}>Aucun dirigeant personne physique dans la source.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {detail.dirigeants.map((d, i) => {
                    const age = computeAgeFromBirth(d.date_de_naissance);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5 }}>
                        <span style={{ fontWeight: 700, color: "var(--text-2)" }}>
                          {[d.prenoms, d.nom].filter(Boolean).join(" ") || "—"}
                        </span>
                        {d.qualite && <span style={{ color: "var(--text-4)", fontSize: 11.5 }}>{d.qualite}</span>}
                        {age != null && <span style={{ color: "var(--text-5)", fontSize: 11.5, marginLeft: "auto" }}>{age} ans</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Signaux du SIREN */}
              {detail.signaux.length > 0 && (
                <>
                  <div style={sectionTitle}>Signaux BODACC</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {detail.signaux.map((s) => (
                      <div key={s.id} style={{ display: "flex", alignItems: "baseline", gap: 7, fontSize: 12 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: SEVERITY_COLORS[s.severity] ?? SEVERITY_COLORS.info, flexShrink: 0, alignSelf: "center" }} />
                        <span style={{ fontWeight: 700, color: "var(--text-2)", flexShrink: 0 }}>
                          {SIGNAL_TYPE_LABELS[s.signal_type] ?? s.signal_type}
                        </span>
                        <span style={{ color: "var(--text-5)", fontSize: 11, flexShrink: 0 }}>{fmtDateFr(s.signal_date)}</span>
                        <span style={{ color: "var(--text-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.titre}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Liens sources */}
              <div style={sectionTitle}>Sources externes</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {detail.website && (
                  <a href={detail.website} target="_blank" rel="noreferrer"
                    style={{ ...extBtn, border: "1px solid #0F766E", color: "#0F766E", fontWeight: 700 }}>
                    <ExternalLink size={11} /> Site officiel
                  </a>
                )}
                <a href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}`} target="_blank" rel="noreferrer" style={extBtn}>
                  <ExternalLink size={11} /> Annuaire des entreprises
                </a>
                <a href={`https://www.pappers.fr/entreprise/${siren}`} target="_blank" rel="noreferrer" style={extBtn}>
                  <ExternalLink size={11} /> Pappers
                </a>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(`"${detail.nom}"`)}`} target="_blank" rel="noreferrer" style={extBtn}>
                  <ExternalLink size={11} /> Google
                </a>
              </div>
            </>
          )}
        </div>

        {/* Pied : la suite du geste métier */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          {actionError && (
            <div style={{ width: "100%", fontSize: 12, color: "#991B1B" }}>{actionError}</div>
          )}
          {createdNote && (
            <div style={{ width: "100%", fontSize: 12, color: "#065F46", background: "#ECFDF5", borderRadius: 8, padding: "6px 10px" }}>
              {createdNote}
            </div>
          )}
          {detail?.deal ? (
            <Link href={`/protected/dossiers/${detail.deal.id}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, background: "#0F766E", color: "#fff", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              <FolderPlus size={13} /> Ouvrir le dossier
            </Link>
          ) : (
            <button onClick={handleCreateDossier} disabled={pending || !detail}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: "none", background: "#0F766E", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: pending || !detail ? 0.55 : 1 }}>
              {pending ? <Loader2 size={13} className="animate-spin" /> : <FolderPlus size={13} />}
              Créer le dossier
            </button>
          )}
          {detail?.organization_id ? (
            <Link href={`/protected/organisations/${detail.organization_id}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
              <Building2 size={13} /> Voir l&apos;organisation
            </Link>
          ) : (
            <button onClick={handlePromote} disabled={pending || !detail}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: pending || !detail ? 0.55 : 1 }}>
              <ArrowUpRight size={13} /> Promouvoir seulement
            </button>
          )}
        </div>
      </div>
    </>
  );
}
