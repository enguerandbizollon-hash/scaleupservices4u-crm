-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION CONSOLIDÉE — Safe à exécuter même si les versions
-- précédentes ont déjà tourné partiellement.
-- Toutes les opérations sont idempotentes.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. COLONNES TASKS ──────────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type       TEXT DEFAULT 'todo';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time        TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS summary         TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at    TIMESTAMPTZ;

-- CHECK constraint task_type (safe si déjà présente)
DO $$ BEGIN
  ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check
    CHECK (task_type IN ('todo','email_sent','email_received','call','meeting',
      'follow_up','intro','note','deck_sent','nda','document_sent','other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. COLONNES ACTIVITIES ─────────────────────────────────────────────
ALTER TABLE activities ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- ── 3. COLONNES DEALS ──────────────────────────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS loss_reason TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS lost_at     TIMESTAMPTZ;

-- ── 4. COLONNES CONTACTS ───────────────────────────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS exclusion_reason TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_date DATE;

-- ── 5. TABLE EVENTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  event_type      TEXT NOT NULL DEFAULT 'follow_up',
  status          TEXT NOT NULL DEFAULT 'open',
  due_date        DATE NOT NULL,
  reminder_date   DATE,
  notes           TEXT,
  deal_id         UUID REFERENCES deals(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own events" ON events FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. TABLE ACTIVITY_CONTACTS ─────────────────────────────────────────
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
  CREATE POLICY "Users manage own activity_contacts" ON activity_contacts FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 7. TABLE TASK_CONTACTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id)    ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, contact_id)
);
ALTER TABLE task_contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own task_contacts" ON task_contacts FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 8. TABLE USER_SETTINGS (Google Calendar) ───────────────────────────
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
  CREATE POLICY "Users manage own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 9. INDEX (tous idempotents) ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_contact      ON tasks(contact_id)      WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_deal        ON events(deal_id)        WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_contact     ON events(contact_id)     WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_org         ON events(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_due         ON events(due_date)        WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_events_user        ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_ac_activity        ON activity_contacts(activity_id);
CREATE INDEX IF NOT EXISTS idx_ac_contact         ON activity_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_tc_task            ON task_contacts(task_id);
CREATE INDEX IF NOT EXISTS idx_tc_contact         ON task_contacts(contact_id);

-- ── 10. TRIGGER : last_contact_date auto ──────────────────────────────
CREATE OR REPLACE FUNCTION update_contact_last_contact_date()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL AND NEW.activity_date IS NOT NULL THEN
    UPDATE contacts SET last_contact_date = GREATEST(
      COALESCE(last_contact_date, '1970-01-01'::DATE), NEW.activity_date::DATE)
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_activity_update_contact_date ON activities;
CREATE TRIGGER trg_activity_update_contact_date
  AFTER INSERT OR UPDATE OF activity_date, contact_id ON activities
  FOR EACH ROW EXECUTE FUNCTION update_contact_last_contact_date();

-- ── 11. TRIGGER : deal perdu → log date ───────────────────────────────
CREATE OR REPLACE FUNCTION set_deal_lost_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deal_status = 'closed' AND (OLD.deal_status IS NULL OR OLD.deal_status != 'closed') THEN
    NEW.lost_at := now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_deal_lost_at ON deals;
CREATE TRIGGER trg_deal_lost_at
  BEFORE UPDATE OF deal_status ON deals
  FOR EACH ROW EXECUTE FUNCTION set_deal_lost_at();

