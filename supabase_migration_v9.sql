-- ═══════════════════════════════════════
-- MIGRATION V9 — contact_id sur tasks et activities
-- ═══════════════════════════════════════
ALTER TABLE tasks      ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_contact      ON tasks(contact_id)      WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_id) WHERE contact_id IS NOT NULL;
