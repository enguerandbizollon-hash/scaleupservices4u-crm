-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V13 — user_settings pour Google Calendar
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_settings (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id),
  gcal_access_token  TEXT,
  gcal_refresh_token TEXT,
  gcal_token_expiry  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own settings" ON user_settings
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
