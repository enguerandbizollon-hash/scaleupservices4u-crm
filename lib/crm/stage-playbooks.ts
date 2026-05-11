// Playbooks d'actions recommandées par deal_type x stage.
// Source de vérité pour les suggestions automatiques sur la fiche dossier.
// Chaque action a un titre court, un type (task/email/meeting/...) et une
// description courte qui apparaîtront en option dans le panneau Playbook.
//
// Le user clique sur "Ajouter" pour transformer la suggestion en vraie
// task/action sur le dossier. Les suggestions ne sont pas persistées :
// elles servent juste à pousser l'équipe vers les bons réflexes métier.

export interface PlaybookAction {
  title: string;
  type: "task" | "email" | "call" | "meeting" | "deadline" | "document_request" | "interview" | "technical_test";
  description?: string;
  hard_deadline?: boolean;
  // Jours à ajouter à la date courante pour suggérer une due_date par défaut
  due_in_days?: number;
}

export interface Playbook {
  title: string;
  intent: string; // Phrase courte qui résume l'intention du stade
  actions: PlaybookAction[];
}

// Clé : `${deal_type}:${deal_stage}` (en lowercase, espaces vers underscores)
type PlaybookKey = string;

function key(dealType: string, stage: string): PlaybookKey {
  return `${dealType}:${stage.toLowerCase().replace(/\s+/g, "_")}`;
}

