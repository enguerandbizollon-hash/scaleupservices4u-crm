"use client";
// Prospection marché (phase 2, temps 2) : composeur de chasses avec compteur
// live, profils sauvegardés, et univers de veille triable.
// Les filtres UI se traduisent en ScreeningFilters API ; la forme UI est
// conservée dans filters._ui pour recharger un profil à l'identique.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Crosshair, Play, Save, Trash2, ArrowUpRight, Building2,
  ChevronLeft, ChevronRight, Loader2, AlertTriangle,
} from "lucide-react";
import {
  countScreeningAction, saveScreeningProfile, deleteScreeningProfile,
  runScreeningIngest, updateUniversStatut, promoteUniversToOrganization,
  type UniversStatut,
} from "@/actions/prospection";
import type { ScreeningFilters } from "@/lib/connectors/recherche-entreprises";
import { NAF_DIVISION_TO_SECTOR } from "@/lib/crm/matching-maps";
import { nafCodesForDivisions } from "@/lib/crm/naf-codes";

// ── Types partagés avec la page serveur ──────────────────────────────────────

export type UniversRow = {
  siren: string;
  nom: string;
  naf: string | null;
  secteur: string | null;
  departement: string | null;
  ville: string | null;
  date_creation: string | null;
  effectif_label: string | null;
  categorie: string | null;
  finances: Record<string, { ca?: number | null; resultat_net?: number | null }>;
  age_dirigeant_principal: number | null;
  statut: string;
  organization_id: string | null;
  last_seen_at: string;
};

type UiState = {
  secteurs: string[];
  nafExtra: string;
  caMin: string;
  caMax: string;
  ageMin: string;
  ageMax: string;
  rentables: boolean;
  departements: string;
  effectifs: string[];
  categorie: string;
  actives: boolean;
};

export type ProfileRow = {
  id: string;
  name: string;
  filters: ScreeningFilters & { _ui?: UiState };
  last_run_at: string | null;
  last_total_results: number | null;
  watch_enabled: boolean;
};

// ── Constantes UI ────────────────────────────────────────────────────────────

const EFFECTIF_OPTIONS = [
  { code: "03", label: "6-9" },
  { code: "11", label: "10-19" },
  { code: "12", label: "20-49" },
  { code: "21", label: "50-99" },
  { code: "22", label: "100-199" },
  { code: "31", label: "200-249" },
  { code: "32", label: "250-499" },
];

const STATUT_META: Record<string, { label: string; bg: string; tx: string }> = {
  nouveau:     { label: "Nouveau",      bg: "#DBEAFE", tx: "#1D4ED8" },
  a_approcher: { label: "À approcher",  bg: "#FEF3C7", tx: "#92400E" },
  approche:    { label: "Approché",     bg: "#EDE9FE", tx: "#5B21B6" },
  ecarte:      { label: "Écarté",       bg: "var(--surface-3)", tx: "var(--text-5)" },
  promu:       { label: "Promu",        bg: "#D1FAE5", tx: "#065F46" },
};

const EMPTY_UI: UiState = {
  secteurs: [], nafExtra: "", caMin: "", caMax: "", ageMin: "", ageMax: "",
  rentables: false, departements: "", effectifs: [], categorie: "", actives: true,
};

