-- V30 : Extension table financial_data — détail charges, bilan complet, valorisation multi-scénarios, DCF
-- Additive : ALTER TABLE ADD COLUMN IF NOT EXISTS (pas de DROP)
-- La table financial_data existe depuis V24 avec colonnes P&L/SaaS/valorisation basiques

BEGIN;

-- ── Colonnes is_forecast ────────────────────────────────────────────────
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS is_forecast BOOLEAN DEFAULT FALSE;

-- ── Détail charges P&L ──────────────────────────────────────────────────
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS revenue_recurring     NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS revenue_non_recurring NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS cogs                  NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS payroll               NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS payroll_rd            NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS payroll_sales         NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS payroll_ga            NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS marketing             NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS rent                  NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS other_opex            NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS da                    NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS financial_charges     NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS taxes                 NUMERIC;

-- ── Métriques récurrentes (complément) ──────────────────────────────────
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS growth_fcst           NUMERIC;

-- ── Bilan actif détaillé ────────────────────────────────────────────────
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS intangible_assets     NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS tangible_assets       NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS financial_assets      NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS inventory             NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS accounts_receivable   NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS other_current_assets  NUMERIC;

-- ── Bilan passif détaillé ───────────────────────────────────────────────
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS share_capital             NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS reserves                  NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS net_income_bs             NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS debt_lt                   NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS debt_st                   NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS accounts_payable          NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS other_current_liabilities NUMERIC;

-- ── Valorisation multi-scénarios ────────────────────────────────────────
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS multiple_ev_ebitda_low    NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS multiple_ev_ebitda_mid    NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS multiple_ev_ebitda_high   NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS multiple_ev_ebit_low      NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS multiple_ev_ebit_mid      NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS multiple_ev_ebit_high     NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS multiple_ev_revenue_low   NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS multiple_ev_revenue_mid   NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS multiple_ev_revenue_high  NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS multiple_ev_arr_low       NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS multiple_ev_arr_mid       NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS multiple_ev_arr_high      NUMERIC;

-- ── DCF ─────────────────────────────────────────────────────────────────
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS wacc                  NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS terminal_growth_rate  NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS fcf_n1               NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS fcf_n2               NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS fcf_n3               NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS fcf_n4               NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS fcf_n5               NUMERIC;

-- ── Ajustements valorisation ────────────────────────────────────────────
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS misc_adjustments          NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS contingent_liabilities    NUMERIC;
ALTER TABLE financial_data ADD COLUMN IF NOT EXISTS excess_cash               NUMERIC;

-- ── Contrainte unique (dossier + année + forecast) ──────────────────────
-- Ne pas créer si la contrainte existante est deal_id+fiscal_year sans is_forecast
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'financial_data_deal_year_forecast_unique'
  ) THEN
    ALTER TABLE financial_data ADD CONSTRAINT financial_data_deal_year_forecast_unique
      UNIQUE (deal_id, fiscal_year, is_forecast);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMIT;

-- Vérification :
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'financial_data' AND column_name IN ('cogs','payroll','debt_lt','wacc','is_forecast')
-- ORDER BY column_name;
