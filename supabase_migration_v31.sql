-- V31 : Déduplication organisations
-- Colonnes : normalized_name, is_merged, merged_into_id
-- Trigger : auto-génère normalized_name à l'insert/update

BEGIN;

-- Colonnes de déduplication
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS normalized_name TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_merged BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Index pour recherche rapide de doublons
CREATE INDEX IF NOT EXISTS idx_orgs_normalized_name ON organizations(normalized_name);
CREATE INDEX IF NOT EXISTS idx_orgs_website ON organizations(website);
CREATE INDEX IF NOT EXISTS idx_orgs_linkedin_url ON organizations(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_orgs_is_merged ON organizations(is_merged) WHERE is_merged = false;

-- Fonction de normalisation : lowercase, sans accents, sans ponctuation
CREATE OR REPLACE FUNCTION normalize_org_name(name TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      translate(
        lower(trim(COALESCE(name, ''))),
        'àáâãäåèéêëìíîïòóôõöùúûüýÿñç',
        'aaaaaaeeeeiiiioooooouuuuyync'
      ),
      '[^a-z0-9\s]', '', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger : auto-update normalized_name
CREATE OR REPLACE FUNCTION trg_set_normalized_name() RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_name := normalize_org_name(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_normalized_name ON organizations;
CREATE TRIGGER tr_set_normalized_name
  BEFORE INSERT OR UPDATE OF name ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_normalized_name();

-- Peupler normalized_name pour les enregistrements existants
UPDATE organizations SET normalized_name = normalize_org_name(name)
WHERE normalized_name IS NULL;

COMMIT;

-- Vérification :
-- SELECT name, normalized_name FROM organizations LIMIT 10;
-- SELECT normalized_name, COUNT(*) FROM organizations
--   WHERE is_merged = false GROUP BY normalized_name HAVING COUNT(*) > 1;
