-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V10 — Automatisations
-- ═══════════════════════════════════════════════════════════════

-- ── 1. TABLE ÉVÉNEMENTS / RAPPELS ─────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  event_type      TEXT NOT NULL DEFAULT 'follow_up'
                  CHECK (event_type IN ('follow_up','meeting','call','deadline','email','other')),
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','done','cancelled')),
  due_date        DATE NOT NULL,
  reminder_date   DATE,
  notes           TEXT,
  -- Liens
  deal_id         UUID REFERENCES deals(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  -- Meta
  user_id         UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own events" ON events
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_events_deal        ON events(deal_id)         WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_contact     ON events(contact_id)      WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_org         ON events(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_due         ON events(due_date)        WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_events_user        ON events(user_id);

-- ── 2. TRIGGER : last_contact_date auto ───────────────────────
-- Mise à jour automatique du contact quand une activité est créée/modifiée

CREATE OR REPLACE FUNCTION update_contact_last_contact_date()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL AND NEW.activity_date IS NOT NULL THEN
    UPDATE contacts
    SET last_contact_date = GREATEST(
      COALESCE(last_contact_date, '1970-01-01'::DATE),
      NEW.activity_date::DATE
    )
    WHERE id = NEW.contact_id;
  END IF;

  -- Si pas de contact direct mais org liée, mettre à jour via organization_contacts
  IF NEW.contact_id IS NULL AND NEW.organization_id IS NOT NULL AND NEW.activity_date IS NOT NULL THEN
    UPDATE contacts c
    SET last_contact_date = GREATEST(
      COALESCE(c.last_contact_date, '1970-01-01'::DATE),
      NEW.activity_date::DATE
    )
    FROM organization_contacts oc
    WHERE oc.contact_id = c.id
      AND oc.organization_id = NEW.organization_id;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_activity_update_contact_date ON activities;
CREATE TRIGGER trg_activity_update_contact_date
  AFTER INSERT OR UPDATE OF activity_date, contact_id ON activities
  FOR EACH ROW EXECUTE FUNCTION update_contact_last_contact_date();

-- ── 3. TRIGGER : last_contact_date via événements ─────────────
CREATE OR REPLACE FUNCTION update_contact_date_from_event()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'done' AND NEW.contact_id IS NOT NULL AND NEW.due_date IS NOT NULL THEN
    UPDATE contacts
    SET last_contact_date = GREATEST(
      COALESCE(last_contact_date, '1970-01-01'::DATE),
      NEW.due_date
    )
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_event_update_contact_date ON events;
CREATE TRIGGER trg_event_update_contact_date
  AFTER INSERT OR UPDATE OF status, due_date ON events
  FOR EACH ROW EXECUTE FUNCTION update_contact_date_from_event();

-- ── 4. MOTIF DE PERTE ─────────────────────────────────────────
-- Colonne loss_reason sur deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS loss_reason TEXT
  CHECK (loss_reason IN (
    'no_response','no_interest','bad_timing','out_of_scope',
    'valuation','competition','deal_abandoned','unreachable','other'
  ));

ALTER TABLE deals ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS exclusion_reason TEXT;

-- ── 5. TRIGGER : contrôle motif de perte ─────────────────────
-- Pas de blocage hard (géré côté UI) mais on logue la date
CREATE OR REPLACE FUNCTION set_deal_lost_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deal_status = 'closed' AND OLD.deal_status != 'closed' THEN
    NEW.lost_at := now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_deal_lost_at ON deals;
CREATE TRIGGER trg_deal_lost_at
  BEFORE UPDATE OF deal_status ON deals
  FOR EACH ROW EXECUTE FUNCTION set_deal_lost_at();
