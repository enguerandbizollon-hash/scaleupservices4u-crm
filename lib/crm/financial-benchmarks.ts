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
};

const DEFAULT_BENCHMARK: SectorBenchmark = {
  gross_margin:    { low: 40, mid: 50, high: 60 },
  ebitda_margin:   { low: 10, mid: 15, high: 20 },
  ev_ebitda:       { low: 7, mid: 10.5, high: 14 },
  ev_ebit:         { low: 9, mid: 12.5, high: 16 },
  ev_revenue:      { low: 1.5, mid: 2.7, high: 4 },
  net_debt_ebitda: { healthy: 3, lbo: 5 },
};

export function getBenchmark(sector: string | null | undefined): SectorBenchmark {
  if (!sector) return DEFAULT_BENCHMARK;
  return BENCHMARKS[sector] ?? DEFAULT_BENCHMARK;
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
