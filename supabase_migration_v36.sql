-- V36 : Dirigeant structuré + role_in_dossier + profil acquéreur

-- 1. Dirigeant sur deals
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS dirigeant_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dirigeant_nom TEXT,
  ADD COLUMN IF NOT EXISTS dirigeant_email TEXT,
  ADD COLUMN IF NOT EXISTS dirigeant_telephone TEXT,
  ADD COLUMN IF NOT EXISTS dirigeant_titre TEXT;

CREATE INDEX IF NOT EXISTS idx_deals_dirigeant ON deals(dirigeant_id) WHERE dirigeant_id IS NOT NULL;

-- 2. Rôle organisation dans le dossier (ajout colonne sur deal_organizations existante)
ALTER TABLE deal_organizations
  ADD COLUMN IF NOT EXISTS role_in_dossier TEXT DEFAULT 'autre',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Profil acquéreur sur organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS acquirer_type TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_motivations TEXT[],
  ADD COLUMN IF NOT EXISTS target_revenue_min NUMERIC,
  ADD COLUMN IF NOT EXISTS target_revenue_max NUMERIC,
  ADD COLUMN IF NOT EXISTS target_ebitda_min NUMERIC,
  ADD COLUMN IF NOT EXISTS target_ebitda_max NUMERIC,
  ADD COLUMN IF NOT EXISTS target_sectors TEXT[],
  ADD COLUMN IF NOT EXISTS target_geographies TEXT[],
  ADD COLUMN IF NOT EXISTS acquisition_history TEXT;
