-- V28 : Ajout company_geography sur deals (matching géographique investisseurs)
-- Colonne utilisée par actions/matching.ts pour le scoring géo (15pts)

ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_geography TEXT;

CREATE INDEX IF NOT EXISTS idx_deals_company_geography ON deals(company_geography);

-- Vérification
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'company_geography';
