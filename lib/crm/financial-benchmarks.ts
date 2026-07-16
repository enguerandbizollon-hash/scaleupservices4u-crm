// Benchmarks sectoriels M&A marché 2024
// Utilisé pour comparer les métriques calculées aux normes du secteur

export type SectorBenchmark = {
  gross_margin:    { low: number; mid: number; high: number };
  ebitda_margin:   { low: number; mid: number; high: number };
  ev_ebitda:       { low: number; mid: number; high: number };
  ev_ebit:         { low: number; mid: number; high: number };
  ev_revenue:      { low: number; mid: number; high: number };
  net_debt_ebitda: { healthy: number; lbo: number };
  rule_of_40?:     number;
};

const BENCHMARKS: Record<string, SectorBenchmark> = {
  "SaaS": {
    gross_margin:    { low: 65, mid: 72, high: 80 },
    ebitda_margin:   { low: 15, mid: 20, high: 25 },
    ev_ebitda:       { low: 12, mid: 18, high: 25 },
    ev_ebit:         { low: 15, mid: 22, high: 30 },
    ev_revenue:      { low: 4, mid: 7, high: 10 },
    net_debt_ebitda: { healthy: 2, lbo: 4 },
    rule_of_40:      40,
  },
  "Fintech": {
    gross_margin:    { low: 50, mid: 60, high: 70 },
    ebitda_margin:   { low: 10, mid: 15, high: 20 },
    ev_ebitda:       { low: 10, mid: 15, high: 20 },
    ev_ebit:         { low: 12, mid: 18, high: 25 },
    ev_revenue:      { low: 3, mid: 5.5, high: 8 },
    net_debt_ebitda: { healthy: 2, lbo: 4 },
  },
  "Healthtech": {
    gross_margin:    { low: 55, mid: 65, high: 75 },
    ebitda_margin:   { low: 12, mid: 17, high: 22 },
    ev_ebitda:       { low: 10, mid: 14, high: 18 },
    ev_ebit:         { low: 12, mid: 17, high: 22 },
    ev_revenue:      { low: 3, mid: 5, high: 7 },
    net_debt_ebitda: { healthy: 2, lbo: 4 },
  },
  "Industrie": {
    gross_margin:    { low: 25, mid: 35, high: 45 },
    ebitda_margin:   { low: 8, mid: 12, high: 15 },
    ev_ebitda:       { low: 6, mid: 8, high: 10 },
    ev_ebit:         { low: 8, mid: 10, high: 12 },
    ev_revenue:      { low: 0.8, mid: 1.4, high: 2 },
    net_debt_ebitda: { healthy: 3, lbo: 5 },
  },
  "Retail": {
    gross_margin:    { low: 30, mid: 40, high: 50 },
    ebitda_margin:   { low: 5, mid: 8, high: 12 },
    ev_ebitda:       { low: 5, mid: 7, high: 9 },
    ev_ebit:         { low: 7, mid: 9, high: 11 },
    ev_revenue:      { low: 0.5, mid: 1, high: 1.5 },
    net_debt_ebitda: { healthy: 2.5, lbo: 4 },
  },
  "Services B2B": {
    gross_margin:    { low: 40, mid: 50, high: 60 },
    ebitda_margin:   { low: 10, mid: 14, high: 18 },
    ev_ebitda:       { low: 7, mid: 9.5, high: 12 },
    ev_ebit:         { low: 9, mid: 11.5, high: 14 },
    ev_revenue:      { low: 1.5, mid: 2.2, high: 3 },
    net_debt_ebitda: { healthy: 2.5, lbo: 4 },
  },
  "Conseil": {
    gross_margin:    { low: 35, mid: 45, high: 55 },
    ebitda_margin:   { low: 8, mid: 12, high: 15 },
    ev_ebitda:       { low: 6, mid: 8, high: 10 },
    ev_ebit:         { low: 8, mid: 10, high: 12 },
    ev_revenue:      { low: 1, mid: 1.7, high: 2.5 },
    net_debt_ebitda: { healthy: 2, lbo: 3.5 },
  },
  "Infrastructure": {
    gross_margin:    { low: 40, mid: 50, high: 60 },
    ebitda_margin:   { low: 20, mid: 27, high: 35 },
    ev_ebitda:       { low: 10, mid: 14, high: 18 },
    ev_ebit:         { low: 12, mid: 16, high: 20 },
    ev_revenue:      { low: 3, mid: 4.5, high: 6 },
    net_debt_ebitda: { healthy: 4, lbo: 6 },
  },
  "Transport": {
    // Transport routier / logistique. Capital-intensif, marges fines.
    gross_margin:    { low: 18, mid: 25, high: 32 },
    ebitda_margin:   { low: 6,  mid: 10, high: 14 },
    ev_ebitda:       { low: 4,  mid: 5.5, high: 7 },
    ev_ebit:         { low: 6,  mid: 8,  high: 10 },
    ev_revenue:      { low: 0.4, mid: 0.6, high: 0.9 },
    net_debt_ebitda: { healthy: 3, lbo: 5 },
  },
  "Energie": {
    // Mix renouvelable + distribution. Multiples variables selon sous-segment.
    gross_margin:    { low: 25, mid: 35, high: 45 },
    ebitda_margin:   { low: 12, mid: 18, high: 25 },
    ev_ebitda:       { low: 6,  mid: 9,  high: 12 },
    ev_ebit:         { low: 8,  mid: 12, high: 15 },
    ev_revenue:      { low: 1,  mid: 1.8, high: 3 },
    net_debt_ebitda: { healthy: 4, lbo: 6 },
  },
  "Juridique": {
    // Cabinets d'avocats, services juridiques.
    gross_margin:    { low: 50, mid: 60, high: 70 },
    ebitda_margin:   { low: 15, mid: 22, high: 30 },
    ev_ebitda:       { low: 5,  mid: 7,  high: 9 },
    ev_ebit:         { low: 6,  mid: 9,  high: 11 },
    ev_revenue:      { low: 1,  mid: 1.4, high: 2 },
    net_debt_ebitda: { healthy: 2, lbo: 3.5 },
  },
  "Impact": {
    // ESG, social, à mission. Acceptation de marges plus faibles, multiples corrects.
    gross_margin:    { low: 35, mid: 45, high: 55 },
    ebitda_margin:   { low: 8,  mid: 13, high: 18 },
    ev_ebitda:       { low: 6,  mid: 8,  high: 11 },
    ev_ebit:         { low: 8,  mid: 10, high: 13 },
    ev_revenue:      { low: 1,  mid: 1.6, high: 2.5 },
    net_debt_ebitda: { healthy: 2.5, lbo: 4 },
  },
  "Food": {
    // Industrie agro / food service. Marges modérées, capital intensif.
    gross_margin:    { low: 25, mid: 35, high: 45 },
    ebitda_margin:   { low: 7,  mid: 11, high: 16 },
    ev_ebitda:       { low: 5,  mid: 7,  high: 9 },
    ev_ebit:         { low: 7,  mid: 9,  high: 11 },
    ev_revenue:      { low: 0.6, mid: 1,  high: 1.5 },
    net_debt_ebitda: { healthy: 2.5, lbo: 4 },
  },
  "Immobilier": {
    // Services immobiliers / proptech (hors foncier pur).
    gross_margin:    { low: 40, mid: 55, high: 70 },
    ebitda_margin:   { low: 15, mid: 22, high: 30 },
    ev_ebitda:       { low: 7,  mid: 10, high: 13 },
    ev_ebit:         { low: 9,  mid: 12, high: 16 },
    ev_revenue:      { low: 1.5, mid: 2.5, high: 4 },
    net_debt_ebitda: { healthy: 3, lbo: 5 },
  },
  "Edtech": {
    // Souvent SaaS, multiples proches SaaS si récurrence forte.
    gross_margin:    { low: 55, mid: 65, high: 75 },
    ebitda_margin:   { low: 10, mid: 17, high: 25 },
    ev_ebitda:       { low: 9,  mid: 14, high: 20 },
    ev_ebit:         { low: 12, mid: 18, high: 25 },
    ev_revenue:      { low: 2.5, mid: 5,  high: 8 },
    net_debt_ebitda: { healthy: 2, lbo: 4 },
    rule_of_40:      35,
  },
  "Cybersécurité": {
    // Très récurrent, multiples premium proches SaaS top tier.
    gross_margin:    { low: 70, mid: 78, high: 85 },
    ebitda_margin:   { low: 18, mid: 25, high: 32 },
    ev_ebitda:       { low: 14, mid: 20, high: 28 },
    ev_ebit:         { low: 18, mid: 25, high: 35 },
    ev_revenue:      { low: 5,  mid: 8,  high: 12 },
    net_debt_ebitda: { healthy: 2, lbo: 4 },
    rule_of_40:      40,
  },
  "Marketplace": {
    // GMV-based valuations + take rate. Multiples sur revenu net.
    gross_margin:    { low: 50, mid: 65, high: 80 },
    ebitda_margin:   { low: 5,  mid: 15, high: 25 },
    ev_ebitda:       { low: 12, mid: 18, high: 25 },
    ev_ebit:         { low: 15, mid: 22, high: 30 },
    ev_revenue:      { low: 3,  mid: 5,  high: 8 },
    net_debt_ebitda: { healthy: 2, lbo: 4 },
  },
  "Hardware": {
    // Hardware/tech, marges fines, capital intensif.
    gross_margin:    { low: 30, mid: 40, high: 50 },
    ebitda_margin:   { low: 8,  mid: 13, high: 18 },
    ev_ebitda:       { low: 6,  mid: 8.5, high: 11 },
    ev_ebit:         { low: 8,  mid: 11, high: 14 },
    ev_revenue:      { low: 1,  mid: 1.8, high: 2.8 },
    net_debt_ebitda: { healthy: 2.5, lbo: 4 },
  },
  "Deeptech": {
    // Souvent peu rentable, valorisation sur potentiel / revenue / IP.
    gross_margin:    { low: 50, mid: 65, high: 80 },
    ebitda_margin:   { low: -5, mid: 5,  high: 18 },
    ev_ebitda:       { low: 12, mid: 20, high: 30 },
    ev_ebit:         { low: 15, mid: 25, high: 35 },
    ev_revenue:      { low: 3,  mid: 6,  high: 12 },
    net_debt_ebitda: { healthy: 1, lbo: 3 },
  },
  "Généraliste": {
    // Services généraux, holding diversifiée.
    gross_margin:    { low: 35, mid: 45, high: 55 },
    ebitda_margin:   { low: 8,  mid: 13, high: 18 },
    ev_ebitda:       { low: 5,  mid: 7,  high: 9 },
    ev_ebit:         { low: 7,  mid: 9,  high: 11 },
    ev_revenue:      { low: 0.7, mid: 1.2, high: 1.8 },
    net_debt_ebitda: { healthy: 2.5, lbo: 4 },
  },
  "Autre": {
    // Calibré sur PME France diversifiée, prudent.
    gross_margin:    { low: 30, mid: 40, high: 50 },
    ebitda_margin:   { low: 7,  mid: 12, high: 18 },
    ev_ebitda:       { low: 5,  mid: 7,  high: 9 },
    ev_ebit:         { low: 7,  mid: 9,  high: 11 },
    ev_revenue:      { low: 0.6, mid: 1,  high: 1.5 },
    net_debt_ebitda: { healthy: 2.5, lbo: 4 },
  },
};

