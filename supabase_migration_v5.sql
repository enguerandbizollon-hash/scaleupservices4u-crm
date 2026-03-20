-- Colonne pour stocker le nom du dossier lié (hint pour la liaison rétroactive)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deal_name_hint TEXT;

-- Index pour accélérer le retrolink
CREATE INDEX IF NOT EXISTS idx_organizations_deal_hint ON organizations(deal_name_hint) WHERE deal_name_hint IS NOT NULL;

-- S'assurer que deal_organizations a la bonne contrainte unique
ALTER TABLE deal_organizations DROP CONSTRAINT IF EXISTS deal_organizations_deal_id_organization_id_key;
ALTER TABLE deal_organizations ADD CONSTRAINT IF NOT EXISTS deal_organizations_unique UNIQUE (deal_id, organization_id);
