-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V6 — CRM Scale UP
-- Exécuter en une seule fois dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. COLONNES MANQUANTES ─────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deal_name_hint TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS investment_ticket TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS investment_stage TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS search_vector tsvector;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_date DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS search_vector tsvector;

ALTER TABLE deals ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS target_amount NUMERIC(15,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS committed_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS closed_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ── 2. TABLE DEAL_ORGANIZATIONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id),
  UNIQUE(deal_id, organization_id)
);
ALTER TABLE deal_organizations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own deal_organizations" ON deal_organizations
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. TABLE DEAL_MILESTONES ───────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  planned_date DATE,
  actual_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','done','cancelled')),
  amount NUMERIC(15,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);
ALTER TABLE deal_milestones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own deal_milestones" ON deal_milestones
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. TABLE INVESTOR_COMMITMENTS ─────────────────────────────
CREATE TABLE IF NOT EXISTS investor_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  amount NUMERIC(15,2),
  currency TEXT DEFAULT 'EUR',
  status TEXT DEFAULT 'indication' CHECK (status IN ('indication','soft','hard','signed','transferred','cancelled')),
  committed_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);
ALTER TABLE investor_commitments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own investor_commitments" ON investor_commitments
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. INDEXES PERFORMANCE ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_deal_hint    ON organizations(deal_name_hint) WHERE deal_name_hint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_status       ON organizations(base_status);
CREATE INDEX IF NOT EXISTS idx_org_type         ON organizations(organization_type);
CREATE INDEX IF NOT EXISTS idx_org_user         ON organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email   ON contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_status  ON contacts(base_status);
CREATE INDEX IF NOT EXISTS idx_contacts_date    ON contacts(last_contact_date) WHERE last_contact_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_user    ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_status     ON deals(deal_status);
CREATE INDEX IF NOT EXISTS idx_deals_type       ON deals(deal_type);
CREATE INDEX IF NOT EXISTS idx_deals_user       ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_do_deal          ON deal_organizations(deal_id);
CREATE INDEX IF NOT EXISTS idx_do_org           ON deal_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_oc_contact       ON organization_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_oc_org           ON organization_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_deal          ON investor_commitments(deal_id);

-- ── 6. FULL-TEXT SEARCH VECTORS ───────────────────────────────
-- Organisations
UPDATE organizations SET search_vector =
  setweight(to_tsvector('french', coalesce(name,'')), 'A') ||
  setweight(to_tsvector('french', coalesce(description,'')), 'B') ||
  setweight(to_tsvector('french', coalesce(notes,'')), 'C') ||
  setweight(to_tsvector('french', coalesce(location,'')), 'D');

CREATE OR REPLACE FUNCTION orgs_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', coalesce(NEW.name,'')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW.description,'')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW.notes,'')), 'C') ||
    setweight(to_tsvector('french', coalesce(NEW.location,'')), 'D');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orgs_search_trigger ON organizations;
CREATE TRIGGER orgs_search_trigger
  BEFORE INSERT OR UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION orgs_search_vector_update();

CREATE INDEX IF NOT EXISTS idx_org_search ON organizations USING GIN(search_vector);

-- Contacts
UPDATE contacts SET search_vector =
  setweight(to_tsvector('french', coalesce(first_name,'')||' '||coalesce(last_name,'')), 'A') ||
  setweight(to_tsvector('french', coalesce(email,'')), 'B') ||
  setweight(to_tsvector('french', coalesce(title,'')), 'C') ||
  setweight(to_tsvector('french', coalesce(notes,'')), 'D');

CREATE OR REPLACE FUNCTION contacts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', coalesce(NEW.first_name,'')||' '||coalesce(NEW.last_name,'')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW.email,'')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW.title,'')), 'C') ||
    setweight(to_tsvector('french', coalesce(NEW.notes,'')), 'D');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_search_trigger ON contacts;
CREATE TRIGGER contacts_search_trigger
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION contacts_search_vector_update();

CREATE INDEX IF NOT EXISTS idx_contacts_search ON contacts USING GIN(search_vector);

