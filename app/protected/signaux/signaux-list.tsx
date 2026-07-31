"use client";
// Liste du flux de signaux. Filtres par liens (état dans l'URL, données
// toujours exactes côté serveur), actions marquer lu / tout marquer lu.

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, CheckCheck, ExternalLink, Building2, Radar } from "lucide-react";
import { markSignalRead, markAllSignalsRead } from "@/actions/signaux";

export type SignalRow = {
  id: string;
  siren: string;
  signal_type: string;
  signal_date: string;
  titre: string;
  severity: string;
  read_at: string | null;
  organization_id: string | null;
  organization_name: string | null;
  /** Le SIREN a une fiche univers : le signal mène au tiroir 360. */
  in_univers: boolean;
  ville: string | null;
  departement: string | null;
  url: string | null;
};

const TYPE_META: Record<string, { label: string; bg: string; tx: string }> = {
  vente_cession:        { label: "Cession",              bg: "#FFF7ED", tx: "#C2410C" },
  procedure_collective: { label: "Procédure collective", bg: "#FEE2E2", tx: "#991B1B" },
  radiation:            { label: "Radiation",            bg: "var(--surface-3)", tx: "var(--text-4)" },
  depot_comptes:        { label: "Dépôt de comptes",     bg: "#DBEAFE", tx: "#1D4ED8" },
  entree_screening:     { label: "Nouvelle cible",       bg: "#D1FAE5", tx: "#065F46" },
  fusion_absorption:    { label: "Fusion / TUP",         bg: "#FFF7ED", tx: "#C2410C" },
  location_gerance:     { label: "Location-gérance",     bg: "#FEF3C7", tx: "#92400E" },
  changement_dirigeant: { label: "Chgt direction",       bg: "#EDE9FE", tx: "#5B21B6" },
  rge_expire:           { label: "RGE non renouvelé",    bg: "#FEF3C7", tx: "#92400E" },
};

const SEVERITY_DOT: Record<string, string> = {
  alerte: "#DC2626",
  opportunite: "#D97706",
  info: "var(--text-5)",
};

const FILTERS: { value: string | null; label: string }[] = [
  { value: null,                    label: "Tous" },
  { value: "entree_screening",      label: "Nouvelles cibles" },
  { value: "vente_cession",         label: "Cessions" },
  { value: "location_gerance",      label: "Locations-gérances" },
  { value: "fusion_absorption",     label: "Fusions / TUP" },
  { value: "rge_expire",            label: "RGE non renouvelés" },
  { value: "changement_dirigeant",  label: "Chgts direction" },
  { value: "procedure_collective",  label: "Procédures collectives" },
  { value: "radiation",             label: "Radiations" },
  { value: "depot_comptes",         label: "Dépôts de comptes" },
];

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

function filterHref(type: string | null, unreadOnly: boolean): string {
  const p = new URLSearchParams();
  if (type) p.set("type", type);
  if (unreadOnly) p.set("nonlus", "1");
  const qs = p.toString();
  return `/protected/signaux${qs ? `?${qs}` : ""}`;
}

export function SignauxList({ signaux, unreadCount, activeType, unreadOnly }: {
  signaux: SignalRow[];
  unreadCount: number;
  activeType: string | null;
  unreadOnly: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  // Masquage optimiste des lignes marquées lues (le serveur revalide derrière).
  const [locallyRead, setLocallyRead] = useState<Set<string>>(new Set());

  const handleRead = (id: string) => {
    setLocallyRead(prev => new Set(prev).add(id));
    startTransition(() => { markSignalRead(id); });
  };

  const handleAllRead = () => {
    setLocallyRead(new Set(signaux.map(s => s.id)));
    startTransition(() => { markAllSignalsRead(); });
  };

  const chip = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 600,
    textDecoration: "none", border: "1px solid var(--border)",
    background: active ? "var(--text-1)" : "var(--surface)",
    color: active ? "var(--bg)" : "var(--text-3)",
  });

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 9 }}>
              <Radar size={20} color="#B45309" /> Signaux
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--text-4)" }}>
              Veille marché quotidienne (BODACC), pivot SIREN.
              {unreadCount > 0 ? ` ${unreadCount} non lu${unreadCount > 1 ? "s" : ""}.` : " Tout est lu."}
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={handleAllRead} disabled={isPending}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-3)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: isPending ? 0.6 : 1 }}>
              <CheckCheck size={13} /> Tout marquer lu
            </button>
          )}
        </div>

        {/* Filtres */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          {FILTERS.map(f => (
            <Link key={f.label} href={filterHref(f.value, unreadOnly)} style={chip(activeType === f.value)}>
              {f.label}
            </Link>
          ))}
          <span style={{ width: 1, height: 18, background: "var(--border)", margin: "0 2px" }} />
          <Link href={filterHref(activeType, !unreadOnly)} style={chip(unreadOnly)}>
            Non lus
          </Link>
        </div>

        {/* Liste */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          {signaux.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-5)", fontSize: 13 }}>
              Aucun signal{unreadOnly ? " non lu" : ""} pour ce filtre.
              <div style={{ marginTop: 6, fontSize: 12 }}>
                Le flux se remplit chaque matin via le cron BODACC.
              </div>
            </div>
          ) : signaux.map((s, i) => {
            const meta = TYPE_META[s.signal_type] ?? { label: s.signal_type, bg: "var(--surface-3)", tx: "var(--text-4)" };
            const isRead = !!s.read_at || locallyRead.has(s.id);
            return (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                borderBottom: i < signaux.length - 1 ? "1px solid var(--border)" : "none",
                opacity: isRead ? 0.55 : 1,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: SEVERITY_DOT[s.severity] ?? SEVERITY_DOT.info, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: meta.bg, color: meta.tx, flexShrink: 0, whiteSpace: "nowrap" }}>
                  {meta.label}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {s.in_univers ? (
                    <Link href={`/protected/prospection?fiche=${s.siren}`}
                      title="Ouvrir la fiche 360 dans la prospection"
                      style={{ display: "block", fontSize: 13.5, fontWeight: isRead ? 500 : 700, color: "#0F766E", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.titre}
                    </Link>
                  ) : (
                    <div style={{ fontSize: 13.5, fontWeight: isRead ? 500 : 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.titre}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: 2, fontSize: 11.5, color: "var(--text-5)", flexWrap: "wrap" }}>
                    <span>{fmtDate(s.signal_date)}</span>
                    <span>SIREN {s.siren}</span>
                    {s.departement && <span>Dépt {s.departement}</span>}
                    {s.in_univers && (
                      <Link href={`/protected/prospection?fiche=${s.siren}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#0F766E", textDecoration: "none", fontWeight: 700 }}>
                        360°
                      </Link>
                    )}
                    {s.organization_id && s.organization_name && (
                      <Link href={`/protected/organisations/${s.organization_id}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#065F46", textDecoration: "none", fontWeight: 600 }}>
                        <Building2 size={10} /> {s.organization_name}
                      </Link>
                    )}
                  </div>
                </div>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" title="Voir l'annonce BODACC"
                    style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-4)", flexShrink: 0 }}>
                    <ExternalLink size={11} />
                  </a>
                )}
                {!isRead && (
                  <button onClick={() => handleRead(s.id)} title="Marquer lu"
                    style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-4)", flexShrink: 0 }}>
                    <Check size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {signaux.length === 200 && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-5)", textAlign: "center" }}>
            Affichage limité aux 200 signaux les plus récents. Affinez avec les filtres.
          </div>
        )}
      </div>
    </div>
  );
}
