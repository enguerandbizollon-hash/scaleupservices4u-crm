-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION V14 — Optimisation CRM : Fusion Activities + Primary Org
-- ═══════════════════════════════════════════════════════════════════════
-- Ajoute :
--   1. primary_organization_id à contacts (nullable, avec alerte si NULL)
--   2. Colonnes unification activities (merger tasks/agenda)
--   3. Support participants pour TOUS les types d'activités
--   4. Types étendus : recruitment, recruitment_interview, recruitment_feedback
--   5. Indices optimisés pour recherche
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. AJOUTER primary_organization_id À CONTACTS ──────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS primary_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Index pour recherche par org
CREATE INDEX IF NOT EXISTS idx_contacts_primary_org ON contacts(primary_organization_id) WHERE primary_organization_id IS NOT NULL;

-- ── 2. COLONNES ACTIVITIES (UNIFICATION TASKS/AGENDA/ACTIVITIES) ────────
ALTER TABLE activities ADD COLUMN IF NOT EXISTS task_status     TEXT DEFAULT 'open';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS due_date        DATE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS due_time        TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS completed_at    TIMESTAMPTZ;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS reminder_date   DATE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS location        TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS participants    TEXT[] DEFAULT '{}';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_all_day      BOOLEAN DEFAULT false;

-- ── 3. EXTENSION DE L'ENUM activity_type ─────────────────────────────
-- activity_type est un ENUM → on ajoute les nouvelles valeurs
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'todo';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'follow_up';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'deck_sent';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'nda';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'document_sent';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'other';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'deadline';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'delivery';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'closing';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'recruitment_interview';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'recruitment_feedback';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'recruitment_task';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'cfo_advisory';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'investor_meeting';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'due_diligence';

-- ── 4. SUPPORT PARTICIPANTS POUR TOUS LES TYPES ───────────────────────
-- activity_contacts : déjà existe, supporte tous les types

-- ── 5. COLONNES TASKS → ARCHIVAGE PROGRESSIF ──────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES activities(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_legacy  BOOLEAN DEFAULT false;

-- ── 6. COLONNES DEALS (SUPPORT MULTI-SERVICE) ─────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_types TEXT[] DEFAULT ARRAY['fundraising'];
ALTER TABLE deals ADD COLUMN IF NOT EXISTS recruitment_stage TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS cfo_advisory_scope TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS target_positions TEXT[] DEFAULT '{}';

-- ── 7. INDICES OPTIMISÉS ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activities_type             ON activities(activity_type) WHERE activity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_task_status      ON activities(task_status) WHERE task_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_due_date         ON activities(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_completed_at     ON activities(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_deal_contact     ON activities(deal_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_contact      ON activities(organization_id, contact_id);

CREATE INDEX IF NOT EXISTS idx_activity_contacts_activity  ON activity_contacts(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_contacts_contact   ON activity_contacts(contact_id);

-- ── 8. SEARCH OPTIMISÉ POUR MULTI-ORG ─────────────────────────────────
CREATE OR REPLACE FUNCTION search_contacts_by_org(
  p_org_id UUID,
  p_query TEXT,
  p_user_id UUID
) RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  title TEXT,
  primary_organization_id UUID,
  has_primary BOOLEAN
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
    SELECT
      c.id,
      concat_ws(' ', c.first_name, c.last_name) as full_name,
      c.email,
      c.title,
      c.primary_organization_id,
      (c.primary_organization_id IS NOT NULL)::BOOLEAN as has_primary
    FROM contacts c
    WHERE c.user_id = p_user_id
      AND (
        EXISTS (
          SELECT 1 FROM organization_contacts oc
          WHERE oc.contact_id = c.id AND oc.organization_id = p_org_id
        )
        OR c.primary_organization_id = p_org_id
      )
      AND (
        c.first_name ILIKE p_query || '%'
        OR c.last_name ILIKE p_query || '%'
        OR c.email ILIKE p_query || '%'
      )
    ORDER BY
      CASE WHEN c.first_name ILIKE p_query THEN 0 ELSE 1 END,
      c.first_name, c.last_name
    LIMIT 50;
END; $$;

-- ── 9. RPC POUR UNIFIER ACTIVITIES ──────────────────────────────────
CREATE OR REPLACE FUNCTION migrate_tasks_to_activities(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_task RECORD;
  v_activity_id UUID;
  v_migrated INT := 0;
BEGIN
  FOR v_task IN
    SELECT id, title, description, due_date, deal_id, contact_id, organization_id, task_status
    FROM tasks
    WHERE user_id = p_user_id AND activity_id IS NULL AND is_legacy = false
  LOOP
    INSERT INTO activities (
      title, summary, activity_type, task_status, due_date,
      deal_id, contact_id, organization_id, user_id
    ) VALUES (
      v_task.title, v_task.description, 'todo', v_task.task_status, v_task.due_date,
      v_task.deal_id, v_task.contact_id, v_task.organization_id, p_user_id
    ) RETURNING activities.id INTO v_activity_id;

    UPDATE tasks SET activity_id = v_activity_id, is_legacy = true WHERE id = v_task.id;
    v_migrated := v_migrated + 1;
  END LOOP;

  RETURN jsonb_build_object('migrated', v_migrated);
END; $$;

-- ── 10. VIEW UNIFIÉE POUR LES ACTIVITÉS ───────────────────────────────
CREATE OR REPLACE VIEW activities_unified AS
SELECT
  id,
  title,
  activity_type,
  task_status as status,
  COALESCE(activity_date, due_date) as event_date,
  deal_id,
  contact_id,
  organization_id,
  summary,
  location,
  due_date,
  reminder_date,
  completed_at,
  created_at,
  user_id
FROM activities
ORDER BY COALESCE(activity_date, due_date, created_at) DESC;

-- ── 11. COLONNE FLAG CONTACTS SANS ORG ────────────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS needs_org_assignment BOOLEAN GENERATED ALWAYS AS (primary_organization_id IS NULL) STORED;

-- ── 12. FONCTION LIER CONTACT À ORG PRIMAIRE ──────────────────────────
CREATE OR REPLACE FUNCTION set_primary_organization(
  p_contact_id UUID,
  p_organization_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  UPDATE contacts
  SET primary_organization_id = p_organization_id
  WHERE id = p_contact_id AND user_id = p_user_id;

  INSERT INTO organization_contacts (organization_id, contact_id, user_id)
  VALUES (p_organization_id, p_contact_id, p_user_id)
  ON CONFLICT (organization_id, contact_id) DO NOTHING;

  RETURN true;
END; $$;

-- ── 13. FONCTION AJOUTER PARTICIPANTS À UNE ACTIVITÉ ──────────────────
CREATE OR REPLACE FUNCTION add_activity_participant(
  p_activity_id UUID,
  p_contact_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO activity_contacts (activity_id, contact_id, user_id)
  VALUES (p_activity_id, p_contact_id, p_user_id)
  ON CONFLICT (activity_id, contact_id) DO NOTHING;

  RETURN true;
END; $$;

-- ── 14. GRANTS RPC ────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION search_contacts_by_org(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION migrate_tasks_to_activities(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_primary_organization(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_activity_participant(UUID, UUID, UUID) TO authenticated;
