-- V32 : RLS user_settings + colonnes gcal_event_id sur tables dates

BEGIN;

-- RLS sur user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "owner_only" ON user_settings
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- gcal_event_id sur les tables avec dates
ALTER TABLE activities     ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;
ALTER TABLE tasks          ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;
ALTER TABLE deals          ADD COLUMN IF NOT EXISTS gcal_relance_event_id TEXT;
ALTER TABLE deals          ADD COLUMN IF NOT EXISTS gcal_closing_event_id TEXT;
ALTER TABLE mandates       ADD COLUMN IF NOT EXISTS gcal_closing_event_id TEXT;
ALTER TABLE fee_milestones ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;

COMMIT;
