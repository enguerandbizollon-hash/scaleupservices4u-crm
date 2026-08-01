-- Migration v74 : Information Memorandum (plan R1 lot 6).
-- Pattern teaser (v70) : contenu structuré JSONB porté par le dossier,
-- page imprimable, régénérable à volonté. L'IM est NOMINATIF et diffusé
-- sous NDA uniquement (bandeau de confidentialité dans le rendu).
-- Idempotente. À appliquer dans Supabase SQL Editor AVANT tout push.

BEGIN;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS im_content JSONB,
  ADD COLUMN IF NOT EXISTS im_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN deals.im_content IS
  'Information Memorandum structuré (lib/ai/im-engine.ts). Nominatif, diffusion sous NDA uniquement.';

COMMIT;

INSERT INTO _crm_migrations_applied (version) VALUES ('v74') ON CONFLICT (version) DO NOTHING;