-- Deals
UPDATE deals SET search_vector =
  setweight(to_tsvector('french', coalesce(name,'')), 'A') ||
  setweight(to_tsvector('french', coalesce(description,'')), 'B') ||
  setweight(to_tsvector('french', coalesce(sector,'')), 'C');

CREATE OR REPLACE FUNCTION deals_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', coalesce(NEW.name,'')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW.description,'')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW.sector,'')), 'C');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deals_search_trigger ON deals;
CREATE TRIGGER deals_search_trigger
  BEFORE INSERT OR UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION deals_search_vector_update();

CREATE INDEX IF NOT EXISTS idx_deals_search ON deals USING GIN(search_vector);

-- ── 7. RPC BULK IMPORT ORGANISATIONS ──────────────────────────
CREATE OR REPLACE FUNCTION bulk_import_organizations(
  p_rows JSONB,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r JSONB;
  v_org_id UUID;
  v_deal_id UUID;
  v_ok INT := 0;
  v_errors JSONB := '[]'::JSONB;
  v_status TEXT;
  v_idx INT := 0;
  v_status_map JSONB := '{
    "rencontre":"qualified","arencontrer":"to_qualify","contacte":"active",
    "arelancer":"active","qualified":"qualified","active":"active",
    "to_qualify":"to_qualify","priority":"priority","dormant":"dormant",
    "inactive":"inactive","excluded":"excluded"
  }';
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx := v_idx + 1;
    BEGIN
      -- Statut normalisé
      v_status := coalesce(
        v_status_map ->> lower(replace(coalesce(r->>'base_status',''), ' ', '')),
        'to_qualify'
      );

      -- Upsert organisation par nom (insensible à la casse)
      SELECT id INTO v_org_id FROM organizations
        WHERE lower(trim(name)) = lower(trim(r->>'name'))
          AND user_id = p_user_id
        LIMIT 1;

      IF v_org_id IS NULL THEN
        INSERT INTO organizations (
          name, organization_type, base_status, sector, location,
          website, notes, description, investment_ticket, investment_stage,
          deal_name_hint, user_id
        ) VALUES (
          trim(r->>'name'),
          coalesce(nullif(trim(r->>'organization_type'),''), 'other'),
          v_status,
          nullif(trim(coalesce(r->>'sector','')), ''),
          nullif(trim(coalesce(r->>'location','')), ''),
          nullif(trim(coalesce(r->>'website','')), ''),
          nullif(trim(coalesce(r->>'notes','')), ''),
          nullif(trim(coalesce(r->>'description','')), ''),
          nullif(trim(coalesce(r->>'investment_ticket','')), ''),
          nullif(trim(coalesce(r->>'investment_stage','')), ''),
          nullif(trim(coalesce(r->>'deal_name','')), ''),
          p_user_id
        )
        RETURNING id INTO v_org_id;
      ELSE
        UPDATE organizations SET
          organization_type  = coalesce(nullif(trim(r->>'organization_type'),''), organization_type),
          base_status        = v_status,
          sector             = coalesce(nullif(trim(r->>'sector'),''), sector),
          location           = coalesce(nullif(trim(r->>'location'),''), location),
          website            = coalesce(nullif(trim(r->>'website'),''), website),
          notes              = coalesce(nullif(trim(r->>'notes'),''), notes),
          description        = coalesce(nullif(trim(r->>'description'),''), description),
          investment_ticket  = coalesce(nullif(trim(r->>'investment_ticket'),''), investment_ticket),
          investment_stage   = coalesce(nullif(trim(r->>'investment_stage'),''), investment_stage),
          deal_name_hint     = coalesce(nullif(trim(r->>'deal_name'),''), deal_name_hint)
        WHERE id = v_org_id;
      END IF;

      -- Lier au dossier si deal_name fourni
      IF (r->>'deal_name') IS NOT NULL AND trim(r->>'deal_name') != '' THEN
        SELECT id INTO v_deal_id FROM deals
          WHERE lower(trim(name)) = lower(trim(r->>'deal_name'))
            AND user_id = p_user_id
          LIMIT 1;

        IF v_deal_id IS NOT NULL THEN
          INSERT INTO deal_organizations (deal_id, organization_id, user_id)
            VALUES (v_deal_id, v_org_id, p_user_id)
            ON CONFLICT (deal_id, organization_id) DO NOTHING;

          -- Activité prise de contact si date fournie
          IF (r->>'contact_date') IS NOT NULL AND trim(r->>'contact_date') != '' THEN
            IF NOT EXISTS (
              SELECT 1 FROM activities
              WHERE organization_id = v_org_id AND deal_id = v_deal_id
            ) THEN
              INSERT INTO activities (
                title, activity_type, activity_date,
                organization_id, deal_id, summary, user_id
              ) VALUES (
                'Prise de contact — ' || trim(r->>'name'),
                'email',
                (r->>'contact_date')::DATE,
                v_org_id, v_deal_id,
                'Import CSV',
                p_user_id
              );
            END IF;
          END IF;
        END IF;
      END IF;

      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('ligne', v_idx, 'erreur', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', v_ok, 'errors', v_errors);
END;
$$;

-- ── 8. RPC BULK IMPORT CONTACTS ───────────────────────────────
CREATE OR REPLACE FUNCTION bulk_import_contacts(
  p_rows JSONB,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r JSONB;
  v_contact_id UUID;
  v_org_id UUID;
  v_ok INT := 0;
  v_errors JSONB := '[]'::JSONB;
  v_idx INT := 0;
  v_status TEXT;
  v_last_date DATE;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx := v_idx + 1;
    BEGIN
      IF trim(coalesce(r->>'first_name','')) = '' OR trim(coalesce(r->>'last_name','')) = '' THEN
        v_errors := v_errors || jsonb_build_object('ligne', v_idx, 'erreur', 'prénom/nom manquant');
        CONTINUE;
      END IF;

      -- Résoudre statut
      v_status := CASE lower(coalesce(r->>'base_status',''))
        WHEN 'active'     THEN 'active'
        WHEN 'qualified'  THEN 'qualified'
        WHEN 'priority'   THEN 'priority'
        WHEN 'dormant'    THEN 'dormant'
        WHEN 'inactive'   THEN 'inactive'
        WHEN 'excluded'   THEN 'excluded'
        ELSE 'to_qualify' END;

      -- Parser date
      v_last_date := NULL;
      BEGIN
        IF (r->>'last_contact_date') IS NOT NULL AND trim(r->>'last_contact_date') != '' THEN
          IF trim(r->>'last_contact_date') ~ '^\d{4}-\d{2}-\d{2}$' THEN
            v_last_date := (r->>'last_contact_date')::DATE;
          ELSIF trim(r->>'last_contact_date') ~ '^\d{2}/\d{2}/\d{4}$' THEN
            v_last_date := to_date(trim(r->>'last_contact_date'), 'DD/MM/YYYY');
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN v_last_date := NULL; END;

      -- Résoudre organisation
      v_org_id := NULL;
      IF trim(coalesce(r->>'organisation_name','')) != '' THEN
        SELECT id INTO v_org_id FROM organizations
          WHERE lower(trim(name)) = lower(trim(r->>'organisation_name'))
            AND user_id = p_user_id
          LIMIT 1;
        -- Créer si n'existe pas
        IF v_org_id IS NULL THEN
          INSERT INTO organizations (name, organization_type, base_status, user_id)
            VALUES (trim(r->>'organisation_name'), 'other', 'to_qualify', p_user_id)
          RETURNING id INTO v_org_id;
        END IF;
      END IF;

      -- Déduplication : email → prénom+nom
      v_contact_id := NULL;
      IF trim(coalesce(r->>'email','')) != '' THEN
        SELECT id INTO v_contact_id FROM contacts
          WHERE email = lower(trim(r->>'email'))
          LIMIT 1;
      END IF;
      IF v_contact_id IS NULL AND trim(coalesce(r->>'first_name','')) != '' THEN
        SELECT id INTO v_contact_id FROM contacts
          WHERE lower(trim(first_name)) = lower(trim(r->>'first_name'))
            AND lower(trim(last_name))  = lower(trim(r->>'last_name'))
            AND user_id = p_user_id
          LIMIT 1;
      END IF;

      IF v_contact_id IS NOT NULL THEN
        -- Enrichissement non-destructif + statut/date toujours mis à jour
        UPDATE contacts SET
          phone           = coalesce(phone, nullif(trim(r->>'phone'),'')),
          title           = coalesce(title, nullif(trim(r->>'title'),'')),
          sector          = coalesce(sector, nullif(trim(r->>'sector'),'')),
          country         = coalesce(country, nullif(trim(r->>'country'),'')),
          linkedin_url    = coalesce(linkedin_url, nullif(trim(r->>'linkedin_url'),'')),
          notes           = coalesce(notes, nullif(trim(r->>'notes'),'')),
          email           = coalesce(email, nullif(lower(trim(r->>'email')),'')),
          base_status     = v_status,
          last_contact_date = coalesce(v_last_date, last_contact_date)
        WHERE id = v_contact_id;
      ELSE
        INSERT INTO contacts (
          first_name, last_name, email, phone, title,
          sector, country, linkedin_url, notes,
          base_status, last_contact_date, user_id
        ) VALUES (
          trim(r->>'first_name'), trim(r->>'last_name'),
          nullif(lower(trim(coalesce(r->>'email',''))),  ''),
          nullif(trim(coalesce(r->>'phone','')),         ''),
          nullif(trim(coalesce(r->>'title','')),         ''),
          nullif(trim(coalesce(r->>'sector','')),        ''),
          nullif(trim(coalesce(r->>'country','')),       ''),
          nullif(trim(coalesce(r->>'linkedin_url','')), ''),
          nullif(trim(coalesce(r->>'notes','')),         ''),
          v_status, v_last_date, p_user_id
        )
        RETURNING id INTO v_contact_id;
      END IF;

      -- Lier à l'organisation
      IF v_org_id IS NOT NULL AND v_contact_id IS NOT NULL THEN
        INSERT INTO organization_contacts (organization_id, contact_id, role_label, is_primary, user_id)
          VALUES (v_org_id, v_contact_id, nullif(trim(r->>'role_label'),''), false, p_user_id)
          ON CONFLICT DO NOTHING;
      END IF;

      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('ligne', v_idx, 'erreur', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', v_ok, 'errors', v_errors);
END;
$$;

-- ── 9. RETROLINK PAR RPC ──────────────────────────────────────
CREATE OR REPLACE FUNCTION retrolink_deal_organizations(
  p_deal_id UUID,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deal_name TEXT;
  v_linked INT := 0;
  v_already INT := 0;
BEGIN
  SELECT name INTO v_deal_name FROM deals WHERE id = p_deal_id AND user_id = p_user_id;
  IF v_deal_name IS NULL THEN
    RETURN jsonb_build_object('error', 'Dossier introuvable');
  END IF;

  -- Lier via deal_name_hint
  INSERT INTO deal_organizations (deal_id, organization_id, user_id)
    SELECT p_deal_id, id, p_user_id
    FROM organizations
    WHERE lower(trim(coalesce(deal_name_hint,''))) = lower(trim(v_deal_name))
      AND user_id = p_user_id
  ON CONFLICT (deal_id, organization_id) DO NOTHING;

  GET DIAGNOSTICS v_linked = ROW_COUNT;

  -- Lier via activités
  INSERT INTO deal_organizations (deal_id, organization_id, user_id)
    SELECT DISTINCT p_deal_id, organization_id, p_user_id
    FROM activities
    WHERE deal_id = p_deal_id
      AND organization_id IS NOT NULL
  ON CONFLICT (deal_id, organization_id) DO NOTHING;

  SELECT count(*) INTO v_already FROM deal_organizations WHERE deal_id = p_deal_id;

  RETURN jsonb_build_object('linked', v_linked, 'total', v_already);
END;
$$;

-- ── 10. FULL-TEXT SEARCH RPC ──────────────────────────────────
CREATE OR REPLACE FUNCTION search_crm(
  p_query TEXT,
  p_user_id UUID,
  p_limit INT DEFAULT 20
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tsq tsquery;
  v_orgs JSONB;
  v_contacts JSONB;
  v_deals JSONB;
BEGIN
  -- Construire la query (supporte préfixes partiels)
  v_tsq := websearch_to_tsquery('french', p_query);

  -- Si query invalide, fallback sur ILIKE
  IF v_tsq IS NULL THEN
    v_tsq := to_tsquery('french', p_query || ':*');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'type', 'organization',
    'name', name, 'sub', coalesce(location,''), 'status', base_status,
    'rank', ts_rank(search_vector, v_tsq)
  ) ORDER BY ts_rank(search_vector, v_tsq) DESC), '[]')
  INTO v_orgs
  FROM organizations
  WHERE user_id = p_user_id
    AND search_vector @@ v_tsq
  LIMIT p_limit / 3;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'type', 'contact',
    'name', first_name || ' ' || last_name,
    'sub', coalesce(email,''), 'status', base_status,
    'rank', ts_rank(search_vector, v_tsq)
  ) ORDER BY ts_rank(search_vector, v_tsq) DESC), '[]')
  INTO v_contacts
  FROM contacts
  WHERE user_id = p_user_id
    AND search_vector @@ v_tsq
  LIMIT p_limit / 3;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'type', 'deal',
    'name', name, 'sub', coalesce(sector,''), 'status', deal_status,
    'rank', ts_rank(search_vector, v_tsq)
  ) ORDER BY ts_rank(search_vector, v_tsq) DESC), '[]')
  INTO v_deals
  FROM deals
  WHERE user_id = p_user_id
    AND search_vector @@ v_tsq
  LIMIT p_limit / 3;

  RETURN jsonb_build_object(
    'organizations', v_orgs,
    'contacts', v_contacts,
    'deals', v_deals
  );
