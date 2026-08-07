-- Migration v75 : cycle de vie du mandat + chasse buy-side.
--
-- Deux corrections de MODÈLE (conception 2026-08-05, arbitrée avec Enguérand) :
--
--  1. PORTE DE SIGNATURE. Un deal naît « ouvert » dès sa création depuis
--     l'univers (screening d'un cédant), donc AVANT toute signature. L'onglet
--     Mandats affichait alors des pré-mandats comme des mandats. On ajoute
--     `mandate_signed_at` (daté, NULL = pré-mandat, en préparation ; renseigné
--     = mandat signé). Pattern des colonnes datées de v73 : déterministe,
--     auditable, 100 % additif (aucun CHECK touché, deal_status inchangé).
--     Les deals EXISTANTS deviennent des pré-mandats (NULL) : on marque
--     ensuite ceux réellement signés (base purgée, impact quasi nul).
--
--  2. CHASSE RATTACHÉE À UN MANDAT (buy-side). Un client acquéreur peut
--     mandater une RECHERCHE de cible. Une chasse (screening_profiles) porte
--     alors `deal_id` = le mandat ma_buy servi. NULL = veille cédants globale
--     (l'existant). Les fiches univers trouvées héritent du lien via leur
--     source_profile_id : aucune colonne ajoutée sur univers_entreprises.
--
-- Idempotente. À appliquer dans Supabase SQL Editor AVANT tout push.

BEGIN;

-- ── 1. Porte de signature sur deals ─────────────────────────────────────────
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS mandate_signed_at TIMESTAMPTZ;

COMMENT ON COLUMN deals.mandate_signed_at IS
  'Date de signature du mandat. NULL = pré-mandat (en préparation, screening/pitch) ; renseigné = mandat signé. L''onglet Mandats montre le signé par défaut.';

-- Filtre fréquent (En préparation vs Signés) : index partiel sur le signé.
CREATE INDEX IF NOT EXISTS idx_deals_mandate_signed
  ON deals(mandate_signed_at)
  WHERE mandate_signed_at IS NOT NULL;

-- ── 2. Chasse rattachée à un mandat buy-side ────────────────────────────────
ALTER TABLE screening_profiles
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

COMMENT ON COLUMN screening_profiles.deal_id IS
  'Mandat ma_buy servi par cette chasse (recherche de cible pour un client acquéreur). NULL = veille cédants globale. Les fiches univers trouvées héritent du lien via source_profile_id.';

CREATE INDEX IF NOT EXISTS idx_screening_profiles_deal
  ON screening_profiles(deal_id)
  WHERE deal_id IS NOT NULL;

COMMIT;

INSERT INTO _crm_migrations_applied (version) VALUES ('v75') ON CONFLICT (version) DO NOTHING;
