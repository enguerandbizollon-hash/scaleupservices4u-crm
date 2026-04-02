-- Migration V25 : Correction deal_status — alignement avec CLAUDE.md
-- Valeurs CLAUDE.md : open | won | lost | paused
-- Anciennes valeurs en base : active | inactive | closed
-- Exécuter dans Supabase SQL Editor

-- ─────────────────────────────────────────────────────────────────
-- 1. Renommer les anciennes valeurs deal_status
-- ─────────────────────────────────────────────────────────────────

-- active  → open  (dossier en cours)
UPDATE deals SET deal_status = 'open'   WHERE deal_status = 'active';

-- inactive → lost  (dossier abandonné / non abouti)
UPDATE deals SET deal_status = 'lost'   WHERE deal_status = 'inactive';

-- closed   → won   (dossier closé avec succès)
UPDATE deals SET deal_status = 'won'    WHERE deal_status = 'closed';

-- ─────────────────────────────────────────────────────────────────
-- 2. Vérification post-migration
-- ─────────────────────────────────────────────────────────────────

-- Doit retourner 0 — aucun résidu d'anciennes valeurs
SELECT COUNT(*) AS residus_anciens
FROM deals
WHERE deal_status NOT IN ('open', 'won', 'lost', 'paused');

-- Distribution des statuts après migration
SELECT deal_status, COUNT(*) AS nb
FROM deals
GROUP BY deal_status
ORDER BY nb DESC;

-- ─────────────────────────────────────────────────────────────────
-- 3. Ajout contrainte CHECK pour garantir la cohérence future
-- ─────────────────────────────────────────────────────────────────

-- Supprimer si existe déjà (idempotent)
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_deal_status_check;

-- Nouvelle contrainte
ALTER TABLE deals ADD CONSTRAINT deals_deal_status_check
  CHECK (deal_status IN ('open', 'won', 'lost', 'paused'));

-- ─────────────────────────────────────────────────────────────────
-- 4. Colonnes manquantes sur deals (pour mandats + M&A)
-- ─────────────────────────────────────────────────────────────────

-- FK mandate_id (un deal peut être rattaché à un mandat)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS mandate_id UUID REFERENCES mandates(id) ON DELETE SET NULL;

-- Colonnes M&A Sell-side
ALTER TABLE deals ADD COLUMN IF NOT EXISTS asking_price_min          NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS asking_price_max          NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS partial_sale_ok           BOOLEAN DEFAULT TRUE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS management_retention      BOOLEAN DEFAULT TRUE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_timing               TEXT;   -- now|6months|1year|2years+
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_financial_score        NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_valuation_low          NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_valuation_high         NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_financial_notes        TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_analyzed_at            TIMESTAMPTZ;

-- Colonnes M&A Buy-side
ALTER TABLE deals ADD COLUMN IF NOT EXISTS target_sectors            TEXT[]  DEFAULT '{}';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS target_geographies        TEXT[]  DEFAULT '{}';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS target_revenue_min        NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS target_revenue_max        NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS target_ev_min             NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS target_ev_max             NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS acquisition_budget_min    NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS acquisition_budget_max    NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS full_acquisition_required BOOLEAN DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS strategic_rationale       TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS excluded_sectors          TEXT[]  DEFAULT '{}';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS excluded_geographies      TEXT[]  DEFAULT '{}';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS target_stage              TEXT;   -- startup|pme|eti|grand_groupe

-- Colonnes Fundraising
ALTER TABLE deals ADD COLUMN IF NOT EXISTS pre_money_valuation       NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS post_money_valuation      NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS use_of_funds              TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS runway_months             INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS current_investors         TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS round_type                TEXT;   -- seed|pre-series-a|series-a|...

-- ─────────────────────────────────────────────────────────────────
-- 5. Index FK mandate_id
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_deals_mandate_id   ON deals(mandate_id);
CREATE INDEX IF NOT EXISTS idx_deals_deal_status  ON deals(deal_status);
CREATE INDEX IF NOT EXISTS idx_deals_deal_type    ON deals(deal_type);

-- ─────────────────────────────────────────────────────────────────
-- FIN — Résultat attendu :
-- - 0 ligne avec deal_status NOT IN ('open','won','lost','paused')
-- - Contrainte CHECK active
-- - Colonnes M&A + Fundraising disponibles
-- ─────────────────────────────────────────────────────────────────
