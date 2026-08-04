export const dealTypeLabels: Record<string, string> = {
  ma_sell: "Cession",
  ma_buy: "Acquisition",
};

export const dealStatusLabels: Record<string, string> = {
  open:   "En cours",
  paused: "En pause",
  won:    "Gagné",
  lost:   "Perdu",
};

export const dealStageLabels: Record<string, string> = {
  kickoff: "Kickoff",
  preparation: "Préparation",
  outreach: "Outreach",
  management_meetings: "Management meetings",
  dd: "Due diligence",
  negotiation: "Négociation",
  closing: "Closing",
  post_closing: "Post-closing",
  ongoing_support: "Suivi en cours",
  search: "Recherche",
};

// Types d'organisation : SOURCE UNIQUE des libellés (sweep vocabulaire
// 2026-07-31, pivot M&A small cap). Les valeurs stockées en base ne bougent
// jamais, seul l'affichage. Un seul mot pour l'acheteur : « Acquéreur ».
// Familles acquéreurs scorées par le matching (ACQUIRER_BUYER_TYPES) :
// buyer, corporate, investor, business_angel, family_office.
export const organizationTypeLabels: Record<string, string> = {
  client: "Client",
  prospect_client: "Prospect",
  target: "Cible",
  buyer: "Acquéreur",
  corporate: "Corporate",
  investor: "Fonds",
  business_angel: "Repreneur individuel",
  family_office: "Family Office",
  bank: "Banque",
  advisor: "Conseil",
  law_firm: "Cabinet juridique",
  accounting_firm: "Expert-comptable",
  consulting_firm: "Cabinet de conseil",
  other: "Autre",
  // Valeurs historiques encore possibles en base
  prospect: "Prospect",
  third_party: "Tiers",
};

// Types qui portent un PROFIL ENTREPRISE (secteur, effectif, ancienneté,
// tranche de CA). SOURCE UNIQUE : le formulaire écrit ces colonnes et la
// fiche les affiche pour exactement la même liste. Deux listes divergentes
// faisaient disparaître de la fiche des données pourtant enregistrées
// (revue adversariale 2026-08-01). Les valeurs historiques 'prospect' et
// 'third_party' y figurent : sans elles, leur save remettait tout à null.
export const COMPANY_PROFILE_TYPES: string[] = [
  "client", "prospect_client", "target",
  "buyer", "corporate", "investor", "business_angel", "family_office",
  "bank", "advisor", "law_firm", "accounting_firm", "consulting_firm",
  "other", "prospect", "third_party",
];

// Ordre canonique des types dans les sélecteurs (annuaire d'abord,
// familles acquéreurs ensuite, tiers de confiance enfin).
export const ORG_TYPE_SELECT_ORDER: string[] = [
  "client", "prospect_client", "target",
  "buyer", "corporate", "investor", "business_angel", "family_office",
  "bank", "advisor", "law_firm", "accounting_firm", "consulting_firm",
  "other",
];

// Étapes du funnel acquéreur (dérivées par lib/crm/funnel.ts).
export const funnelStageLabels: Record<string, string> = {
  pre_approche: "Pré-approche",
  approuve: "Approuvé",
  teaser_envoye: "Teaser envoyé",
  nda_signe: "NDA signé",
  im_envoye: "IM envoyé",
  offre_recue: "Offre reçue",
};

// Rôles d'une organisation dans un dossier (deal_organizations.role_in_dossier).
// Consommé par la fiche dossier et l'export PDF (qui affichait la valeur brute).
export const roleInDossierLabels: Record<string, string> = {
  client: "Client",
  banque: "Banque",
  repreneur: "Repreneur",
  investisseur: "Fonds",
  avocat: "Cabinet juridique",
  expert_comptable: "Expert-comptable",
  conseil: "Conseil",
  cible: "Cible",
  acquereur: "Acquéreur",
  autre: "Autre",
};

export const organizationStatusLabels: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  qualified: "Qualifié",
  dormant: "Dormant",
};

export const baseContactStatusLabels: Record<string, string> = {
  to_qualify: "À qualifier",
  qualified: "Qualifié",
  priority: "Prioritaire",
  active: "Actif",
  dormant: "Dormant",
  inactive: "Inactif",
  excluded: "Exclu",
};

export const contactPipelineStatusLabels: Record<string, string> = {
  to_contact: "À contacter",
  contacted: "Contacté",
  to_follow_up: "À relancer",
  in_discussion: "En discussion",
  meeting_done: "Meeting tenu",
  strong_interest: "Intérêt marqué",
  waiting: "En attente",
  no_go: "No go",
  partner_active: "Suivi en cours",
  document_requested: "Document demandé",
};

export const activityTypeLabels: Record<string, string> = {
  email_received: "Email reçu",
  email_sent: "Email envoyé",
  call: "Call",
  meeting: "Réunion",
  follow_up: "Relance",
  intro: "Intro",
  note: "Note",
  document_sent: "Document envoyé",
  document_received: "Document reçu",
  nda: "NDA",
  deck_sent: "Deck envoyé",
  bp_sent: "BP envoyé",
  im_sent: "IM envoyé",
  dataroom_opened: "Dataroom ouverte",
  other: "Autre",
};

export const sourceLabels: Record<string, string> = {
  manual: "Manuel",
  gmail: "Gmail",
  calendar: "Calendrier",
  drive: "Drive",
  claude: "Claude",
  import: "Import",
  api: "API",
};

export const priorityLabels: Record<string, string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

export const priorityTaskStatusLabels: Record<string, string> = {
  open: "Ouverte",
  done: "Terminée",
  cancelled: "Annulée",
};

export const agendaTypeLabels: Record<string, string> = {
  deadline: "Deadline",
  follow_up: "Relance",
  meeting: "Réunion",
  call: "Call",
  delivery: "Rendu",
  closing: "Closing",
  other: "Autre",
};

// ────────────────────────────────────────────────────────────────
// NOUVEAUX LABELS V14 : UNIFIED ACTIVITIES
// ────────────────────────────────────────────────────────────────

export const unifiedActivityTypeLabels: Record<string, string> = {
  // Originaux
  email_received: "Email reçu",
  email_sent: "Email envoyé",
  call: "Call",
  meeting: "Réunion",
  follow_up: "Relance",
  intro: "Intro",
  note: "Note",
  document_sent: "Document envoyé",
  document_received: "Document reçu",
  nda: "NDA",
  deck_sent: "Deck envoyé",
  todo: "Tâche",
  deadline: "Deadline",
  delivery: "Rendu",
  closing: "Closing",
  // Nouveaux : services
  investor_meeting: "Réunion acquéreur",
  due_diligence: "Due diligence",
  other: "Autre",
};

export const activityStatusLabels: Record<string, string> = {
  open: "Ouverte",
  done: "Terminée",
  cancelled: "Annulée",
};
