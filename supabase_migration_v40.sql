-- V40 : Registre des migrations appliquées
-- Source de vérité côté DB pour garantir qu'aucune migration locale
-- n'est oubliée. Le script scripts/check-migrations.mjs lit cette
-- table au prebuild Vercel et échoue si un fichier local
-- supabase_migration_vN.sql n'a pas sa ligne enregistrée.
--
-- Convention à partir de v41 : chaque migration termine par
--   INSERT INTO _crm_migrations_applied (version)
--     VALUES ('vN') ON CONFLICT DO NOTHING;

BEGIN;
  CREATE TABLE IF NOT EXISTS _crm_migrations_applied (
    version    TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT now(),
    notes      TEXT
  );

  -- RLS : lecture publique (simple compteur de versions, non sensible)
  -- Écriture restreinte au service_role (via SQL Editor, pas via l'app).
  ALTER TABLE _crm_migrations_applied ENABLE ROW LEVEL SECURITY;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = '_crm_migrations_applied'
        AND policyname = 'Read migrations registry'
    ) THEN
      CREATE POLICY "Read migrations registry"
        ON _crm_migrations_applied
        FOR SELECT
        USING (true);
    END IF;
  END $$;

  -- Rétroactif : enregistre les migrations antérieures supposées
  -- appliquées. Si l'audit SQL montre qu'une v3x manque réellement en DB,
  -- applique-la d'abord (son fichier est idempotent), puis relance ce bloc.
  INSERT INTO _crm_migrations_applied (version, notes) VALUES
    ('v23', 'rétroactif'),
    ('v24', 'rétroactif'),
    ('v25', 'rétroactif'),
    ('v26', 'rétroactif'),
    ('v27', 'rétroactif'),
    ('v28', 'rétroactif'),
    ('v29', 'rétroactif'),
    ('v30', 'rétroactif'),
    ('v31', 'rétroactif'),
    ('v32', 'rétroactif'),
    ('v33', 'rétroactif'),
    ('v34', 'rétroactif'),
    ('v35', 'rétroactif'),
    ('v36', 'rétroactif'),
    ('v37', 'rétroactif'),
    ('v38', 'rétroactif'),
    ('v39', 'rétroactif - appliquée manuellement 22/04'),
    ('v40', 'initialisation du registre')
  ON CONFLICT (version) DO NOTHING;
COMMIT;
