-- V53 : Screening qualifie du dossier (Module 1 ouverture au monde)
--
-- Ajoute a `deals` les champs necessaires pour qualifier et valider un dossier
-- avant tout outreach proactif. Hard gate sur le Module 2 (suggestions
-- connecteurs) et Module 3 (campagnes) : seuls les dossiers en
-- screening_status = 'ready_for_outreach' declenchent ces flux.
--
-- Colonnes narratives :
--   executive_summary       pitch 3 a 5 lignes lisible par un tiers
--   key_differentiators     differenciateurs cles
--   key_risks               red flags et points d'attention
--   competitive_landscape   concurrence
--   market_context          contexte marche
--   motivation_narrative    pourquoi cette operation maintenant
--
-- Gouvernance screening :
--   screening_status        not_started | drafting | ready_for_outreach | on_hold
--   screening_score         completude + validation (0 a 100)
--   screening_validated_by  user ayant valide
--   screening_validated_at  timestamp de validation
--   screening_updated_at    derniere mise a jour, pour detecter obsolescence
--
-- Non regression :
--   `strategic_rationale` (v25, M&A buy-side) est conserve sans changement.
--   executive_summary est distinct : pitch de la societe concernee par le
--   dossier, pas la logique strategique d'acquisition d'un mandat buy-side.
--   Tous les champs sont nullable. Les dossiers existants basculent a
--   screening_status = 'not_started' via DEFAULT.

BEGIN;

-- =========================================================================
-- 1. Colonnes narratives screening
-- =========================================================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS executive_summary     TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS key_differentiators   TEXT[] DEFAULT '{}';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS key_risks             TEXT[] DEFAULT '{}';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS competitive_landscape TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS market_context        TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS motivation_narrative  TEXT;

-- =========================================================================
-- 2. Gouvernance screening
-- =========================================================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_status       TEXT DEFAULT 'not_started';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_score        NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_validated_by UUID;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_validated_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_updated_at   TIMESTAMPTZ;

-- Garantir que les lignes pre-existantes ont bien 'not_started'
-- (DEFAULT ne s'applique qu'aux nouvelles lignes sans backfill).
UPDATE deals
   SET screening_status = 'not_started'
 WHERE screening_status IS NULL;

-- =========================================================================
-- 3. Contrainte CHECK idempotente sur screening_status
-- =========================================================================

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_screening_status_check;
ALTER TABLE deals ADD CONSTRAINT deals_screening_status_check
  CHECK (screening_status IN (
    'not_started',
    'drafting',
    'ready_for_outreach',
    'on_hold'
  ));

-- =========================================================================
-- 4. Index pour filtrage dashboard et gate matching proactif
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_deals_screening_status
  ON deals(screening_status);

COMMIT;

-- =========================================================================
-- Registre (garde-fou build)
-- =========================================================================

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v53') ON CONFLICT (version) DO NOTHING;

-- Verifications apres execution :
--
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'deals'
--    AND column_name IN (
--      'executive_summary','key_differentiators','key_risks',
--      'competitive_landscape','market_context','motivation_narrative',
--      'screening_status','screening_score','screening_validated_by',
--      'screening_validated_at','screening_updated_at'
--    )
--  ORDER BY column_name;
--
-- SELECT COUNT(*) AS not_started_count
--   FROM deals
--  WHERE screening_status = 'not_started';
--
-- SELECT constraint_name
--   FROM information_schema.table_constraints
--  WHERE table_name = 'deals'
--    AND constraint_name = 'deals_screening_status_check';
--
-- SELECT indexname FROM pg_indexes
--  WHERE tablename = 'deals' AND indexname = 'idx_deals_screening_status';
