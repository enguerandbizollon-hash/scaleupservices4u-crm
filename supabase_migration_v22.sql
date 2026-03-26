-- Migration V22 : M6 Rapports candidats partageables
-- Exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS candidate_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  token        UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  label        TEXT,                                         -- ex: "Rapport client Acme - Mars 2026"
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE candidate_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own candidate_reports" ON candidate_reports
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_candidate_reports_candidate ON candidate_reports(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_reports_token    ON candidate_reports(token);
