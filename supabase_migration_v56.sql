-- V56 : M2a — Socle Vivier proactif
--
-- Installe les tables nécessaires pour que le CRM propose des cibles
-- (organisations + contacts) enrichies depuis des connecteurs externes
-- (Apollo, Harmonic, Vibe) avec scoring algorithmique et IA.
--
-- Deux tables :
--
--   1. deal_target_suggestions : suggestions de cibles pour un dossier
--      avec score algo + score IA + explication + red flags + statut
--      de workflow (suggested / approved / rejected / deferred / contacted).
--      Unicité logique : un (deal, organization) ne peut avoir qu'une
--      suggestion active (non rejected / contacted).
--
--   2. connector_runs : traçabilité fine de chaque appel vers un
--      connecteur externe (paramètres, résultats, erreurs, coût
--      estimé). Indispensable pour debug, alerting, contrôle budget.
--
-- Non-régression : tables nouvelles, zéro impact sur l'existant.
-- RLS appliquée (pattern auth.uid() = user_id). Foreign keys explicites
-- avec ON DELETE RESTRICT pour les références métier (deal, org) et
-- SET NULL pour les références informationnelles (reviewed_by, contact).

BEGIN;

-- =========================================================================
-- 1. TABLE : deal_target_suggestions
-- =========================================================================

CREATE TABLE IF NOT EXISTS deal_target_suggestions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Cibles du lien
  deal_id                     UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  organization_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id                  UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Contexte de la suggestion
  role_suggested              TEXT NOT NULL DEFAULT 'target',
  source_connector            TEXT NOT NULL DEFAULT 'manual',
  external_reference          TEXT,
  suggestion_batch_id         UUID,

  -- Scoring
  score_algo                  NUMERIC,
  score_ai                    NUMERIC,
  score_combined              NUMERIC,
  score_breakdown             JSONB,

  -- Output IA
  ai_explanation              TEXT,
  ai_red_flags                TEXT[] DEFAULT '{}',
  ai_confidence               NUMERIC,

  -- Workflow
  status                      TEXT NOT NULL DEFAULT 'suggested',
  reviewed_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at                 TIMESTAMPTZ,
  reviewed_notes              TEXT,

  -- Sortie : brief d'outreach IA (Module 3)
  outreach_brief              TEXT,
  outreach_brief_generated_at TIMESTAMPTZ,
  contacted_via_campaign_id   UUID,

  -- Audit
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CHECK constraints idempotentes (DROP IF EXISTS + ADD)
ALTER TABLE deal_target_suggestions DROP CONSTRAINT IF EXISTS dts_status_check;
ALTER TABLE deal_target_suggestions ADD CONSTRAINT dts_status_check
  CHECK (status IN ('suggested','approved','rejected','deferred','contacted'));

ALTER TABLE deal_target_suggestions DROP CONSTRAINT IF EXISTS dts_role_check;
ALTER TABLE deal_target_suggestions ADD CONSTRAINT dts_role_check
  CHECK (role_suggested IN ('target','acquirer','investor','candidate','partner','other'));

ALTER TABLE deal_target_suggestions DROP CONSTRAINT IF EXISTS dts_source_check;
ALTER TABLE deal_target_suggestions ADD CONSTRAINT dts_source_check
  CHECK (source_connector IN ('apollo','harmonic','vibe','pappers','insee','manual','ai','portal'));

-- Unicité : une seule suggestion active par (deal, organization).
-- Les suggestions rejected/contacted sont archivables, pas bloquantes.
CREATE UNIQUE INDEX IF NOT EXISTS dts_unique_active
  ON deal_target_suggestions(deal_id, organization_id)
  WHERE status NOT IN ('rejected','contacted');

-- Index de performance pour requêtes UI
CREATE INDEX IF NOT EXISTS idx_dts_deal_status   ON deal_target_suggestions(deal_id, status);
CREATE INDEX IF NOT EXISTS idx_dts_user_status   ON deal_target_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_dts_source        ON deal_target_suggestions(source_connector);
CREATE INDEX IF NOT EXISTS idx_dts_batch         ON deal_target_suggestions(suggestion_batch_id)
  WHERE suggestion_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dts_created_desc  ON deal_target_suggestions(created_at DESC);

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION trg_dts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dts_set_updated_at ON deal_target_suggestions;
CREATE TRIGGER dts_set_updated_at
  BEFORE UPDATE ON deal_target_suggestions
  FOR EACH ROW EXECUTE FUNCTION trg_dts_set_updated_at();

-- RLS
ALTER TABLE deal_target_suggestions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own deal_target_suggestions"
    ON deal_target_suggestions
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================================
-- 2. TABLE : connector_runs (traçabilité appels API externes)
-- =========================================================================

CREATE TABLE IF NOT EXISTS connector_runs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_connector     TEXT NOT NULL,
  deal_id              UUID REFERENCES deals(id) ON DELETE SET NULL,
  triggered_by         TEXT NOT NULL DEFAULT 'manual',

  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at         TIMESTAMPTZ,
  status               TEXT NOT NULL DEFAULT 'running',

  -- Compteurs résultats
  records_fetched      INTEGER DEFAULT 0,
  records_created      INTEGER DEFAULT 0,
  records_updated      INTEGER DEFAULT 0,
  records_skipped      INTEGER DEFAULT 0,
  suggestions_created  INTEGER DEFAULT 0,

  -- Debug
  query_params         JSONB,
  error_message        TEXT,
  cost_estimate        NUMERIC
);

ALTER TABLE connector_runs DROP CONSTRAINT IF EXISTS cr_status_check;
ALTER TABLE connector_runs ADD CONSTRAINT cr_status_check
  CHECK (status IN ('running','success','failure','partial'));

ALTER TABLE connector_runs DROP CONSTRAINT IF EXISTS cr_source_check;
ALTER TABLE connector_runs ADD CONSTRAINT cr_source_check
  CHECK (source_connector IN ('apollo','harmonic','vibe','pappers','insee','gmail','ai'));

ALTER TABLE connector_runs DROP CONSTRAINT IF EXISTS cr_trigger_check;
ALTER TABLE connector_runs ADD CONSTRAINT cr_trigger_check
  CHECK (triggered_by IN ('manual','cron','api'));

CREATE INDEX IF NOT EXISTS idx_cr_user_started ON connector_runs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cr_source       ON connector_runs(source_connector, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cr_deal         ON connector_runs(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cr_status_err   ON connector_runs(status) WHERE status IN ('failure','partial');

ALTER TABLE connector_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own connector_runs"
    ON connector_runs
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- =========================================================================
-- Registre (garde-fou build)
-- =========================================================================

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v56') ON CONFLICT (version) DO NOTHING;

-- =========================================================================
-- Vérifications :
--
-- Tables créées :
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public'
--    AND table_name IN ('deal_target_suggestions','connector_runs');
--
-- Contraintes CHECK :
-- SELECT constraint_name FROM information_schema.table_constraints
--  WHERE table_name IN ('deal_target_suggestions','connector_runs')
--    AND constraint_type = 'CHECK';
--
-- RLS activées :
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE tablename IN ('deal_target_suggestions','connector_runs');
--
-- Index critiques :
-- SELECT indexname FROM pg_indexes
--  WHERE tablename = 'deal_target_suggestions'
--  ORDER BY indexname;
