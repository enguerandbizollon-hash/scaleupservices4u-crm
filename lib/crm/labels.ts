export const dealTypeLabels: Record<string, string> = {
  fundraising: "Fundraising",
  ma_sell: "M&A Sell-side",
  ma_buy: "M&A Buy-side",
  cfo_advisor: "CFO Advisor",
  recruitment: "Recrutement",
};

export const dealStatusLabels: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  closed: "Clôturé",
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

export const organizationTypeLabels: Record<string, string> = {
  investor: "Investisseur",
  client: "Client",
  prospect: "Prospect",
  third_party: "Tiers",
  bank: "Banque",
  law_firm: "Avocat",
  buyer: "Repreneur",
  corporate: "Corporate",
  consulting_firm: "Conseil",
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

export const checklistStatusLabels: Record<string, string> = {
  open: "À faire",
  done: "Finalisé",
  cancelled: "Annulé",
};

export const documentTypeLabels: Record<string, string> = {
  pitch_deck: "Pitch deck",
  financial_model: "Modèle financier",
  im: "Information Memorandum",
  teaser: "Teaser",
  nda: "NDA",
  legal: "Juridique",
  finance: "Finance",
  hr: "RH",
  deck: "Deck",
  other: "Autre",
};

export const documentStatusLabels: Record<string, string> = {
  requested: "Demandé",
  received: "Reçu",
  modeled: "Modélisé",
  finalized: "Finalisé",
  archived: "Archivé",
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