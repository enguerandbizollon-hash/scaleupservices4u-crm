-- Migration V23 : Refonte organisations — profil entreprise + M&A + enrichissement
-- Exécuter dans Supabase SQL Editor

-- ── Profil entreprise (client, prospect, cible M&A, repreneur) ───────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS founded_year    INTEGER;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS employee_count  INTEGER;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS company_stage   TEXT;    -- startup|pme|eti|grand_groupe
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS revenue_range   TEXT;    -- <1M|1M-5M|5M-20M|20M-100M|>100M

-- ── Profil M&A vendeur (type = target) ───────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sale_readiness   TEXT DEFAULT 'not_for_sale'; -- not_for_sale|open|actively_selling
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS partial_sale_ok  BOOLEAN DEFAULT TRUE;

-- ── Profil M&A acquéreur (type = buyer) ──────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS acquisition_rationale TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS target_sectors        TEXT[] DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS target_geographies    TEXT[] DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS target_revenue_min    NUMERIC;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS target_revenue_max    NUMERIC;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS excluded_sectors      TEXT[] DEFAULT '{}';

-- ── Enrichissement connecteurs ────────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS source              TEXT DEFAULT 'manual';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS external_id         TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enriched_at         TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enriched_by_source  TEXT;

-- ── Index ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orgs_type         ON organizations(organization_type);
CREATE INDEX IF NOT EXISTS idx_orgs_stage        ON organizations(company_stage);
CREATE INDEX IF NOT EXISTS idx_orgs_sale_ready   ON organizations(sale_readiness);
