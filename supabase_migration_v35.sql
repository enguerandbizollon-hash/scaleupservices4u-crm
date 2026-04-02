-- V35 : Table unifiée actions (remplace activities + tasks + events)
-- Migration données existantes incluse (idempotente)

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE PRINCIPALE : actions
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Type et statut
  type              TEXT NOT NULL DEFAULT 'task',
  status            TEXT NOT NULL DEFAULT 'open',
  priority          TEXT DEFAULT 'medium',

  -- Contenu
  title             TEXT NOT NULL,
  description       TEXT,
  notes             TEXT,
  summary_ai        TEXT,

  -- Dates et horaires
  due_date          DATE,
  due_time          TEXT,
  is_all_day        BOOLEAN DEFAULT TRUE,
  start_datetime    TIMESTAMPTZ,
  end_datetime      TIMESTAMPTZ,
  duration_minutes  INTEGER,
  hard_deadline     BOOLEAN DEFAULT FALSE,
  reminder_days     INTEGER[],

  -- Meeting / Call
  location          TEXT,
  meet_link         TEXT,
  phone_number      TEXT,
  agenda_notes      TEXT,

  -- Email
  gmail_thread_id   TEXT,
  gmail_message_id  TEXT,
  email_subject     TEXT,
  email_body_preview TEXT,
  email_direction   TEXT,

  -- Liaisons principales
  deal_id           UUID REFERENCES deals(id) ON DELETE SET NULL,
  organization_id   UUID REFERENCES organizations(id) ON DELETE SET NULL,
  mandate_id        UUID REFERENCES mandates(id) ON DELETE SET NULL,

  -- Google Calendar
  gcal_event_id     TEXT,

  -- Meta
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLES DE LIAISON N-N
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS action_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id    UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  contact_id   UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role         TEXT,
  attended     BOOLEAN DEFAULT TRUE,
  UNIQUE(action_id, contact_id)
);

CREATE TABLE IF NOT EXISTS action_organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id       UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            TEXT,
  UNIQUE(action_id, organization_id)
);

-- ═══════════════════════════════════════════════════════════════════════
-- INDEX
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_actions_user      ON actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_deal      ON actions(deal_id);
CREATE INDEX IF NOT EXISTS idx_actions_org       ON actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_actions_mandate   ON actions(mandate_id);
CREATE INDEX IF NOT EXISTS idx_actions_due       ON actions(due_date);
CREATE INDEX IF NOT EXISTS idx_actions_type      ON actions(type);
CREATE INDEX IF NOT EXISTS idx_actions_status    ON actions(status);
CREATE INDEX IF NOT EXISTS idx_action_contacts_action ON action_contacts(action_id);
CREATE INDEX IF NOT EXISTS idx_action_contacts_contact ON action_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_action_orgs_action ON action_organizations(action_id);

-- ═══════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_organizations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "owner_only" ON actions
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "owner_via_action" ON action_contacts
    USING (EXISTS (SELECT 1 FROM actions a WHERE a.id = action_id AND a.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "owner_via_action" ON action_organizations
    USING (EXISTS (SELECT 1 FROM actions a WHERE a.id = action_id AND a.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION DONNÉES EXISTANTES (idempotente)
-- ═══════════════════════════════════════════════════════════════════════

-- Migrer activities → actions
INSERT INTO actions (
  user_id, type, status, title, description, notes,
  due_date, due_time, is_all_day, start_datetime,
  deal_id, organization_id, gcal_event_id,
  location, created_at, updated_at
)
SELECT
  a.user_id,
  COALESCE(a.activity_type, 'note'),
  COALESCE(a.task_status, 'completed'),
  a.title,
  a.summary,
  NULL,
  a.due_date,
  a.due_time,
  COALESCE(a.is_all_day, TRUE),
  a.activity_date,
  a.deal_id,
  a.organization_id,
  a.gcal_event_id,
  a.location,
  a.created_at,
  COALESCE(a.updated_at, a.created_at)
FROM activities a
WHERE NOT EXISTS (
  SELECT 1 FROM actions ac
  WHERE ac.user_id = a.user_id AND ac.title = a.title
    AND ac.start_datetime = a.activity_date AND ac.deal_id = a.deal_id
);

-- Migrer activity_contacts → action_contacts
INSERT INTO action_contacts (action_id, contact_id)
SELECT ac2.id, old_ac.contact_id
FROM activity_contacts old_ac
JOIN activities old_a ON old_a.id = old_ac.activity_id
JOIN actions ac2 ON ac2.user_id = old_a.user_id
  AND ac2.title = old_a.title
  AND COALESCE(ac2.start_datetime::text, '') = COALESCE(old_a.activity_date::text, '')
WHERE NOT EXISTS (
  SELECT 1 FROM action_contacts ex
  WHERE ex.action_id = ac2.id AND ex.contact_id = old_ac.contact_id
);

-- Migrer tasks → actions
INSERT INTO actions (
  user_id, type, status, priority, title, description,
  due_date, due_time, deal_id, gcal_event_id,
  created_at, updated_at
)
SELECT
  t.user_id,
  'task',
  COALESCE(t.task_status, 'open'),
  COALESCE(t.priority_level, 'medium'),
  t.title,
  t.description,
  t.due_date,
  NULL,
  t.deal_id,
  t.gcal_event_id,
  t.created_at,
  t.created_at
FROM tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM actions ac
  WHERE ac.user_id = t.user_id AND ac.title = t.title
    AND ac.due_date = t.due_date AND ac.type = 'task'
);

COMMIT;

-- Vérification :
-- SELECT type, COUNT(*) FROM actions GROUP BY type ORDER BY type;
-- SELECT COUNT(*) FROM action_contacts;
