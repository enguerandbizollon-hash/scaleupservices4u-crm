-- Migration V20 : Documents candidats (Google Drive)
-- Exécuter dans Supabase SQL Editor

-- Table candidate_documents
CREATE TABLE IF NOT EXISTS candidate_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  drive_file_id   TEXT NOT NULL,
  file_url        TEXT NOT NULL,          -- webViewLink Google Drive
  mime_type       TEXT,
  document_type   TEXT NOT NULL DEFAULT 'other',  -- cv | cover_letter | portfolio | reference | other
  source          TEXT NOT NULL DEFAULT 'google_drive',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE candidate_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own candidate_documents" ON candidate_documents
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_candidate_documents_candidate ON candidate_documents(candidate_id);
