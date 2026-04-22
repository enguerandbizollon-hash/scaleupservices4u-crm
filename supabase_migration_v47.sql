-- V47 : Colonnes deals manquantes (crash fiche dossier)
--
-- Contexte : le wizard V44 et l'affichage V45 référencent des colonnes
-- documentées dans CLAUDE.md mais jamais ajoutées par une migration SQL
-- trackée :
--   - target_raise_amount (Fundraising) → crash runtime "column does not exist"
--   - job_title, required_seniority, required_location, required_remote,
--     salary_min, salary_max (Recrutement) → utilisées par updateDealAction
--     et le wizard, statut incertain en base.
--
-- Migration idempotente via ADD COLUMN IF NOT EXISTS : aucune régression
-- si une colonne existe déjà (cas possible sur `job_title` & co si elles
-- avaient été créées hors migrations trackées lors de phases antérieures).

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Fundraising — montant cible de la levée
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS target_raise_amount NUMERIC;

-- ═══════════════════════════════════════════════════════════════════════════
-- Recrutement — fiche de poste (utilisées par updateDealAction + wizard)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS job_title           TEXT;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS required_seniority  TEXT;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS required_location   TEXT;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS required_remote     TEXT;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS salary_min          NUMERIC;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS salary_max          NUMERIC;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Registre (garde-fou build)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v47') ON CONFLICT (version) DO NOTHING;

-- Vérification :
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'deals'
--    AND column_name IN (
--      'target_raise_amount', 'job_title', 'required_seniority',
--      'required_location', 'required_remote', 'salary_min', 'salary_max'
--    )
--  ORDER BY column_name;