const PLAYBOOKS: Record<PlaybookKey, Playbook> = {
  // ── Fundraising ─────────────────────────────────────────────────────────
  [key("fundraising", "kickoff")]: {
    title: "Kickoff fundraising",
    intent: "Cadrer la mission, valider la stratégie de levée et préparer les livrables fondateurs.",
    actions: [
      { title: "Kickoff client : alignement objectifs et timing", type: "meeting", due_in_days: 3 },
      { title: "Valider valorisation cible et structure de round", type: "task", due_in_days: 7 },
      { title: "Définir la stratégie investisseurs (smart vs growth)", type: "task", due_in_days: 7 },
      { title: "Cadrer livrables : teaser, pitch deck, business plan", type: "task", due_in_days: 10 },
    ],
  },
  [key("fundraising", "preparation")]: {
    title: "Préparation des supports",
    intent: "Finaliser les supports de marché et le pipeline investisseurs.",
    actions: [
      { title: "Préparer / réviser le pitch deck", type: "task", due_in_days: 10 },
      { title: "Finaliser le business plan financier", type: "task", due_in_days: 10 },
      { title: "Constituer le pipeline investisseurs (longlist)", type: "task", due_in_days: 7 },
      { title: "Rédiger le teaser anonymisé", type: "task", due_in_days: 7 },
      { title: "Préparer le NDA template", type: "task", due_in_days: 5 },
    ],
  },
  [key("fundraising", "outreach")]: {
    title: "Outreach investisseurs",
    intent: "Engager le marché, mesurer les retours et qualifier le pipeline.",
    actions: [
      { title: "Lancer 1ère vague d'emails warm intros", type: "email", due_in_days: 2 },
      { title: "Activer le pipeline LinkedIn (10 messages / jour)", type: "task", due_in_days: 5 },
      { title: "Suivi quotidien des réponses et NDAs signés", type: "task", due_in_days: 7 },
      { title: "Mettre à jour le tracker investisseurs hebdo", type: "task", due_in_days: 7 },
    ],
  },
  [key("fundraising", "management_meetings")]: {
    title: "Management meetings",
    intent: "Convertir l'intérêt en conviction. Préparer chaque entretien.",
    actions: [
      { title: "Brief équipe client avant chaque meeting", type: "task" },
      { title: "Préparer Q&A anticipées", type: "task", due_in_days: 5 },
      { title: "Debrief post-meeting + plan suivi", type: "task" },
      { title: "Relances qualifiées (J+3, J+7)", type: "task", due_in_days: 7 },
    ],
  },
  [key("fundraising", "dd")]: {
    title: "Due diligence",
    intent: "Fournir l'info, lever les freins et tenir le calendrier.",
    actions: [
      { title: "Constituer la dataroom complète", type: "task", due_in_days: 7, hard_deadline: true },
      { title: "Coordonner réponses Q&A légales / financières", type: "task", due_in_days: 5 },
      { title: "Préparer présentation cap table cible", type: "task", due_in_days: 5 },
      { title: "Aligner conseils (avocat, expert-comptable)", type: "task", due_in_days: 5 },
    ],
  },
  [key("fundraising", "negotiation")]: {
    title: "Négociation term sheet",
    intent: "Optimiser les conditions et préparer le closing.",
    actions: [
      { title: "Analyser term sheet reçue (clauses clés)", type: "task", due_in_days: 2 },
      { title: "Préparer contre-proposition", type: "task", due_in_days: 5 },
      { title: "Coordonner négociation avec l'avocat", type: "meeting", due_in_days: 7 },
      { title: "Aligner les co-investisseurs", type: "task", due_in_days: 10 },
    ],
  },
  [key("fundraising", "closing")]: {
    title: "Closing",
    intent: "Sécuriser la signature et l'encaissement.",
    actions: [
      { title: "Coordonner signing avec l'avocat", type: "meeting", due_in_days: 10, hard_deadline: true },
      { title: "Valider les conditions suspensives", type: "task", due_in_days: 7 },
      { title: "Vérifier que les fonds sont transférés", type: "task", due_in_days: 14 },
      { title: "Facturer le success fee", type: "task", due_in_days: 14 },
    ],
  },

  // ── M&A Sell-side ────────────────────────────────────────────────────────
  [key("ma_sell", "kickoff")]: {
    title: "Kickoff cession",
    intent: "Cadrer la mission, valider l'asking price et la stratégie acquéreurs.",
    actions: [
      { title: "Kickoff client : objectifs et confidentialité", type: "meeting", due_in_days: 3 },
      { title: "Audit interne préparatoire (état des comptes)", type: "task", due_in_days: 7 },
      { title: "Valider l'asking price avec valorisation IA", type: "task", due_in_days: 7 },
      { title: "Aligner sur la longlist d'acquéreurs cibles", type: "task", due_in_days: 10 },
    ],
  },
  [key("ma_sell", "preparation")]: {
    title: "Préparation cession",
    intent: "Préparer les supports de marché et la dataroom de cession.",
    actions: [
      { title: "Rédiger le teaser anonymisé", type: "task", due_in_days: 7 },
      { title: "Préparer l'Information Memorandum (IM)", type: "task", due_in_days: 14 },
      { title: "Constituer la dataroom préliminaire", type: "task", due_in_days: 14 },
      { title: "Préparer NDA et process letter", type: "task", due_in_days: 5 },
      { title: "Finaliser la valorisation IA et benchmarks", type: "task", due_in_days: 7 },
    ],
  },
  [key("ma_sell", "outreach")]: {
    title: "Outreach acquéreurs",
    intent: "Engager les acquéreurs qualifiés et faire signer les NDA.",
    actions: [
      { title: "Envoyer le teaser aux acquéreurs priorité 1", type: "email", due_in_days: 2 },
      { title: "Suivi NDA et signatures", type: "task", due_in_days: 7 },
      { title: "Distribuer l'IM aux NDA signés", type: "task", due_in_days: 7 },
      { title: "Tracker des intérêts non-binding offers", type: "task", due_in_days: 10 },
    ],
  },
  [key("ma_sell", "management_meetings")]: {
    title: "Management meetings",
    intent: "Présenter la cible aux acquéreurs sérieux et trier les intérêts.",
    actions: [
      { title: "Brief équipe client avant chaque meeting", type: "task" },
      { title: "Préparer Q&A et démonstrations", type: "task", due_in_days: 5 },
      { title: "Recueillir indications de prix non-binding", type: "task", due_in_days: 7 },
      { title: "Sélectionner shortlist pour DD", type: "task", due_in_days: 10 },
    ],
  },
  [key("ma_sell", "dd")]: {
    title: "Due diligence acquéreurs",
    intent: "Ouvrir la dataroom complète et gérer les Q&A.",
    actions: [
      { title: "Activer la dataroom complète", type: "task", due_in_days: 3, hard_deadline: true },
      { title: "Coordonner les Q&A entrants (financier, juridique, business)", type: "task", due_in_days: 14 },
      { title: "Organiser les expert calls demandés", type: "task", due_in_days: 7 },
      { title: "Tenir le tracker des deadlines DD", type: "task", due_in_days: 14 },
    ],
  },
  [key("ma_sell", "negotiation")]: {
    title: "Négociation binding offers",
    intent: "Sélectionner le meilleur acquéreur et négocier les meilleures conditions.",
    actions: [
      { title: "Analyser binding offers reçues", type: "task", due_in_days: 3 },
      { title: "Négocier les clauses clés (earn-out, garanties)", type: "task", due_in_days: 14 },
      { title: "Coordonner avec l'avocat sur le SPA", type: "meeting", due_in_days: 10 },
      { title: "Préparer le management presentation", type: "task", due_in_days: 7 },
    ],
  },
  [key("ma_sell", "closing")]: {
    title: "Closing cession",
    intent: "Sécuriser la signature et le paiement.",
    actions: [
      { title: "Coordonner signing day", type: "meeting", due_in_days: 14, hard_deadline: true },
      { title: "Valider les conditions suspensives", type: "task", due_in_days: 10 },
      { title: "Vérifier transferts (escrow, paiements)", type: "task", due_in_days: 14 },
      { title: "Facturer le success fee", type: "task", due_in_days: 14 },
    ],
  },

  // ── M&A Buy-side ─────────────────────────────────────────────────────────
  [key("ma_buy", "kickoff")]: {
    title: "Kickoff acquisition",
    intent: "Cadrer la stratégie d'acquisition et les critères de cibles.",
    actions: [
      { title: "Kickoff client : critères et budget", type: "meeting", due_in_days: 3 },
      { title: "Valider la thèse stratégique et fit", type: "task", due_in_days: 7 },
      { title: "Définir deal breakers et critères eliminating", type: "task", due_in_days: 5 },
    ],
  },
  [key("ma_buy", "search")]: {
    title: "Recherche de cibles",
    intent: "Constituer le pipeline de cibles et qualifier l'intérêt.",
    actions: [
      { title: "Constituer la longlist de cibles (50+)", type: "task", due_in_days: 14 },
      { title: "Scorer cibles via algo matching M&A", type: "task", due_in_days: 7 },
      { title: "Approche discrète des cibles priorité 1", type: "email", due_in_days: 14 },
      { title: "Tenir le tracker des contacts initiaux", type: "task", due_in_days: 14 },
    ],
  },
  [key("ma_buy", "outreach")]: {
    title: "Outreach cibles",
    intent: "Engager les dirigeants des cibles et obtenir des entretiens exploratoires.",
    actions: [
      { title: "Envoyer NDA aux cibles intéressées", type: "task", due_in_days: 5 },
      { title: "Premier call exploratoire avec dirigeants", type: "call", due_in_days: 14 },
      { title: "Mettre à jour les fiches cibles après chaque contact", type: "task" },
    ],
  },
  [key("ma_buy", "management_meetings")]: {
    title: "Management meetings",
    intent: "Visiter les cibles sérieuses et formuler des Letter of Intent (LOI).",
    actions: [
      { title: "Visiter sites et présentations cibles shortlist", type: "meeting", due_in_days: 14 },
      { title: "Formuler LOI sur cibles priorisées", type: "task", due_in_days: 14 },
      { title: "Réviser scoring après chaque visite", type: "task" },
    ],
  },
  [key("ma_buy", "dd")]: {
    title: "Due diligence cible",
    intent: "Valider la thèse et chiffrer les risques.",
    actions: [
      { title: "Demander accès à la dataroom complète", type: "document_request", due_in_days: 3 },
      { title: "Coordonner DD financière (expert comptable)", type: "task", due_in_days: 14 },
      { title: "Coordonner DD juridique (avocat)", type: "task", due_in_days: 14 },
      { title: "DD opérationnelle et commerciale", type: "task", due_in_days: 14 },
      { title: "Synthèse risques / opportunités client", type: "task", due_in_days: 21 },
    ],
  },
  [key("ma_buy", "negotiation")]: {
    title: "Négociation",
    intent: "Finaliser la structure et les conditions du deal.",
    actions: [
      { title: "Négocier prix final + earn-out", type: "task", due_in_days: 10 },
      { title: "Coordonner SPA avec avocat", type: "meeting", due_in_days: 14 },
      { title: "Aligner financement (banque / mezzanine)", type: "task", due_in_days: 14 },
    ],
  },
  [key("ma_buy", "closing")]: {
    title: "Closing acquisition",
    intent: "Sécuriser le signing et préparer l'intégration.",
    actions: [
      { title: "Signing day coordination", type: "meeting", hard_deadline: true, due_in_days: 14 },
      { title: "Validation conditions suspensives", type: "task", due_in_days: 10 },
      { title: "Plan d'intégration 100 jours", type: "task", due_in_days: 21 },
      { title: "Facturer le success fee", type: "task", due_in_days: 14 },
    ],
  },

  // ── CFO Advisory ─────────────────────────────────────────────────────────
  [key("cfo_advisor", "kickoff")]: {
    title: "Kickoff CFO Advisory",
    intent: "Cadrer le périmètre, comprendre l'existant et lancer le diagnostic.",
    actions: [
      { title: "Diagnostic initial : comptes, processus, équipe", type: "task", due_in_days: 14 },
      { title: "Accès aux outils et données du client", type: "task", due_in_days: 5 },
      { title: "Définir KPIs et reporting cible", type: "task", due_in_days: 10 },
      { title: "Cadrer les livrables mensuels", type: "meeting", due_in_days: 7 },
    ],
  },
  [key("cfo_advisor", "ongoing_support")]: {
    title: "Support CFO continu",
    intent: "Délivrer le reporting mensuel et accompagner les décisions stratégiques.",
    actions: [
      { title: "Reporting financier mensuel", type: "task", due_in_days: 30 },
      { title: "Comité de direction mensuel", type: "meeting", due_in_days: 30 },
      { title: "Suivi cash et runway", type: "task", due_in_days: 14 },
      { title: "Prévisionnel rolling 12 mois", type: "task", due_in_days: 30 },
    ],
  },

  // ── Recrutement ──────────────────────────────────────────────────────────
  [key("recruitment", "kickoff")]: {
    title: "Kickoff recrutement",
    intent: "Cadrer le brief client et lancer le sourcing.",
    actions: [
      { title: "Brief client : fiche de poste, salaire, profil idéal", type: "meeting", due_in_days: 3 },
      { title: "Valider critères deal breakers (séniorité, géo)", type: "task", due_in_days: 5 },
      { title: "Préparer le pitch employeur", type: "task", due_in_days: 7 },
    ],
  },
  [key("recruitment", "search")]: {
    title: "Sourcing candidats",
    intent: "Constituer le vivier et qualifier les premiers profils.",
    actions: [
      { title: "Sourcing LinkedIn et réseau (objectif 50 contacts)", type: "task", due_in_days: 14 },
      { title: "Premier appel qualification (10 candidats)", type: "call", due_in_days: 14 },
      { title: "Mettre à jour le pipeline candidats hebdo", type: "task", due_in_days: 7 },
    ],
  },
  [key("recruitment", "outreach")]: {
    title: "Engagement candidats",
    intent: "Convaincre les profils qualifiés de s'engager dans le process.",
    actions: [
      { title: "Présenter le poste aux candidats qualifiés", type: "call", due_in_days: 7 },
      { title: "Coordonner les entretiens client", type: "interview", due_in_days: 14 },
      { title: "Tests techniques si applicable", type: "technical_test", due_in_days: 14 },
    ],
  },
  [key("recruitment", "negotiation")]: {
    title: "Négociation offre",
    intent: "Aider à la décision finale et négocier l'offre.",
    actions: [
      { title: "Synthèse 3 candidats finalistes pour client", type: "task", due_in_days: 7 },
      { title: "Coaching candidat sur la négociation", type: "call", due_in_days: 7 },
      { title: "Coordonner l'offre finale (salaire, package)", type: "task", due_in_days: 7 },
    ],
  },
  [key("recruitment", "closing")]: {
    title: "Closing placement",
    intent: "Sécuriser l'acceptation et le démarrage.",
    actions: [
      { title: "Suivi acceptation offre signée", type: "task", due_in_days: 7, hard_deadline: true },
      { title: "Coordination de la prise de poste", type: "task", due_in_days: 30 },
      { title: "Check-in 1er mois post-placement", type: "call", due_in_days: 45 },
      { title: "Facturer le success fee placement", type: "task", due_in_days: 7 },
    ],
  },
};

export function getPlaybook(dealType: string, stage: string | null | undefined): Playbook | null {
  if (!stage) return null;
  const k = key(dealType, stage);
  return PLAYBOOKS[k] ?? null;
}
