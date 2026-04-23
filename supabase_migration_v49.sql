-- V49 : Module Dataroom intégré (bucket Storage + ma_documents enrichie)
--
-- Décision utilisateur : pas de données sensibles en DB de test, on remplace
-- l'ancien deal_documents (URL externes seulement, pas d'upload réel) par
-- le nouveau système ma_documents + Supabase Storage.
--
-- Ce que fait V49 :
--   1. Crée le bucket privé `deal-documents` dans Supabase Storage
--   2. Définit les policies RLS sur storage.objects (accès restreint au
--      user_id présent en 1er segment du path)
--   3. Enrichit ma_documents avec `category` et `document_status`
--   4. DROP TABLE deal_documents CASCADE (supprime aussi les données)
--
-- Non-régression : côté code, toutes les références à deal_documents
-- seront nettoyées dans le même commit V49. Cette migration doit être
-- appliquée AVANT de pusher le code.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Bucket Storage `deal-documents` (privé)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deal-documents',
  'deal-documents',
  false,  -- privé, accès via URL signée uniquement
  52428800,  -- 50 MB par fichier
  NULL       -- MIME validé côté application
)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Policies RLS sur storage.objects
--
-- Convention de chemin : {user_id}/{deal_id}/{doc_uuid}_{filename}
-- Seul le propriétaire peut uploader/lire/modifier/supprimer ses fichiers.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE POLICY "Users upload own deal documents"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'deal-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users read own deal documents"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'deal-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own deal documents"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'deal-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own deal documents"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'deal-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. ma_documents — colonnes métier V49
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE ma_documents
  ADD COLUMN IF NOT EXISTS category        TEXT;  -- entreprise | operation
ALTER TABLE ma_documents
  ADD COLUMN IF NOT EXISTS document_status TEXT DEFAULT 'final';  -- draft | review | final
ALTER TABLE ma_documents
  ADD COLUMN IF NOT EXISTS storage_path    TEXT;  -- chemin dans le bucket (pour delete/signed URL)
ALTER TABLE ma_documents
  ADD COLUMN IF NOT EXISTS mime_type       TEXT;

CREATE INDEX IF NOT EXISTS idx_ma_documents_deal_category
  ON ma_documents(deal_id, category);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. DROP TABLE deal_documents (ancien système URL simple)
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS deal_documents CASCADE;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Registre
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v49') ON CONFLICT (version) DO NOTHING;

-- Vérification :
-- SELECT id, public, file_size_limit FROM storage.buckets WHERE id='deal-documents';
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='ma_documents'
--    AND column_name IN ('category','document_status','storage_path','mime_type');
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema='public' AND table_name='deal_documents';  -- doit retourner 0 ligne