END;
$$;

-- ── 11. VUE MATÉRIALISÉE DASHBOARD ────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS deal_pipeline_stats AS
SELECT
  d.user_id,
  d.id                                  AS deal_id,
  d.name                                AS deal_name,
  d.deal_type,
  d.deal_status,
  d.deal_stage,
  d.priority_level,
  d.target_amount,
  d.currency,
  d.created_at,
  d.target_date,
  coalesce(d.committed_amount, 0)       AS committed_amount,
  coalesce(d.closed_amount, 0)          AS closed_amount,
  count(DISTINCT do_.organization_id)   AS org_count,
  count(DISTINCT oc.contact_id)         AS contact_count,
  count(DISTINCT act.id)                AS activity_count,
  count(DISTINCT t.id) FILTER (WHERE t.task_status = 'open') AS open_tasks,
  max(act.activity_date)                AS last_activity_date,
  -- Taux avancement pipeline investisseurs
  count(DISTINCT ic.id)                 AS commitment_count,
  coalesce(sum(ic.amount) FILTER (WHERE ic.status IN ('hard','signed','transferred')), 0) AS hard_amount,
  coalesce(sum(ic.amount) FILTER (WHERE ic.status IN ('soft','hard','signed','transferred')), 0) AS soft_amount
FROM deals d
LEFT JOIN deal_organizations do_   ON do_.deal_id = d.id
LEFT JOIN organization_contacts oc ON oc.organization_id = do_.organization_id
LEFT JOIN activities act            ON act.deal_id = d.id
LEFT JOIN tasks t                   ON t.deal_id = d.id
LEFT JOIN investor_commitments ic   ON ic.deal_id = d.id
GROUP BY d.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_stats_deal ON deal_pipeline_stats(deal_id);

-- Refresh automatique via cron (à activer dans Supabase Cron)
-- SELECT cron.schedule('refresh-pipeline-stats', '*/15 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY deal_pipeline_stats');
