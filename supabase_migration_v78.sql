-- Migration v78 : profil de reprise anonyme (livrable buy-side).
--
-- Pendant EXACT du teaser (v70) pour un mandat d'acquisition : une page
-- ANONYME qui presente le repreneur et son projet aux dirigeants de cibles
-- approchees, sans reveler son identite (l'IA genere, le code scrubbe le
-- nom, pattern teaser-engine). Contenu structure JSONB porte par le
-- dossier, page imprimable, regenerable a volonte.
--
-- Idempotente. A appliquer dans Supabase SQL Editor AVANT tout push.

BEGIN;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS profil_reprise_content JSONB,
  ADD COLUMN IF NOT EXISTS profil_reprise_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN deals.profil_reprise_content IS
  'Profil de reprise anonyme structure (lib/ai/profil-reprise-engine.ts) : le repreneur et son projet presentes aux cedants approches, identite scrubbee par le code. Pendant buy du teaser_content.';

COMMIT;

INSERT INTO _crm_migrations_applied (version) VALUES ('v78') ON CONFLICT (version) DO NOTHING;
