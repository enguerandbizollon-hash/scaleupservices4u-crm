-- V70 : usine à livrables, passe 1 — le teaser (Deal OS, chantier C)
--
-- Le dossier porte son teaser anonymisé : contenu structuré généré par
-- l'IA (accroche, activité, chiffres clés, points forts, opération),
-- validé et ANONYMISÉ par code (le nom de la société et le SIREN sont
-- scrubbés après génération, jamais de confiance aveugle au modèle).
-- Rendu : page imprimable aux couleurs Vectis Finance, pattern export
-- existant, zéro dépendance. La liste d'acquéreurs, elle, se rend en
-- direct depuis le matching : pas de stockage, pas de colonne.

BEGIN;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS teaser_content JSONB,
  ADD COLUMN IF NOT EXISTS teaser_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN deals.teaser_content IS
  'Teaser anonymisé structuré : {titre, accroche, activite, chiffres_cles[], points_forts[], operation, localisation}. Généré par lib/ai/teaser-engine, anonymisation vérifiée par code.';

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v70') ON CONFLICT (version) DO NOTHING;

-- ── Vérification post-application ───────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'deals' AND column_name IN ('teaser_content','teaser_generated_at');
