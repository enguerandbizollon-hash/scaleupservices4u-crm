// Référentiel d'affichage des statuts de l'univers de prospection.
// Partagé entre la liste (prospection-client) et le tiroir de fiche.

export interface StatutMeta {
  label: string;
  bg: string;
  tx: string;
}

// Ordre = ordre des selects et des chips (cycle de vie commercial, promu en
// dernier car non sélectionnable). v72 : echange (discussion en cours) et
// dormant (à recontacter plus tard, réveil automatique à dormant_until).
export const STATUT_META: Record<string, StatutMeta> = {
  nouveau:     { label: "Nouveau",      bg: "#DBEAFE", tx: "#1D4ED8" },
  a_approcher: { label: "À approcher",  bg: "#FEF3C7", tx: "#92400E" },
  approche:    { label: "Approché",     bg: "#EDE9FE", tx: "#5B21B6" },
  echange:     { label: "Échange",      bg: "#FFEDD5", tx: "#C2410C" },
  dormant:     { label: "Dormant",      bg: "#E0F2FE", tx: "#0369A1" },
  ecarte:      { label: "Écarté",       bg: "var(--surface-3)", tx: "var(--text-5)" },
  promu:       { label: "Promu",        bg: "#D1FAE5", tx: "#065F46" },
};

// Libellés des types de signaux affichés dans le tiroir (sous-ensemble
// du flux Signaux, réutilisé pour l'historique BODACC d'un SIREN).
export const SIGNAL_TYPE_LABELS: Record<string, string> = {
  vente_cession: "Vente / cession",
  procedure_collective: "Procédure collective",
  radiation: "Radiation",
  depot_comptes: "Dépôt de comptes",
  entree_screening: "Entrée screening",
  changement_dirigeant: "Changement dirigeant",
  fusion_absorption: "Fusion / TUP",
  location_gerance: "Location-gérance",
  rge_expire: "RGE non renouvelé",
  recrutement_direction: "Recrute un directeur",
};

export const SEVERITY_COLORS: Record<string, string> = {
  alerte: "#DC2626",
  opportunite: "#B45309",
  info: "#64748B",
};