// Benchmark par défaut calibré PME France diversifiée — prudent et réaliste.
const DEFAULT_BENCHMARK: SectorBenchmark = {
  gross_margin:    { low: 30, mid: 40, high: 50 },
  ebitda_margin:   { low: 7,  mid: 12, high: 18 },
  ev_ebitda:       { low: 5,  mid: 7,  high: 9 },
  ev_ebit:         { low: 7,  mid: 9,  high: 11 },
  ev_revenue:      { low: 0.6, mid: 1, high: 1.5 },
  net_debt_ebitda: { healthy: 2.5, lbo: 4 },
};

export function getBenchmark(sector: string | null | undefined): SectorBenchmark {
  if (!sector) return DEFAULT_BENCHMARK;
  return BENCHMARKS[sector] ?? DEFAULT_BENCHMARK;
}

/**
 * Décote PME (small cap discount) appliquée aux multiples sectoriels.
 * Justification : illiquidité, dépendance dirigeant, risque concentration,
 * accès limité à la dette. Pratique standard M&A small cap France.
 *
 * Renvoie un facteur multiplicateur à appliquer aux multiples mid (ev_ebitda,
 * ev_revenue, etc.). Les marges ne sont jamais ajustées par la taille.
 */
export function smallCapDiscountFactor(revenueEur: number | null | undefined): number {
  if (revenueEur == null) return 1;
  if (revenueEur < 2_000_000) return 0.60;    // -40%
  if (revenueEur < 5_000_000) return 0.70;    // -30%
  if (revenueEur < 15_000_000) return 0.85;   // -15%
  return 1;                                    // pas de décote
}

