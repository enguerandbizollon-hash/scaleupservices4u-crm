-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V11 — Activités multi-contacts
-- ═══════════════════════════════════════════════════════════════

-- Table de liaison activité ↔ contacts (plusieurs contacts par activité)
CREATE TABLE IF NOT EXISTS activity_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES contacts(id)  ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(activity_id, contact_id)
);
ALTER TABLE activity_contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own activity_contacts" ON activity_contacts
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ac_activity ON activity_contacts(activity_id);
CREATE INDEX IF NOT EXISTS idx_ac_contact  ON activity_contacts(contact_id);

-- Migrer les contacts existants vers la table de liaison
INSERT INTO activity_contacts (activity_id, contact_id, user_id)
  SELECT id, contact_id, user_id
  FROM activities
  WHERE contact_id IS NOT NULL
ON CONFLICT DO NOTHING;
