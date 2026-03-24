-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V12 — Fusion activités → tâches
-- Les tâches absorbent les activités. task_type = type d'action.
-- ═══════════════════════════════════════════════════════════════

-- 1. Ajouter les colonnes manquantes sur tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type    TEXT DEFAULT 'todo'
  CHECK (task_type IN ('todo','email_sent','email_received','call','meeting',
    'follow_up','intro','note','deck_sent','nda','document_sent','other'));

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time     TEXT;          -- "HH:MM"
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS summary      TEXT;          -- résumé / notes
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- contact_id existe déjà — on ajoute aussi la table multi-contacts
-- (task_contacts = même logique que activity_contacts)
CREATE TABLE IF NOT EXISTS task_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, contact_id)
);
ALTER TABLE task_contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own task_contacts" ON task_contacts
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_tc_task    ON task_contacts(task_id);
CREATE INDEX IF NOT EXISTS idx_tc_contact ON task_contacts(contact_id);

-- 2. Migrer les activités existantes vers tasks
-- (pour ne pas perdre l'historique)
INSERT INTO tasks (
  title, task_type, task_status, deal_id, organization_id, contact_id,
  summary, due_date, user_id, created_at
)
SELECT
  title,
  activity_type::TEXT,
  'done',           -- les activités passées sont "done"
  deal_id,
  organization_id,
  contact_id,
  summary,
  activity_date::DATE,
  user_id,
  created_at
FROM activities
WHERE NOT EXISTS (
  SELECT 1 FROM tasks t2
  WHERE t2.title = activities.title
    AND t2.deal_id = activities.deal_id
    AND t2.due_date = activities.activity_date::DATE
    AND t2.user_id = activities.user_id
)
ON CONFLICT DO NOTHING;

-- 3. Migrer activity_contacts vers task_contacts
INSERT INTO task_contacts (task_id, contact_id, user_id)
SELECT
  t.id,
  ac.contact_id,
  ac.user_id
FROM activity_contacts ac
JOIN activities a ON a.id = ac.activity_id
JOIN tasks t ON t.title = a.title
  AND t.deal_id = a.deal_id
  AND t.due_date = a.activity_date::DATE
  AND t.user_id = a.user_id
ON CONFLICT (task_id, contact_id) DO NOTHING;