/**
 * Génère un bloc texte structuré à injecter dans le prompt LLM pour
 * contraindre la valorisation IA aux multiples sectoriels réels, ajustés
 * pour la taille de l'entreprise (décote PME).
 *
 * L'IA ne doit PAS inventer les multiples : elle les reçoit explicitement.
 */
export function formatBenchmarkForPrompt(
  sector: string | null | undefined,
  revenueEur: number | null | undefined,
): string {
  const b = getBenchmark(sector);
  const k = smallCapDiscountFactor(revenueEur);
  const sectorLabel = sector ?? "Généraliste";
  const discountLabel = k < 1
    ? `Décote PME small cap : ×${k.toFixed(2)} (CA = ${revenueEur != null ? Math.round(revenueEur / 1000) + "k€" : "—"})`
    : "Pas de décote PME (taille suffisante ou CA inconnu)";

  const adj = (mid: number) => (mid * k).toFixed(1);
  const adjPair = (m: { low: number; mid: number; high: number }) =>
    `${(m.low * k).toFixed(1)}x — ${(m.mid * k).toFixed(1)}x — ${(m.high * k).toFixed(1)}x`;

  return [
    `MULTIPLES SECTORIELS (${sectorLabel}) — réalistes France/Europe 2024 :`,
    `  Marge brute attendue : ${b.gross_margin.low}% — ${b.gross_margin.mid}% — ${b.gross_margin.high}% (bas — médian — haut)`,
    `  Marge EBITDA attendue : ${b.ebitda_margin.low}% — ${b.ebitda_margin.mid}% — ${b.ebitda_margin.high}%`,
    `  ${discountLabel}`,
    `  Multiples APRÈS DÉCOTE (à utiliser explicitement pour la valorisation) :`,
    `    EV / EBITDA : ${adjPair(b.ev_ebitda)}`,
    `    EV / EBIT   : ${adjPair(b.ev_ebit)}`,
    `    EV / Revenue: ${adjPair(b.ev_revenue)}`,
    `  Endettement sain : Dette nette / EBITDA ≤ ${b.net_debt_ebitda.healthy}x ; LBO max ${b.net_debt_ebitda.lbo}x`,
    `  Multiple EV/EBITDA mid retenu pour la valorisation centrale : ${adj(b.ev_ebitda.mid)}x`,
  ].join("\n");
}

export function getRatingColor(
  value: number,
  low: number,
  high: number,
  lowerIsBetter = false,
): "green" | "yellow" | "red" {
  if (lowerIsBetter) {
    if (value <= low) return "green";
    if (value <= high) return "yellow";
    return "red";
  }
  if (value >= high) return "green";
  if (value >= low) return "yellow";
  return "red";
}
