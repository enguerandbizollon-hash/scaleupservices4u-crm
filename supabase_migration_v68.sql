-- V68 : actionnariat (bénéficiaires effectifs Pappers) — Deal OS, chantier B
--
-- Donnée décisive demandée en recette (2026-07-30) : « l'actionnariat
-- (âge, répartition) et l'aspect financier ». Source : API Pappers,
-- endpoint /entreprise, champ beneficiaires_effectifs (accès BE accordé
-- aux professionnels sur demande, pourcentages directs + indirects).
--
-- Stockage JSONB normalisé, même forme sur les deux tables :
--   [{ nom, prenom, date_de_naissance, age, pourcentage_parts,
--      pourcentage_parts_directes, pourcentage_parts_indirectes,
--      pourcentage_votes, representant_legal, nationalite }]
--
--   - univers_entreprises : l'amont (la fiche de prospection)
--   - organizations       : l'aval (la fiche permanente, lue par le dossier)
--
-- Les finances profondes Pappers (EBITDA/EBE, dettes, trésorerie...)
-- n'ont PAS de colonne dédiée : elles fusionnent dans le JSONB finances
-- existant de l'univers (extension de forme rétrocompatible) et dans la
-- table financial_data côté dossier. Décision « pas de doublon de vérité ».

BEGIN;

ALTER TABLE univers_entreprises
  ADD COLUMN IF NOT EXISTS actionnariat JSONB,
  ADD COLUMN IF NOT EXISTS actionnariat_updated_at TIMESTAMPTZ;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS actionnariat JSONB,
  ADD COLUMN IF NOT EXISTS actionnariat_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN univers_entreprises.actionnariat IS
  'Bénéficiaires effectifs normalisés (source Pappers) : répartition du capital et âges. Alimenté par enrichFicheFromPappers.';
COMMENT ON COLUMN organizations.actionnariat IS
  'Bénéficiaires effectifs normalisés (source Pappers), copiés depuis la fiche univers liée ou enrichis directement.';

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v68') ON CONFLICT (version) DO NOTHING;

-- ── Vérification post-application ───────────────────────────────────────────
-- SELECT table_name, column_name FROM information_schema.columns
--   WHERE column_name IN ('actionnariat','actionnariat_updated_at')
--   ORDER BY table_name;
