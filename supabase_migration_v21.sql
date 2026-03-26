-- Migration V21 : M5 Connexions CRM
-- Exécuter dans Supabase SQL Editor

-- Signalement "à revoir" et fee de placement sur deal_candidates
ALTER TABLE deal_candidates ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
ALTER TABLE deal_candidates ADD COLUMN IF NOT EXISTS placement_fee NUMERIC;
