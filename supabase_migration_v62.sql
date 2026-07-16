-- V62 : Adresses structurées sur organizations
--
-- Le champ `location` (texte libre) existe déjà et reste utilisé pour
-- l'affichage compact (badge "Paris, France"). On ajoute en parallèle
-- une adresse structurée pour permettre :
--   - le filtrage géographique du sourcing/screening M&A
--   - le calcul de distance acquéreur ↔ cible (lat/lng)
--   - l'enrichissement automatique via géocodage Nominatim
--
-- `country` est créé avec IF NOT EXISTS car peut déjà exister dans
-- la table de base. Aucune migration de données : `location` reste,
-- la nouvelle UX préfère city + country pour la nouvelle saisie.
--
-- Idempotente. Pas d'impact sur les modules livrés.

BEGIN;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS address_formatted TEXT;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS geocode_source TEXT;  -- manual | nominatim | pappers | etc.

-- Index pour filtrage rapide par ville / pays / coords
CREATE INDEX IF NOT EXISTS idx_orgs_city ON organizations(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orgs_country ON organizations(country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orgs_coords ON organizations(latitude, longitude) WHERE latitude IS NOT NULL;

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v62') ON CONFLICT (version) DO NOTHING;
