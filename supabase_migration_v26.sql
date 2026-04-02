-- Migration V26 : Tags transversaux — filtres libres sur tous les objets CRM
-- Exécuter dans Supabase SQL Editor

-- ─────────────────────────────────────────────────────────────────
-- Nettoyage des tentatives partielles précédentes
-- (tables vides — aucune donnée à préserver)
-- ─────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS object_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- TABLE 1 : tags
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE tags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  category   TEXT        NOT NULL DEFAULT 'autre',
  color      TEXT        NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_tags_user_name ON tags(user_id, name);
CREATE INDEX        idx_tags_category  ON tags(category);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tags" ON tags
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- TABLE 2 : object_tags
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE object_tags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id      UUID        NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  object_type TEXT        NOT NULL,
  object_id   UUID        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_object_tags_unique ON object_tags(user_id, tag_id, object_type, object_id);
CREATE INDEX        idx_object_tags_object ON object_tags(object_type, object_id);
CREATE INDEX        idx_object_tags_tag_id ON object_tags(tag_id);

ALTER TABLE object_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own object_tags" ON object_tags
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- Vérification
-- ─────────────────────────────────────────────────────────────────

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('tags', 'object_tags')
ORDER BY table_name;
-- Résultat attendu : 2 lignes (object_tags, tags)
