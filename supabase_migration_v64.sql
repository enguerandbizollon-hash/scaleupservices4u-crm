-- V64 : SIREN et NAF structurés sur organizations (pivot M&A small cap)
--
-- Contexte : le SIREN récupéré par l'enrichissement INSEE / Recherche
-- d'Entreprises n'était persisté nulle part de façon exploitable. Il était
-- concaténé en texte libre dans organizations.description
-- ("SIREN : 123456789"), avec un commentaire explicite dans
-- actions/organisations.ts : "workaround : pas de colonne dédiée pour
-- l'instant — à formaliser si besoin via migration". C'est cette migration.
--
-- Pourquoi c'est structurant :
--   - le SIREN est LA clé pivot de la phase 2 (ingestion BODACC, webhooks
--     Pappers, table signaux). Sans colonne indexée, pas de jointure possible.
--   - le NAF permet le rattachement automatique à un secteur du référentiel
--     (lib/crm/matching-maps.ts → sectorFromNaf) et le screening par division
--     NAF prévu en phase 2.
--   - la déduplication par SIREN est bien plus fiable que par nom normalisé
--     ou domaine web (deux enseignes peuvent partager un nom, jamais un SIREN).
--
-- Choix : PAS de contrainte UNIQUE sur siren. La dédup reste applicative
-- (même parti pris que normalized_name), pour ne pas faire échouer un import
-- en masse sur un doublon et laisser l'utilisateur arbitrer la fusion.
--
-- Backfill best-effort depuis description (les fiches déjà enrichies portent
-- "SIREN : NNNNNNNNN") et depuis external_ids si la clé y a été posée.
-- Idempotente. Colonnes nullable, aucun impact sur les modules livrés.

BEGIN;

-- ── 1. Colonnes ─────────────────────────────────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS siren TEXT;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS naf TEXT;

COMMENT ON COLUMN organizations.siren IS
  'SIREN à 9 chiffres, sans espaces. Clé pivot pour BODACC / Pappers (phase 2).';
COMMENT ON COLUMN organizations.naf IS
  'Code NAF/APE rév. 2 (ex. 43.21A). Division = 2 premiers chiffres, mappée vers un secteur par sectorFromNaf().';

-- ── 2. Index ────────────────────────────────────────────────────────────────
-- Partiels : la grande majorité des organisations n'aura pas de SIREN
-- (contacts étrangers, fonds, prospects non identifiés).

CREATE INDEX IF NOT EXISTS idx_organizations_siren
  ON organizations(siren) WHERE siren IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_naf
  ON organizations(naf) WHERE naf IS NOT NULL;

-- Recherche par utilisateur + SIREN (chemin de la dédup applicative)
CREATE INDEX IF NOT EXISTS idx_organizations_user_siren
  ON organizations(user_id, siren) WHERE siren IS NOT NULL;

-- ── 3. Backfill depuis external_ids ─────────────────────────────────────────
-- Si une clé siren / insee a été posée dans le JSONB par un connecteur.

UPDATE organizations
   SET siren = regexp_replace(external_ids->>'siren', '[^0-9]', '', 'g')
 WHERE siren IS NULL
   AND external_ids ? 'siren'
   AND regexp_replace(external_ids->>'siren', '[^0-9]', '', 'g') ~ '^[0-9]{9}$';

UPDATE organizations
   SET siren = regexp_replace(external_ids->>'insee', '[^0-9]', '', 'g')
 WHERE siren IS NULL
   AND external_ids ? 'insee'
   AND regexp_replace(external_ids->>'insee', '[^0-9]', '', 'g') ~ '^[0-9]{9}$';

-- ── 4. Backfill depuis description ──────────────────────────────────────────
-- Récupère les SIREN écrits en texte libre par l'ancien enrichissement INSEE.
-- Motif produit par actions/organisations.ts : "SIREN : 123456789".

UPDATE organizations
   SET siren = regexp_replace(
                 substring(description from 'SIREN\s*:\s*([0-9][0-9 ]{8,})'),
                 '[^0-9]', '', 'g')
 WHERE siren IS NULL
   AND description IS NOT NULL
   AND description ~ 'SIREN\s*:\s*[0-9]';

-- Nettoyage : ne garder que les SIREN réellement à 9 chiffres
UPDATE organizations
   SET siren = NULL
 WHERE siren IS NOT NULL
   AND siren !~ '^[0-9]{9}$';

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v64') ON CONFLICT (version) DO NOTHING;

-- ── Vérification post-application ───────────────────────────────────────────
-- SELECT count(*) FILTER (WHERE siren IS NOT NULL) AS avec_siren,
--        count(*) FILTER (WHERE naf   IS NOT NULL) AS avec_naf,
--        count(*) AS total
--   FROM organizations;
