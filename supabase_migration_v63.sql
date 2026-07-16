-- V63 : Persistance du plan de sourcing IA + sites web à consulter
--
-- Le plan de sourcing généré par Claude (segments, mots-clés, géos,
-- exclusions, signaux) était stocké uniquement en state React et perdu
-- au refresh. L'utilisateur devait régénérer (payant) à chaque session.
--
-- Persistance :
--   - sourcing_plan_json (JSONB) : SourcingPlan complet sérialisé
--   - sourcing_plan_generated_at : pour afficher la fraîcheur
--   - sourcing_plan_source : ai | manual | edited (= IA puis retouchée)
--   - sourcing_urls_to_consult : sites web spécifiques que l'utilisateur
--     veut faire consulter par l'IA / le sourcing (bonus refonte sourcing)
--
-- Idempotente. Pas d'impact sur les modules livrés (colonnes nullable).
-- jsonb autorisé exceptionnellement ici : le plan est consommé en bloc
-- (non requêté par champs internes filtrables).

BEGIN;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS sourcing_plan_json JSONB;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS sourcing_plan_generated_at TIMESTAMPTZ;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS sourcing_plan_source TEXT;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS sourcing_urls_to_consult TEXT[];

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_sourcing_plan_source_check;
ALTER TABLE deals ADD CONSTRAINT deals_sourcing_plan_source_check
  CHECK (sourcing_plan_source IS NULL
         OR sourcing_plan_source IN ('ai','manual','edited','fallback'));

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v63') ON CONFLICT (version) DO NOTHING;
