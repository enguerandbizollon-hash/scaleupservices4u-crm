-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION V19 — Module RH M4 : colonnes recrutement sur deals
-- ═══════════════════════════════════════════════════════════════════════

-- Profil de poste pour les dossiers de type recruitment
ALTER TABLE deals ADD COLUMN IF NOT EXISTS job_title          TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS required_seniority TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS required_location  TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS required_remote    TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS salary_min         NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS salary_max         NUMERIC;

-- Index sur deal_type pour les requêtes matching (filtrer recruitment uniquement)
CREATE INDEX IF NOT EXISTS idx_deals_type ON deals(deal_type);