-- ── 12. RPC import_deal_dataset ───────────────────────────────────────
CREATE OR REPLACE FUNCTION import_deal_dataset(
  p_deal_name TEXT,
  p_user_id   UUID,
  p_orgs      JSONB DEFAULT '[]',
  p_contacts  JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_deal_id   UUID;
  v_org_id    UUID;
  v_contact_id UUID;
  v_ok_orgs   INT := 0;
  v_ok_contacts INT := 0;
  v_ok_links  INT := 0;
  r           JSONB;
BEGIN
  -- Trouver ou créer le deal
  SELECT id INTO v_deal_id FROM deals WHERE name = p_deal_name AND user_id = p_user_id LIMIT 1;
  IF v_deal_id IS NULL THEN
    INSERT INTO deals(name, deal_type, deal_status, deal_stage, priority_level, user_id)
    VALUES(p_deal_name, 'fundraising', 'active', 'outreach', 'high', p_user_id)
    RETURNING id INTO v_deal_id;
  END IF;

  -- Importer organisations
  FOR r IN SELECT * FROM jsonb_array_elements(p_orgs) LOOP
    SELECT id INTO v_org_id FROM organizations
    WHERE lower(name) = lower(r->>'name') AND user_id = p_user_id LIMIT 1;
    IF v_org_id IS NULL THEN
      INSERT INTO organizations(name, organization_type, base_status, sector, location, website,
        investment_ticket, investment_stage, description, user_id)
      VALUES(
        r->>'name', coalesce(nullif(trim(r->>'organization_type'),''), 'investor'),
        coalesce(nullif(trim(r->>'base_status'),''), 'to_qualify'),
        nullif(trim(coalesce(r->>'sector','')), ''),
        nullif(trim(coalesce(r->>'location','')), ''),
        nullif(trim(coalesce(r->>'website','')), ''),
        nullif(trim(coalesce(r->>'investment_ticket','')), ''),
        nullif(trim(coalesce(r->>'investment_stage','')), ''),
        nullif(trim(coalesce(r->>'description','')), ''),
        p_user_id
      ) RETURNING id INTO v_org_id;
      v_ok_orgs := v_ok_orgs + 1;
    END IF;
    INSERT INTO deal_organizations(deal_id, organization_id, user_id)
    VALUES(v_deal_id, v_org_id, p_user_id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Importer contacts
  FOR r IN SELECT * FROM jsonb_array_elements(p_contacts) LOOP
    IF nullif(trim(coalesce(r->>'email','')), '') IS NOT NULL THEN
      SELECT id INTO v_contact_id FROM contacts WHERE email = r->>'email' AND user_id = p_user_id LIMIT 1;
    ELSE
      SELECT id INTO v_contact_id FROM contacts
      WHERE lower(first_name) = lower(r->>'first_name')
        AND lower(last_name)  = lower(r->>'last_name')
        AND user_id = p_user_id LIMIT 1;
    END IF;
    IF v_contact_id IS NULL THEN
      INSERT INTO contacts(first_name, last_name, full_name, email, phone, title,
        linkedin_url, base_status, user_id)
      VALUES(
        r->>'first_name', r->>'last_name',
        concat_ws(' ', r->>'first_name', r->>'last_name'),
        nullif(trim(coalesce(r->>'email','')), ''),
        nullif(trim(coalesce(r->>'phone','')), ''),
        nullif(trim(coalesce(r->>'title','')), ''),
        nullif(trim(coalesce(r->>'linkedin_url','')), ''),
        coalesce(nullif(trim(r->>'base_status'),''), 'to_qualify'),
        p_user_id
      ) RETURNING id INTO v_contact_id;
      v_ok_contacts := v_ok_contacts + 1;
    END IF;
    -- Lier contact à l'organisation si précisée
    IF nullif(trim(coalesce(r->>'org_name','')), '') IS NOT NULL THEN
      SELECT id INTO v_org_id FROM organizations
      WHERE lower(name) = lower(r->>'org_name') AND user_id = p_user_id LIMIT 1;
      IF v_org_id IS NOT NULL THEN
        INSERT INTO organization_contacts(organization_id, contact_id, role_label, is_primary, user_id)
        VALUES(v_org_id, v_contact_id, nullif(trim(coalesce(r->>'role_label','')), ''), false, p_user_id)
        ON CONFLICT (organization_id, contact_id) DO NOTHING;
        v_ok_links := v_ok_links + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'deal_id', v_deal_id, 'orgs', v_ok_orgs,
    'contacts', v_ok_contacts, 'links', v_ok_links
  );
END; $$;
