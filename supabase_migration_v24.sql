-- Migration V24 : FONDATIONS COMMERCIALES — Données financières, mandats, honoraires
-- Exécuter dans Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 1 : FINANCIAL_DATA — Données financières universelles (multi-canal)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Unique table pour tous les types de dossiers (Fundraising, M&A, Recrutement, CFO)
-- Supports : historique fiscal year, SaaS metrics, valorisation, multi-devise

CREATE TABLE IF NOT EXISTS financial_data (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                     UUID REFERENCES deals(id) ON DELETE SET NULL,
  organization_id             UUID REFERENCES organizations(id) ON DELETE SET NULL,
  
  -- Période et contexte
  fiscal_year                 INTEGER NOT NULL,
  period_type                 TEXT DEFAULT 'annual',  -- annual|quarterly|monthly
  period_label                TEXT,                   -- ex: "Q1 2024", "FY 2023"
  currency                    TEXT NOT NULL DEFAULT 'EUR',
  
  -- P&L et Bilan
  revenue                     NUMERIC,
  gross_profit                NUMERIC,
  gross_margin                NUMERIC,
  ebitda                      NUMERIC,
  ebitda_margin               NUMERIC,
  ebit                        NUMERIC,
  net_income                  NUMERIC,
  total_assets                NUMERIC,
  net_debt                    NUMERIC,
  equity                      NUMERIC,
  cash                        NUMERIC,
  capex                       NUMERIC,
  working_capital             NUMERIC,
  
  -- Variations % (N vs N-1)
  revenue_growth              NUMERIC,
  ebitda_growth               NUMERIC,
  
  -- Opérationnel
  headcount                   INTEGER,
  headcount_growth            NUMERIC,
  revenue_per_employee        NUMERIC,
  
  -- SaaS / Récurrence (optionnel pour tous les deal_types)
  arr                         NUMERIC,
  mrr                         NUMERIC,
  nrr                         NUMERIC,
  grr                         NUMERIC,
  churn_rate                  NUMERIC,
  cagr                        NUMERIC,
  ltv                         NUMERIC,
  cac                         NUMERIC,
  ltv_cac_ratio               NUMERIC,
  payback_months              NUMERIC,
  
  -- Valorisation
  ev_estimate                 NUMERIC,
  ev_revenue_multiple         NUMERIC,
  ev_ebitda_multiple          NUMERIC,
  ev_arr_multiple             NUMERIC,
  equity_value                NUMERIC,
  
  -- Import et enrichissement
  source                      TEXT NOT NULL DEFAULT 'manual',  -- manual|csv|excel|gdrive|harmonic|crunchbase|pitchbook|client_upload|api|portal
  external_id                 TEXT,
  raw_data                    JSONB,
  
  -- IA extraction
  ai_extracted                BOOLEAN DEFAULT FALSE,
  ai_confidence_score         NUMERIC,
  ai_extraction_notes         TEXT,
  ai_analyzed_at              TIMESTAMPTZ,
  
  -- Audit
  imported_at                 TIMESTAMPTZ DEFAULT NOW(),
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_financial_deal           ON financial_data(deal_id);
CREATE INDEX IF NOT EXISTS idx_financial_org            ON financial_data(organization_id);
CREATE INDEX IF NOT EXISTS idx_financial_fiscal_year    ON financial_data(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_financial_source         ON financial_data(source);
CREATE INDEX IF NOT EXISTS idx_financial_user           ON financial_data(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_deal_year      ON financial_data(deal_id, fiscal_year);

-- RLS : Users manage own data
ALTER TABLE financial_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own financial_data" ON financial_data;
CREATE POLICY "Users manage own financial_data" ON financial_data
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

---

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 2 : MANDATES — Relations commerciales (client/projet/fees)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Un mandat = relation contractuelle avec un client
-- Un mandat contient N dossiers (deals) opérationnels

CREATE TABLE IF NOT EXISTS mandates (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Identification
  name                        TEXT NOT NULL,
  type                        TEXT NOT NULL,  -- fundraising|ma_sell|ma_buy|cfo_advisor|recruitment
  status                      TEXT DEFAULT 'draft',  -- draft|active|on_hold|won|lost|closed
  
  -- Client et couverture
  client_organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id                    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timing
  description                 TEXT,
  priority                    TEXT DEFAULT 'medium',  -- low|medium|high
  start_date                  DATE,
  target_close_date           DATE,
  end_date                    DATE,
  
  -- Honoraires
  currency                    TEXT NOT NULL DEFAULT 'EUR',
  estimated_fee_amount        NUMERIC,
  confirmed_fee_amount        NUMERIC DEFAULT 0,
  retainer_monthly            NUMERIC,
  success_fee_percent         NUMERIC,
  success_fee_base            TEXT,  -- ev|revenue|raise_amount|salary
  
  -- Contexte
  notes                       TEXT,
  
  -- Audit
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_mandates_client         ON mandates(client_organization_id);
CREATE INDEX IF NOT EXISTS idx_mandates_type           ON mandates(type);
CREATE INDEX IF NOT EXISTS idx_mandates_status         ON mandates(status);
CREATE INDEX IF NOT EXISTS idx_mandates_owner          ON mandates(owner_id);
CREATE INDEX IF NOT EXISTS idx_mandates_user           ON mandates(user_id);

-- RLS : Users manage own mandates
ALTER TABLE mandates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own mandates" ON mandates;
CREATE POLICY "Users manage own mandates" ON mandates
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

---

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 3 : FEE_MILESTONES — Jalons de facturation
-- ═══════════════════════════════════════════════════════════════════════════════
-- Jalon = événement facturable (retainer, success fee, fixed, expense)
-- Lie mandates → deals avec suivi encaissement

CREATE TABLE IF NOT EXISTS fee_milestones (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Lien mandat et deal (deal est optionnel, pertinent pour success fees)
  mandate_id                  UUID NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  deal_id                     UUID REFERENCES deals(id) ON DELETE SET NULL,
  
  -- Description et type
  name                        TEXT NOT NULL,
  milestone_type              TEXT NOT NULL,  -- retainer|success_fee|fixed|expense
  notes                       TEXT,
  
  -- Finance
  amount                      NUMERIC NOT NULL,
  currency                    TEXT NOT NULL DEFAULT 'EUR',
  
  -- Timeline
  due_date                    DATE,
  invoiced_date               DATE,
  paid_date                   DATE,
  
  -- Statut
  status                      TEXT DEFAULT 'pending',  -- pending|invoiced|paid|cancelled
  invoice_reference           TEXT,
  
  -- Audit
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_milestones_mandate      ON fee_milestones(mandate_id);
CREATE INDEX IF NOT EXISTS idx_milestones_deal         ON fee_milestones(deal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status       ON fee_milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_user         ON fee_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_due_date     ON fee_milestones(due_date);

-- RLS : Users manage own fee milestones
ALTER TABLE fee_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own fee_milestones" ON fee_milestones;
CREATE POLICY "Users manage own fee_milestones" ON fee_milestones
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

---

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 4 : EXCHANGE_RATES — Taux de change (EUR, CHF, USD, GBP)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Multi-devise pour affichage dashboard sans modifier données persistées

CREATE TABLE IF NOT EXISTS exchange_rates (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Paire de conversion
  from_currency               TEXT NOT NULL,  -- EUR|CHF|USD|GBP
  to_currency                 TEXT NOT NULL,
  
  -- Taux et source
  rate                        NUMERIC NOT NULL,
  effective_date              DATE NOT NULL,
  source                      TEXT DEFAULT 'manual',  -- manual|api
  
  -- Audit
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  
  -- Éviter les doublons (paire + date unique)
  UNIQUE(from_currency, to_currency, effective_date)
);

-- Index pour requêtes de conversion
CREATE INDEX IF NOT EXISTS idx_rates_from              ON exchange_rates(from_currency);
CREATE INDEX IF NOT EXISTS idx_rates_pair              ON exchange_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_rates_date              ON exchange_rates(effective_date DESC);

-- Pas de RLS sur les taux (données publiques du cabinet)

---

-- ═══════════════════════════════════════════════════════════════════════════════
-- LIEN LOGIQUE : DEALS → MANDATES
-- ═══════════════════════════════════════════════════════════════════════════════
-- Ajouter colonne mandate_id sur deals pour associer dossiers à mandats

ALTER TABLE deals ADD COLUMN IF NOT EXISTS mandate_id UUID REFERENCES mandates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_mandate ON deals(mandate_id);

---

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS : Automatisations financières
-- ═══════════════════════════════════════════════════════════════════════════════

-- Trigger : Fee milestone payé → met à jour mandate.confirmed_fee_amount
CREATE OR REPLACE FUNCTION update_mandate_confirmed_fee()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    UPDATE mandates
    SET confirmed_fee_amount = COALESCE(confirmed_fee_amount, 0) + NEW.amount,
        updated_at = NOW()
    WHERE id = NEW.mandate_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_mandate_fee_on_payment ON fee_milestones;
CREATE TRIGGER tr_update_mandate_fee_on_payment
AFTER UPDATE OF status ON fee_milestones
FOR EACH ROW
EXECUTE FUNCTION update_mandate_confirmed_fee();

---

-- Trigger : Deal won et deal_type recruitment → place candidate + trigger fees
-- (Voir trigger dans actions/candidates.ts pour logique applicative)

---

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONNÉES D'EXEMPLE (optionnel — à supprimer en prod)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Taux de change de base EUR
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, source)
VALUES
  ('EUR', 'CHF', 0.92, CURRENT_DATE, 'manual'),
  ('EUR', 'USD', 1.10, CURRENT_DATE, 'manual'),
  ('EUR', 'GBP', 0.86, CURRENT_DATE, 'manual'),
  ('CHF', 'EUR', 1.09, CURRENT_DATE, 'manual'),
  ('USD', 'EUR', 0.91, CURRENT_DATE, 'manual')
ON CONFLICT (from_currency, to_currency, effective_date) DO NOTHING;

---

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION POST-MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('financial_data', 'mandates', 'fee_milestones', 'exchange_rates')
-- ORDER BY table_name;
