-- V34 : Versioning documents
-- Quand un document est remplacé, l'historique est conservé.

BEGIN;

-- Table document_versions : historique des versions par document
CREATE TABLE IF NOT EXISTS document_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id       UUID NOT NULL,  -- FK vers deal_documents.id
  version_number    INTEGER NOT NULL DEFAULT 1,
  file_url          TEXT,
  file_name         TEXT,
  file_size         INTEGER,
  uploaded_by       UUID REFERENCES auth.users(id),
  upload_notes      TEXT,
  ai_extracted_data JSONB,
  ai_processed_at   TIMESTAMPTZ,
  is_current        BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_current ON document_versions(document_id, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_doc_versions_user ON document_versions(user_id);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "owner_only" ON document_versions
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ajouter current_version_number sur deal_documents
ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS current_version_number INTEGER DEFAULT 1;

COMMIT;
