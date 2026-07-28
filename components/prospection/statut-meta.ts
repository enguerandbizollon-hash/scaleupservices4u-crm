// Référentiel d'affichage des statuts de l'univers de prospection.
// Partagé entre la liste (prospection-client) et le tiroir de fiche.

export interface StatutMeta {
  label: string;
  bg: string;
  tx: string;
}

export const STATUT_META: Record<string, StatutMeta> = {
  nouveau:     { label: "Nouveau",      bg: "#DBEAFE", tx: "#1D4ED8" },
  a_approcher: { label: "À approcher",  bg: "#FEF3C7", tx: "#92400E" },
  approche:    { label: "Approché",     bg: "#EDE9FE", tx: "#5B21B6" },
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
};

export const SEVERITY_COLORS: Record<string, string> = {
  alerte: "#DC2626",
  opportunite: "#B45309",
  info: "#64748B",
};
