-- V60 : Hypothèses de projection financière par dossier
--
-- Permet de saisir des hypothèses macro (croissance CA, érosion marge, %capex,
-- taux IS, etc.) qui pilotent la génération automatique des exercices
-- prévisionnels N+1, N+2, N+3, etc. dans financial_data (is_forecast = true).
--
-- Une seule ligne d'hypothèses par deal (clé unique). Les overrides ligne par
-- ligne sont stockés directement dans financial_data, et écrasent les valeurs
-- calculées via les hypothèses.
--
-- Idempotente. Aucun impact sur les modules livrés (table nouvelle).

BEGIN;

CREATE TABLE IF NOT EXISTS financial_assumptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id                     UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,

  -- Année de référence (= N réel) à partir de laquelle on projette
  base_fiscal_year            INTEGER,
  projection_years            INTEGER NOT NULL DEFAULT 3 CHECK (projection_years BETWEEN 1 AND 10),

  -- Hypothèses macro (toutes en %, signe positif = croissance/hausse)
  revenue_growth_pct          NUMERIC,   -- croissance CA annuelle (ex: 15 = +15%/an)
  gross_margin_evolution_pp   NUMERIC,   -- évolution marge brute en pp/an (positif = amélioration)
  opex_growth_pct             NUMERIC,   -- croissance opex (payroll + marketing + rent + other) %/an
  capex_pct_revenue           NUMERIC,   -- capex en % du CA projeté
  da_pct_revenue              NUMERIC,   -- amortissements en % du CA projeté
  tax_rate_pct                NUMERIC DEFAULT 25,  -- taux IS

  -- Hypothèses SaaS (optionnelles, pour dossiers récurrents)
  arr_growth_pct              NUMERIC,   -- croissance ARR (si différente du CA)

  notes                       TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION trg_fa_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fa_set_updated_at ON financial_assumptions;
CREATE TRIGGER fa_set_updated_at
  BEFORE UPDATE ON financial_assumptions
  FOR EACH ROW EXECUTE FUNCTION trg_fa_set_updated_at();

ALTER TABLE financial_assumptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own financial_assumptions"
    ON financial_assumptions
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_fa_deal ON financial_assumptions(deal_id);

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v60') ON CONFLICT (version) DO NOTHING;

-- Vérifications :
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'financial_assumptions';
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE tablename = 'financial_assumptions';
