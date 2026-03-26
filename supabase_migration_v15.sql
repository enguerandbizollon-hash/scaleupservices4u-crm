-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION V15 — Matching Investisseurs + Simplification statuts orgs
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. CHAMPS INVESTISSEUR SUR ORGANISATIONS ─────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS investor_ticket_min   NUMERIC;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS investor_ticket_max   NUMERIC;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS investor_sectors      TEXT[] DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS investor_stages       TEXT[] DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS investor_geographies  TEXT[] DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS investor_thesis       TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS investor_source       TEXT DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_org_investor_sectors     ON organizations USING gin(investor_sectors);
CREATE INDEX IF NOT EXISTS idx_org_investor_stages      ON organizations USING gin(investor_stages);
CREATE INDEX IF NOT EXISTS idx_org_investor_geographies ON organizations USING gin(investor_geographies);

-- ── 2. CHAMPS STARTUP SUR DEALS ──────────────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_stage TEXT;

-- ── 3. SIMPLIFICATION BASE_STATUS ORGANISATIONS (3 valeurs) ─────────
-- Convertir toutes les anciennes valeurs vers les 3 nouvelles
UPDATE organizations SET base_status = 'active'     WHERE base_status IN ('qualified', 'priority');
UPDATE organizations SET base_status = 'inactive'   WHERE base_status IN ('excluded');
UPDATE organizations SET base_status = 'to_qualify' WHERE base_status IN ('dormant');
-- active, to_qualify, inactive restent inchangés

-- ── 4. RLS ───────────────────────────────────────────────────────────
-- Les policies RLS existantes couvrent déjà ces colonnes (user_id / FOR ALL)

-- ── 5. VUE HELPER MATCHING ───────────────────────────────────────────
CREATE OR REPLACE VIEW investor_profiles AS
SELECT
  id, name, organization_type, base_status,
  investor_ticket_min, investor_ticket_max,
  investor_sectors, investor_stages, investor_geographies,
  investor_thesis, investor_source, user_id
FROM organizations
WHERE organization_type IN ('investor','business_angel','family_office','corporate')
  AND base_status = 'active'
  AND (
    investor_ticket_min IS NOT NULL
    OR array_length(investor_sectors, 1) > 0
    OR array_length(investor_stages, 1) > 0
    OR array_length(investor_geographies, 1) > 0
  );
