-- V69 : fiche prospect 360 (Deal OS, chantier B2)
--
-- Demande d'Enguérand (2026-07-30) : « une vraie fiche client pour du M&A,
-- pertinente, globale et fiable, que le screening s'autoremplisse, que je
-- n'aie qu'à contrôler et pousser ».
--
-- La fiche univers gagne trois champs remplis par l'enrichissement unifié
-- (action enrichProspect360) : le site web trouvé par recherche web, et la
-- synthèse M&A rédigée par l'IA (activité, modèle, gouvernance, tendance
-- financière, angle d'approche, points d'attention), datée pour savoir si
-- elle est fraîche. L'IA propose, l'utilisateur contrôle : la synthèse est
-- un texte éditable, jamais une vérité cachée.

BEGIN;

ALTER TABLE univers_entreprises
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS synthese TEXT,
  ADD COLUMN IF NOT EXISTS synthese_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN univers_entreprises.website IS
  'Site web du prospect, trouvé par la recherche web de l''enrichissement 360 (vérifiable en un clic).';
COMMENT ON COLUMN univers_entreprises.synthese IS
  'Synthèse M&A rédigée par l''IA lors de l''enrichissement 360 : activité, modèle, gouvernance, tendance financière, angle d''approche, points d''attention. Sources : données de la fiche + recherche web + Pappers si disponible.';

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v69') ON CONFLICT (version) DO NOTHING;

-- ── Vérification post-application ───────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'univers_entreprises'
--     AND column_name IN ('website','synthese','synthese_updated_at');
