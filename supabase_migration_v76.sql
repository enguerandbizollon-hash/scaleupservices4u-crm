-- Migration v76 : fiche de cadrage buy-side (recherche de cible).
--
-- Un mandat d'acquisition (deal ma_buy) reçoit une FICHE DE CADRAGE : le
-- brief du repreneur (secteurs/NAF, CA, géo, âge dirigeant, conditions,
-- apport). L'IA l'extrait du PDF uploadé (pattern extract-document /
-- teaser-engine), le résultat structuré est porté par le dossier
-- (cadrage_content, comme teaser_content v70 et im_content v74), puis
-- APPLIQUÉ au geste : critères cibles du dossier + chasse rattachée
-- pré-remplie. L'outil PROPOSE, Enguérand DISPOSE.
--
-- Idempotente. À appliquer dans Supabase SQL Editor AVANT tout push.

BEGIN;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS cadrage_content JSONB,
  ADD COLUMN IF NOT EXISTS cadrage_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN deals.cadrage_content IS
  'Fiche de cadrage buy-side extraite par l''IA (lib/ai/cadrage-engine.ts) : secteurs, naf_codes, ca_min/max, departements, age dirigeant, conditions, apport. Proposé, appliqué au geste sur les critères ma_buy + une chasse rattachée.';

COMMIT;

INSERT INTO _crm_migrations_applied (version) VALUES ('v76') ON CONFLICT (version) DO NOTHING;
