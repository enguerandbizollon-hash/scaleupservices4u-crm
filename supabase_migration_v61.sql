-- V61 : Score IA décomposé + anomalies détectées
--
-- L'analyse IA financière retourne déjà un breakdown détaillé
-- (growth/margin/balance/comparables) et peut signaler des anomalies
-- (EBITDA aberrant, marges incohérentes, etc.). On persiste ces 5
-- éléments pour qu'ils restent visibles entre les sessions sans
-- nécessiter une nouvelle analyse.
--
-- Idempotente. Pas d'impact sur les modules livrés (colonnes nullable).

BEGIN;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS ai_score_growth NUMERIC;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS ai_score_margin NUMERIC;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS ai_score_balance NUMERIC;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS ai_score_comparables NUMERIC;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS ai_anomalies TEXT[];

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v61') ON CONFLICT (version) DO NOTHING;