function fmtAmt(n: number | null | undefined) {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function latestFinance(finances: UniversRow["finances"]): { year: string; ca: number | null; rn: number | null } | null {
  const years = Object.keys(finances ?? {}).sort().reverse();
  if (years.length === 0) return null;
  const y = years[0];
  return { year: y, ca: finances[y]?.ca ?? null, rn: finances[y]?.resultat_net ?? null };
}

/** Traduit l'état UI en filtres API (fonction du composeur). */
function toApiFilters(ui: UiState): ScreeningFilters {
  const divisions = Object.entries(NAF_DIVISION_TO_SECTOR)
    .filter(([, sector]) => ui.secteurs.includes(sector))
    .map(([div]) => div);
  const naf = [
    ...nafCodesForDivisions(divisions),
    ...ui.nafExtra.split(",").map(s => s.trim()).filter(s => /^\d{2}\.\d{2}[A-Z]$/.test(s)),
  ];
  const departements = ui.departements.split(",").map(s => s.trim()).filter(Boolean);
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  return {
    naf: [...new Set(naf)],
    ca_min: num(ui.caMin),
    ca_max: num(ui.caMax),
    resultat_net_min: ui.rentables ? 0 : null,
    age_dirigeant_min: num(ui.ageMin),
    age_dirigeant_max: num(ui.ageMax),
    departements,
    effectif_tranches: ui.effectifs,
    categorie: ui.categorie || null,
    actives_seulement: ui.actives,
  };
}

// ── Composant ────────────────────────────────────────────────────────────────

export function ProspectionClient({ profiles, univers, universTotal, statCounts, activeStatut, page, pageSize }: {
  profiles: ProfileRow[];
  univers: UniversRow[];
  universTotal: number;
  statCounts: Record<string, number>;
  activeStatut: string | null;
  page: number;
  pageSize: number;
}) {
  const [ui, setUi] = useState<UiState>(EMPTY_UI);
  const [profileName, setProfileName] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const [total, setTotal] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [running, setRunning] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Statuts optimistes de l'univers (le serveur revalide derrière).
  const [localStatuts, setLocalStatuts] = useState<Record<string, string>>({});

  const secteursDisponibles = useMemo(
    () => [...new Set(Object.values(NAF_DIVISION_TO_SECTOR))].sort((a, b) => a.localeCompare(b, "fr")),
    [],
  );

  const apiFilters = useMemo(() => toApiFilters(ui), [ui]);
  const hasCriteria = (apiFilters.naf?.length ?? 0) > 0 || apiFilters.ca_min != null || apiFilters.ca_max != null
    || apiFilters.age_dirigeant_min != null || apiFilters.age_dirigeant_max != null
    || (apiFilters.departements?.length ?? 0) > 0 || (apiFilters.effectif_tranches?.length ?? 0) > 0
    || !!apiFilters.categorie;

  // Compteur live, débouncé.
  const countSeq = useRef(0);
  useEffect(() => {
    if (!hasCriteria) { setTotal(null); return; }
    const seq = ++countSeq.current;
    setCounting(true);
    const t = setTimeout(async () => {
      const res = await countScreeningAction(apiFilters);
      if (countSeq.current !== seq) return; // réponse obsolète
      setCounting(false);
      setTotal(res.success ? res.data.total : null);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(apiFilters)]);

  function loadProfile(p: ProfileRow) {
    setSelectedProfileId(p.id);
    setProfileName(p.name);
    if (p.filters._ui) {
      setUi({ ...EMPTY_UI, ...p.filters._ui });
    } else {
      // Profil sans état UI (créé hors composeur) : reconstruction best-effort.
      setUi({
        ...EMPTY_UI,
        nafExtra: (p.filters.naf ?? []).join(","),
        caMin: p.filters.ca_min != null ? String(p.filters.ca_min) : "",
        caMax: p.filters.ca_max != null ? String(p.filters.ca_max) : "",
        ageMin: p.filters.age_dirigeant_min != null ? String(p.filters.age_dirigeant_min) : "",
        ageMax: p.filters.age_dirigeant_max != null ? String(p.filters.age_dirigeant_max) : "",
        rentables: p.filters.resultat_net_min != null,
        departements: (p.filters.departements ?? []).join(","),
        effectifs: p.filters.effectif_tranches ?? [],
        categorie: p.filters.categorie ?? "",
        actives: p.filters.actives_seulement !== false,
      });
    }
  }

  async function handleSaveProfile() {
    const res = await saveScreeningProfile({
      id: selectedProfileId,
      name: profileName,
      filters: { ...apiFilters, _ui: ui } as ScreeningFilters,
    });
    setBanner(res.success
      ? { kind: "ok", text: `Profil « ${profileName} » enregistré.` }
      : { kind: "err", text: res.error });
    if (res.success) setSelectedProfileId(res.data.id);
  }

  async function handleDeleteProfile(id: string) {
    if (!confirm("Supprimer ce profil de chasse ?")) return;
    await deleteScreeningProfile(id);
    if (selectedProfileId === id) { setSelectedProfileId(null); setProfileName(""); }
  }

  async function handleRun() {
    if (total != null && total > 10_000) {
      setBanner({ kind: "err", text: "Plus de 10 000 cibles : affinez les filtres avant de lancer." });
      return;
    }
    if (!confirm(`Lancer la chasse${total != null ? ` (~${total.toLocaleString("fr-FR")} cibles)` : ""} ? Les fiches rejoindront l'univers.`)) return;
    setRunning(true);
    setBanner(null);
    const res = await runScreeningIngest({ profileId: selectedProfileId, filters: apiFilters });
    setRunning(false);
    if (res.success) {
      const d = res.data;
      setBanner({
        kind: "ok",
        text: `${d.imported.toLocaleString("fr-FR")} fiches dans l'univers (${d.queries} requêtes${d.filtered_out > 0 ? `, ${d.filtered_out} écartées par le post-filtre dirigeant` : ""}${d.truncated ? ", résultat tronqué" : ""}).`,
      });
    } else {
      setBanner({ kind: "err", text: res.error });
    }
  }

  async function handleStatut(siren: string, statut: UniversStatut) {
    setLocalStatuts(prev => ({ ...prev, [siren]: statut }));
    const res = await updateUniversStatut(siren, statut);
    if (!res.success) setBanner({ kind: "err", text: res.error });
  }

  async function handlePromote(siren: string, nom: string) {
    if (!confirm(`Promouvoir « ${nom} » en organisation CRM ?`)) return;
    const res = await promoteUniversToOrganization(siren);
    setBanner(res.success
      ? { kind: "ok", text: `« ${nom} » ${res.data.created ? "créée dans" : "rattachée à"} vos organisations.` }
      : { kind: "err", text: res.error });
    if (res.success) setLocalStatuts(prev => ({ ...prev, [siren]: "promu" }));
  }

  // ── Styles ──
  const inp: React.CSSProperties = {
    width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8,
    fontSize: 12.5, fontFamily: "inherit", outline: "none", background: "var(--surface-2)",
    color: "var(--text-1)", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase",
    letterSpacing: ".05em", display: "block", marginBottom: 4,
  };
  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 12,
  };
  const toggleChip = (active: boolean): React.CSSProperties => ({
    padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
    border: "1px solid var(--border)", fontFamily: "inherit",
    background: active ? "var(--text-1)" : "var(--surface-2)",
    color: active ? "var(--bg)" : "var(--text-3)",
  });

  const statutHref = (s: string | null) => `/protected/prospection${s ? `?statut=${s}` : ""}`;
  const totalPages = Math.max(1, Math.ceil(universTotal / pageSize));

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 9 }}>
          <Crosshair size={20} color="#0F766E" /> Prospection
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-4)" }}>
          Composez vos chasses, l&apos;univers se remplit, dédupliqué par SIREN. Source : API Recherche d&apos;Entreprises (gratuite).
        </p>

        {banner && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13,
            background: banner.kind === "ok" ? "#ECFDF5" : "#FEF2F2",
            color: banner.kind === "ok" ? "#065F46" : "#991B1B",
          }}>
            {banner.text}
          </div>
        )}

        {/* ── Profils sauvegardés ── */}
        {profiles.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            {profiles.map(p => (
              <span key={p.id} style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 6px 5px 12px",
                borderRadius: 20, fontSize: 12.5, fontWeight: 600, border: "1px solid var(--border)",
                background: selectedProfileId === p.id ? "var(--text-1)" : "var(--surface)",
                color: selectedProfileId === p.id ? "var(--bg)" : "var(--text-2)",
              }}>
                <button onClick={() => loadProfile(p)} style={{ all: "unset", cursor: "pointer" }}>
                  {p.name}
                  {p.last_total_results != null && (
                    <span style={{ opacity: 0.6, marginLeft: 5 }}>{p.last_total_results.toLocaleString("fr-FR")}</span>
                  )}
                </button>
                <button onClick={() => handleDeleteProfile(p.id)} title="Supprimer"
                  style={{ all: "unset", cursor: "pointer", display: "flex", opacity: 0.55 }}>
                  <Trash2 size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* ── Composeur ── */}
        <div style={{ ...card, padding: "16px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            {/* Secteurs */}
            <div>
              <label style={lbl}>Secteurs (taxonomie maison → codes NAF)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {secteursDisponibles.map(s => (
                  <button key={s} type="button" style={toggleChip(ui.secteurs.includes(s))}
                    onClick={() => setUi(p => ({
                      ...p,
                      secteurs: p.secteurs.includes(s) ? p.secteurs.filter(x => x !== s) : [...p.secteurs, s],
                    }))}>
                    {s}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={lbl}>Codes NAF précis (optionnel, ex : 43.21A, 43.22A)</label>
                <input style={inp} value={ui.nafExtra} placeholder="43.21A, 43.22A"
                  onChange={e => setUi(p => ({ ...p, nafExtra: e.target.value }))} />
              </div>
            </div>

            {/* Critères chiffrés */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignContent: "start" }}>
              <div>
                <label style={lbl}>CA min (EUR)</label>
                <input style={inp} type="number" placeholder="2000000" value={ui.caMin}
                  onChange={e => setUi(p => ({ ...p, caMin: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>CA max (EUR)</label>
                <input style={inp} type="number" placeholder="20000000" value={ui.caMax}
                  onChange={e => setUi(p => ({ ...p, caMax: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Âge dirigeant min</label>
                <input style={inp} type="number" placeholder="58" value={ui.ageMin}
                  onChange={e => setUi(p => ({ ...p, ageMin: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Âge dirigeant max</label>
                <input style={inp} type="number" placeholder="75" value={ui.ageMax}
                  onChange={e => setUi(p => ({ ...p, ageMax: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Départements (ex : 69, 38, 01 — vide = France)</label>
                <input style={inp} value={ui.departements} placeholder="69, 38, 01"
                  onChange={e => setUi(p => ({ ...p, departements: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Effectifs + options */}
          <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ ...lbl, marginBottom: 0 }}>Effectif</span>
              {EFFECTIF_OPTIONS.map(o => (
                <button key={o.code} type="button" style={toggleChip(ui.effectifs.includes(o.code))}
                  onClick={() => setUi(p => ({
                    ...p,
                    effectifs: p.effectifs.includes(o.code) ? p.effectifs.filter(x => x !== o.code) : [...p.effectifs, o.code],
                  }))}>
                  {o.label}
                </button>
              ))}
            </div>
            <select value={ui.categorie} onChange={e => setUi(p => ({ ...p, categorie: e.target.value }))}
              style={{ ...inp, width: "auto" }}>
              <option value="">Toute catégorie</option>
              <option value="PME">PME</option>
              <option value="ETI">ETI</option>
            </select>
            <button type="button" style={toggleChip(ui.rentables)}
              onClick={() => setUi(p => ({ ...p, rentables: !p.rentables }))}>
              Rentables uniquement
            </button>
            <button type="button" style={toggleChip(ui.actives)}
              onClick={() => setUi(p => ({ ...p, actives: !p.actives }))}
              title="Exclut les entreprises cessées">
              Actives uniquement
            </button>
          </div>

          {/* Compteur + actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", minWidth: 170, display: "flex", alignItems: "center", gap: 7 }}>
              {counting ? <Loader2 size={14} className="animate-spin" color="var(--text-4)" /> : null}
              {!hasCriteria ? (
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-5)" }}>Ajoutez des critères…</span>
              ) : total == null ? (
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-5)" }}>Comptage…</span>
              ) : (
                <>
                  <span style={{ color: total > 10_000 ? "#991B1B" : "#065F46" }}>
                    {total >= 10_000 ? "≥ 10 000" : total.toLocaleString("fr-FR")}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-4)" }}>cibles</span>
                  {total > 10_000 && <AlertTriangle size={13} color="#991B1B" />}
                </>
              )}
            </div>

            <input style={{ ...inp, width: 220 }} placeholder="Nom du profil (ex : BTP AURA cédants)"
              value={profileName} onChange={e => setProfileName(e.target.value)} />
            <button onClick={handleSaveProfile} disabled={!profileName.trim()}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: profileName.trim() ? 1 : 0.5 }}>
              <Save size={13} /> {selectedProfileId ? "Mettre à jour" : "Sauvegarder"}
            </button>
            <button onClick={handleRun} disabled={running || !hasCriteria || (total != null && total > 10_000)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 9, border: "none", background: "#0F766E", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: running || !hasCriteria || (total != null && total > 10_000) ? 0.55 : 1 }}>
              {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              {running ? "Chasse en cours…" : "Lancer la chasse"}
            </button>
            {selectedProfileId && (
              <button onClick={() => { setSelectedProfileId(null); setProfileName(""); setUi(EMPTY_UI); }}
                style={{ all: "unset", cursor: "pointer", fontSize: 12, color: "var(--text-5)" }}>
                Nouveau profil
              </button>
            )}
          </div>
        </div>

        {/* ── Univers ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Link href={statutHref(null)} style={toggleChip(activeStatut === null)}>
            Tout l&apos;univers ({universTotal.toLocaleString("fr-FR")})
          </Link>
          {Object.entries(STATUT_META).map(([key, meta]) => (
            <Link key={key} href={statutHref(key)} style={toggleChip(activeStatut === key)}>
              {meta.label} ({(statCounts[key] ?? 0).toLocaleString("fr-FR")})
            </Link>
          ))}
        </div>

        <div style={{ ...card, overflow: "hidden", marginBottom: 8 }}>
          {univers.length === 0 ? (
            <div style={{ padding: "44px 24px", textAlign: "center", color: "var(--text-5)", fontSize: 13 }}>
              L&apos;univers est vide{activeStatut ? " pour ce statut" : ""}.
              <div style={{ marginTop: 6, fontSize: 12 }}>Composez une chasse ci-dessus et lancez-la.</div>
            </div>
          ) : univers.map((u, i) => {
            const statut = localStatuts[u.siren] ?? u.statut;
            const sm = STATUT_META[statut] ?? STATUT_META.nouveau;
            const fin = latestFinance(u.finances);
            return (
              <div key={u.siren} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 16px",
                borderBottom: i < univers.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.nom}
                  </div>
                  <div style={{ display: "flex", gap: 9, marginTop: 2, fontSize: 11.5, color: "var(--text-5)", flexWrap: "wrap" }}>
                    {u.secteur && <span>{u.secteur}</span>}
                    {u.ville && <span>{u.ville}{u.departement ? ` (${u.departement})` : ""}</span>}
                    {u.effectif_label && <span>{u.effectif_label}</span>}
                    <span>SIREN {u.siren}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, minWidth: 90 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>
                    {fin?.ca != null ? `${fmtAmt(fin.ca)} EUR` : "—"}
                  </div>
                  <div style={{ fontSize: 10.5, color: fin?.rn != null ? (fin.rn >= 0 ? "#065F46" : "#991B1B") : "var(--text-5)" }}>
                    {fin ? `CA ${fin.year}${fin.rn != null ? ` · RN ${fmtAmt(fin.rn)}` : ""}` : "finances n.d."}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", flexShrink: 0, minWidth: 58, textAlign: "center" }}>
                  {u.age_dirigeant_principal != null ? `${u.age_dirigeant_principal} ans` : "—"}
                </div>
                <select value={statut} onChange={e => handleStatut(u.siren, e.target.value as UniversStatut)}
                  disabled={statut === "promu"}
                  style={{ fontSize: 11.5, padding: "3px 7px", borderRadius: 20, border: `1px solid ${sm.bg}`, background: sm.bg, color: sm.tx, cursor: "pointer", fontFamily: "inherit", outline: "none", flexShrink: 0 }}>
                  {Object.entries(STATUT_META).map(([v, m]) => (
                    <option key={v} value={v} disabled={v === "promu"}>{m.label}</option>
                  ))}
                </select>
                {statut === "promu" && u.organization_id ? (
                  <Link href={`/protected/organisations/${u.organization_id}`} title="Voir l'organisation"
                    style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "#065F46", flexShrink: 0 }}>
                    <Building2 size={12} />
                  </Link>
                ) : (
                  <button onClick={() => handlePromote(u.siren, u.nom)} title="Promouvoir en organisation CRM"
                    style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-4)", flexShrink: 0 }}>
                    <ArrowUpRight size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", fontSize: 12.5, color: "var(--text-4)" }}>
            {page > 1 && (
              <Link href={`/protected/prospection?${new URLSearchParams({ ...(activeStatut ? { statut: activeStatut } : {}), page: String(page - 1) })}`}
                style={{ display: "flex", alignItems: "center", color: "var(--text-3)" }}>
                <ChevronLeft size={14} />
              </Link>
            )}
            <span>page {page} / {totalPages}</span>
            {page < totalPages && (
              <Link href={`/protected/prospection?${new URLSearchParams({ ...(activeStatut ? { statut: activeStatut } : {}), page: String(page + 1) })}`}
                style={{ display: "flex", alignItems: "center", color: "var(--text-3)" }}>
                <ChevronRight size={14} />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
