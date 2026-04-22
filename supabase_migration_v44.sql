-- V44 : Fix typage wizard de création dossier
--
-- Deux corrections de schéma `deals` pour aligner la base sur les besoins
-- métier identifiés en conditions réelles :
--
--   1. management_retention (BOOLEAN) reste un flag utilisé par le scoring
--      M&A (lib/crm/ma-scoring.ts). On ajoute management_retention_notes TEXT
--      pour capturer les conditions libres (earn-out, durée, clauses).
--
--   2. current_investors passe de TEXT à TEXT[] pour permettre un matching
--      investisseur par investisseur (cohérent avec target_sectors[],
--      excluded_sectors[], target_geographies[] déjà en TEXT[] depuis v25).

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. management_retention_notes (TEXT libre)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS management_retention_notes TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. current_investors : conversion TEXT → TEXT[] (idempotent)
--
-- On vérifie le type actuel avant d'agir : si déjà en ARRAY, on ne fait rien.
-- Backfill : split par virgule, trim, suppression des éléments vides.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  current_dtype TEXT;
BEGIN
  SELECT data_type
    INTO current_dtype
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'deals'
     AND column_name  = 'current_investors';

  -- Si TEXT scalaire, on convertit vers TEXT[].
  -- Si ARRAY ou NULL (absence), on saute.
  IF current_dtype = 'text' THEN
    -- Colonne temporaire de remplacement
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS current_investors_new TEXT[];

    -- Backfill depuis la chaîne "a, b, c" vers {a,b,c}
    UPDATE deals d
       SET current_investors_new = ARRAY(
             SELECT trim(elem)
               FROM unnest(string_to_array(d.current_investors, ',')) AS elem
              WHERE trim(elem) <> ''
           )
     WHERE d.current_investors IS NOT NULL
       AND d.current_investors <> '';

    -- Remplacement
    ALTER TABLE deals DROP COLUMN current_investors;
    ALTER TABLE deals RENAME COLUMN current_investors_new TO current_investors;
  END IF;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Registre (garde-fou build)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v44') ON CONFLICT (version) DO NOTHING;

-- Vérification :
-- SELECT data_type, udt_name FROM information_schema.columns
--  WHERE table_name = 'deals' AND column_name IN ('current_investors','management_retention_notes');
