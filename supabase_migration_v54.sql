-- V54 : Clarification des relations Organisation / Mandat / Dossier
--
-- Contexte : aujourd'hui un dossier (deals) n'a aucune FK directe vers
-- organizations. Le sujet du dossier est deviné via deal.mandate_id
-- puis mandate.client_organization_id, OU via deal_organizations avec
-- role_in_dossier='client'. Deux chemins, pas de garantie, pas de source
-- unique de vérité.
--
-- Ce que cette migration installe :
--
--   1. deals.organization_id (FK organizations, nullable pour le moment)
--      = le sujet du dossier. Règle métier : si deal.mandate_id NOT NULL,
--      alors deal.organization_id = mandate.client_organization_id.
--      Le passage NOT NULL se fera en V54d après migration du wizard
--      et des Server Actions (V54b + V54c).
--
--   2. organizations.is_client BOOLEAN, calculé par trigger :
--      TRUE si l'org a au moins un mandat dont le status n'est pas 'draft'.
--      Permet de filtrer l'annuaire : clients vs prospects vs fonds vs
--      cibles vs réseau.
--
--   3. Backfill initial des deux colonnes à partir des données existantes.
--      Priorité pour deals.organization_id :
--        a. mandate.client_organization_id via deal.mandate_id
--        b. deal_organizations.organization_id where role_in_dossier='client'
--
--   4. Trigger de maintenance de is_client : s'exécute sur INSERT/UPDATE/
--      DELETE de mandates, met à jour l'org concernée.
--
-- Aucune régression : colonnes ajoutées nullable, deal_organizations
-- intact, matching / screening / fees inchangés. Les lignes
-- deal_organizations role='client' seront purgées en V54d uniquement après
-- que toutes les lectures soient migrées vers deal.organization_id.

BEGIN;

-- =========================================================================
-- 1. Colonnes nouvelles
-- =========================================================================

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_client BOOLEAN NOT NULL DEFAULT FALSE;

-- =========================================================================
-- 2. Index sur les nouvelles colonnes
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_deals_organization_id ON deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_orgs_is_client        ON organizations(is_client);

-- =========================================================================
-- 3. Backfill deals.organization_id
--    Priorite 1 : mandate.client_organization_id via deal.mandate_id
--    Priorite 2 : deal_organizations role_in_dossier = 'client'
-- =========================================================================

-- 3.1 Depuis les mandats rattaches
UPDATE deals d
   SET organization_id = m.client_organization_id
  FROM mandates m
 WHERE d.mandate_id = m.id
   AND d.organization_id IS NULL
   AND m.client_organization_id IS NOT NULL;

-- 3.2 Depuis deal_organizations role='client' (pour les dossiers sans mandat
--     rattache ou dont le mandat a ete cree apres le lien pivot)
UPDATE deals d
   SET organization_id = do2.organization_id
  FROM deal_organizations do2
 WHERE do2.deal_id = d.id
   AND do2.role_in_dossier = 'client'
   AND d.organization_id IS NULL;

-- =========================================================================
-- 4. Fonction de recalcul is_client pour une organisation donnee
--    TRUE si au moins un mandat non-draft rattache a cette org.
-- =========================================================================

CREATE OR REPLACE FUNCTION recompute_organization_is_client(org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE organizations o
     SET is_client = EXISTS (
           SELECT 1
             FROM mandates m
            WHERE m.client_organization_id = o.id
              AND m.status IS DISTINCT FROM 'draft'
         )
   WHERE o.id = org_id;
END;
$$;

-- =========================================================================
-- 5. Trigger de maintenance sur mandates
--    Lance recompute_organization_is_client pour l'org affectee par toute
--    operation INSERT, UPDATE ou DELETE sur mandates.
-- =========================================================================

CREATE OR REPLACE FUNCTION trg_mandates_update_org_is_client()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_organization_is_client(OLD.client_organization_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.client_organization_id IS DISTINCT FROM NEW.client_organization_id THEN
      PERFORM recompute_organization_is_client(OLD.client_organization_id);
    END IF;
    PERFORM recompute_organization_is_client(NEW.client_organization_id);
    RETURN NEW;
  ELSE
    PERFORM recompute_organization_is_client(NEW.client_organization_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS mandates_update_org_is_client ON mandates;
CREATE TRIGGER mandates_update_org_is_client
AFTER INSERT OR UPDATE OR DELETE ON mandates
FOR EACH ROW
EXECUTE FUNCTION trg_mandates_update_org_is_client();

-- =========================================================================
-- 6. Backfill initial is_client
-- =========================================================================

UPDATE organizations o
   SET is_client = EXISTS (
         SELECT 1
           FROM mandates m
          WHERE m.client_organization_id = o.id
            AND m.status IS DISTINCT FROM 'draft'
       );

COMMIT;

-- =========================================================================
-- Registre (garde-fou build)
-- =========================================================================

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v54') ON CONFLICT (version) DO NOTHING;

-- =========================================================================
-- Verifications apres execution :
--
-- Colonnes ajoutees :
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_name IN ('deals','organizations')
--    AND column_name IN ('organization_id','is_client');
--
-- Backfill deals :
-- SELECT COUNT(*) AS with_org, SUM(CASE WHEN organization_id IS NULL THEN 1 ELSE 0 END) AS without_org
--   FROM deals;
--
-- Backfill is_client :
-- SELECT COUNT(*) AS n_clients FROM organizations WHERE is_client = TRUE;
--
-- Verification coherence avec les mandats :
-- SELECT COUNT(DISTINCT m.client_organization_id) AS expected_clients
--   FROM mandates m
--  WHERE m.status IS DISTINCT FROM 'draft';
--
-- Trigger installe :
-- SELECT tgname FROM pg_trigger
--  WHERE tgname = 'mandates_update_org_is_client';
--
-- Dossiers orphelins (sans organization_id apres backfill, a investiguer) :
-- SELECT id, name, mandate_id FROM deals WHERE organization_id IS NULL;
