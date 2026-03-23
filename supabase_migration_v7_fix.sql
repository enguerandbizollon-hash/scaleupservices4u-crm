-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V7 FIX — Supprimer la vue matérialisée AVANT l'alter
-- Exécuter en entier dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Supprimer la vue matérialisée qui bloque
DROP MATERIALIZED VIEW IF EXISTS deal_pipeline_stats;

-- 2. Supprimer les enums et convertir en TEXT
ALTER TABLE organizations
  ALTER COLUMN organization_type TYPE TEXT,
  ALTER COLUMN base_status TYPE TEXT;

ALTER TABLE contacts
  ALTER COLUMN base_status TYPE TEXT;

ALTER TABLE deals
  ALTER COLUMN deal_type TYPE TEXT,
  ALTER COLUMN deal_status TYPE TEXT,
  ALTER COLUMN deal_stage TYPE TEXT,
  ALTER COLUMN priority_level TYPE TEXT;

-- 3. Contraintes CHECK pour maintenir l'intégrité
DO $$ BEGIN
  ALTER TABLE organizations ADD CONSTRAINT chk_org_type CHECK (organization_type IN (
    'client','prospect_client','investor','buyer','target','law_firm','bank',
    'advisor','accounting_firm','family_office','corporate','consulting_firm','other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE organizations ADD CONSTRAINT chk_org_status CHECK (base_status IN (
    'to_qualify','qualified','priority','active','dormant','inactive','excluded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE contacts ADD CONSTRAINT chk_contact_status CHECK (base_status IN (
    'to_qualify','qualified','priority','active','dormant','inactive','excluded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE deals ADD CONSTRAINT chk_deal_type CHECK (deal_type IN (
    'fundraising','ma_sell','ma_buy','cfo_advisor','recruitment'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE deals ADD CONSTRAINT chk_deal_status CHECK (deal_status IN ('active','inactive','closed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE deals ADD CONSTRAINT chk_deal_stage CHECK (deal_stage IN (
    'kickoff','preparation','outreach','management_meetings','dd',
    'negotiation','closing','post_closing','ongoing_support','search'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE deals ADD CONSTRAINT chk_priority CHECK (priority_level IN ('high','medium','low'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Recréer la vue matérialisée
CREATE MATERIALIZED VIEW deal_pipeline_stats AS
SELECT
  d.user_id, d.id AS deal_id, d.name AS deal_name,
  d.deal_type, d.deal_status, d.deal_stage, d.priority_level,
  d.target_amount, d.currency, d.created_at, d.target_date,
  coalesce(d.committed_amount,0) AS committed_amount,
  coalesce(d.closed_amount,0) AS closed_amount,
  count(DISTINCT do_.organization_id) AS org_count,
  count(DISTINCT oc.contact_id) AS contact_count,
  count(DISTINCT act.id) AS activity_count,
  count(DISTINCT t.id) FILTER (WHERE t.task_status='open') AS open_tasks,
  max(act.activity_date) AS last_activity_date,
  count(DISTINCT ic.id) AS commitment_count,
  coalesce(sum(ic.amount) FILTER (WHERE ic.status IN ('hard','signed','transferred')),0) AS hard_amount,
  coalesce(sum(ic.amount) FILTER (WHERE ic.status IN ('soft','hard','signed','transferred')),0) AS soft_amount
FROM deals d
LEFT JOIN deal_organizations do_ ON do_.deal_id = d.id
LEFT JOIN organization_contacts oc ON oc.organization_id = do_.organization_id
LEFT JOIN activities act ON act.deal_id = d.id
LEFT JOIN tasks t ON t.deal_id = d.id
LEFT JOIN investor_commitments ic ON ic.deal_id = d.id
GROUP BY d.id;

CREATE UNIQUE INDEX idx_pipeline_stats_deal ON deal_pipeline_stats(deal_id);

-- 5. RPCs sans cast enum (TEXT natif)
CREATE OR REPLACE FUNCTION bulk_import_organizations(p_rows JSONB, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r JSONB; v_org_id UUID; v_deal_id UUID;
  v_ok INT := 0; v_errors JSONB := '[]'::JSONB;
  v_status TEXT; v_org_type TEXT; v_idx INT := 0;
  v_status_map JSONB := '{"rencontre":"qualified","arencontrer":"to_qualify","contacte":"active","arelancer":"active","qualified":"qualified","active":"active","to_qualify":"to_qualify","priority":"priority","dormant":"dormant","inactive":"inactive","excluded":"excluded"}';
  v_valid_types TEXT[] := ARRAY['client','prospect_client','investor','buyer','target','law_firm','bank','advisor','accounting_firm','family_office','corporate','consulting_firm','other'];
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx := v_idx + 1;
    BEGIN
      IF trim(coalesce(r->>'name',''))='' THEN
        v_errors := v_errors || jsonb_build_object('ligne',v_idx,'erreur','nom manquant'); CONTINUE;
      END IF;
      v_status := coalesce(v_status_map ->> lower(replace(coalesce(r->>'base_status',''),' ','')), 'to_qualify');
      v_org_type := lower(trim(coalesce(r->>'organization_type','other')));
      IF NOT (v_org_type = ANY(v_valid_types)) THEN v_org_type := 'other'; END IF;
      SELECT id INTO v_org_id FROM organizations
        WHERE lower(trim(name))=lower(trim(r->>'name')) AND user_id=p_user_id LIMIT 1;
      IF v_org_id IS NULL THEN
        INSERT INTO organizations (name,organization_type,base_status,sector,location,website,notes,description,investment_ticket,investment_stage,deal_name_hint,user_id)
        VALUES (trim(r->>'name'),v_org_type,v_status,
          nullif(trim(coalesce(r->>'sector','')), ''), nullif(trim(coalesce(r->>'location','')), ''),
          nullif(trim(coalesce(r->>'website','')), ''), nullif(trim(coalesce(r->>'notes','')), ''),
          nullif(trim(coalesce(r->>'description','')), ''),
          nullif(trim(coalesce(r->>'investment_ticket','')), ''),
          nullif(trim(coalesce(r->>'investment_stage','')), ''),
          nullif(trim(coalesce(r->>'deal_name','')), ''), p_user_id)
        RETURNING id INTO v_org_id;
      ELSE
        UPDATE organizations SET organization_type=v_org_type, base_status=v_status,
          sector=coalesce(nullif(trim(coalesce(r->>'sector','')), ''), sector),
          location=coalesce(nullif(trim(coalesce(r->>'location','')), ''), location),
          website=coalesce(nullif(trim(coalesce(r->>'website','')), ''), website),
          notes=coalesce(nullif(trim(coalesce(r->>'notes','')), ''), notes),
          description=coalesce(nullif(trim(coalesce(r->>'description','')), ''), description),
          investment_ticket=coalesce(nullif(trim(coalesce(r->>'investment_ticket','')), ''), investment_ticket),
          investment_stage=coalesce(nullif(trim(coalesce(r->>'investment_stage','')), ''), investment_stage),
          deal_name_hint=coalesce(nullif(trim(coalesce(r->>'deal_name','')), ''), deal_name_hint)
        WHERE id=v_org_id;
      END IF;
      IF nullif(trim(coalesce(r->>'deal_name','')), '') IS NOT NULL THEN
        SELECT id INTO v_deal_id FROM deals
          WHERE lower(trim(name))=lower(trim(r->>'deal_name')) AND user_id=p_user_id LIMIT 1;
        IF v_deal_id IS NOT NULL THEN
          INSERT INTO deal_organizations (deal_id,organization_id,user_id)
            VALUES (v_deal_id,v_org_id,p_user_id) ON CONFLICT (deal_id,organization_id) DO NOTHING;
          IF nullif(trim(coalesce(r->>'contact_date','')), '') IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM activities WHERE organization_id=v_org_id AND deal_id=v_deal_id) THEN
              INSERT INTO activities (title,activity_type,activity_date,organization_id,deal_id,summary,user_id)
              VALUES ('Prise de contact — '||trim(r->>'name'),'email',
                to_date(trim(r->>'contact_date'), CASE WHEN trim(r->>'contact_date') ~ '^\d{2}/\d{2}/\d{4}$' THEN 'DD/MM/YYYY' ELSE 'YYYY-MM-DD' END),
                v_org_id,v_deal_id,'Import CSV',p_user_id);
            END IF;
          END IF;
        END IF;
      END IF;
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('ligne',v_idx,'erreur',SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('ok',v_ok,'errors',v_errors);
END; $$;

CREATE OR REPLACE FUNCTION bulk_import_contacts(p_rows JSONB, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r JSONB; v_contact_id UUID; v_org_id UUID;
  v_ok INT := 0; v_errors JSONB := '[]'::JSONB;
  v_idx INT := 0; v_status TEXT; v_last_date DATE;
  v_valid_statuses TEXT[] := ARRAY['to_qualify','qualified','priority','active','dormant','inactive','excluded'];
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx := v_idx + 1;
    BEGIN
      IF trim(coalesce(r->>'first_name',''))='' OR trim(coalesce(r->>'last_name',''))='' THEN
        v_errors := v_errors || jsonb_build_object('ligne',v_idx,'erreur','prénom/nom manquant'); CONTINUE;
      END IF;
      v_status := lower(trim(coalesce(r->>'base_status','')));
      IF NOT (v_status = ANY(v_valid_statuses)) THEN v_status := 'to_qualify'; END IF;
      v_last_date := NULL;
      BEGIN
        IF nullif(trim(coalesce(r->>'last_contact_date','')), '') IS NOT NULL THEN
          IF trim(r->>'last_contact_date') ~ '^\d{2}/\d{2}/\d{4}$' THEN
            v_last_date := to_date(trim(r->>'last_contact_date'), 'DD/MM/YYYY');
          ELSIF trim(r->>'last_contact_date') ~ '^\d{4}-\d{2}-\d{2}$' THEN
            v_last_date := trim(r->>'last_contact_date')::DATE;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN v_last_date := NULL; END;
      v_org_id := NULL;
      IF nullif(trim(coalesce(r->>'organisation_name','')), '') IS NOT NULL THEN
        SELECT id INTO v_org_id FROM organizations
          WHERE lower(trim(name))=lower(trim(r->>'organisation_name')) AND user_id=p_user_id LIMIT 1;
        IF v_org_id IS NULL THEN
          INSERT INTO organizations (name,organization_type,base_status,user_id)
            VALUES (trim(r->>'organisation_name'),'other','to_qualify',p_user_id) RETURNING id INTO v_org_id;
        END IF;
      END IF;
      v_contact_id := NULL;
      IF nullif(lower(trim(coalesce(r->>'email',''))), '') IS NOT NULL THEN
        SELECT id INTO v_contact_id FROM contacts WHERE email=lower(trim(r->>'email')) LIMIT 1;
      END IF;
      IF v_contact_id IS NULL THEN
        SELECT id INTO v_contact_id FROM contacts
          WHERE lower(trim(first_name))=lower(trim(r->>'first_name'))
            AND lower(trim(last_name))=lower(trim(r->>'last_name'))
            AND user_id=p_user_id LIMIT 1;
      END IF;
      IF v_contact_id IS NOT NULL THEN
        UPDATE contacts SET
          phone=coalesce(phone, nullif(trim(coalesce(r->>'phone','')), '')),
          title=coalesce(title, nullif(trim(coalesce(r->>'title','')), '')),
          sector=coalesce(sector, nullif(trim(coalesce(r->>'sector','')), '')),
          country=coalesce(country, nullif(trim(coalesce(r->>'country','')), '')),
          linkedin_url=coalesce(linkedin_url, nullif(trim(coalesce(r->>'linkedin_url','')), '')),
          notes=coalesce(notes, nullif(trim(coalesce(r->>'notes','')), '')),
          email=coalesce(email, nullif(lower(trim(coalesce(r->>'email',''))), '')),
          base_status=v_status,
          last_contact_date=coalesce(v_last_date, last_contact_date)
        WHERE id=v_contact_id;
      ELSE
        INSERT INTO contacts (first_name,last_name,email,phone,title,sector,country,linkedin_url,notes,base_status,last_contact_date,user_id)
        VALUES (trim(r->>'first_name'),trim(r->>'last_name'),
          nullif(lower(trim(coalesce(r->>'email',''))), ''),
          nullif(trim(coalesce(r->>'phone','')), ''), nullif(trim(coalesce(r->>'title','')), ''),
          nullif(trim(coalesce(r->>'sector','')), ''), nullif(trim(coalesce(r->>'country','')), ''),
          nullif(trim(coalesce(r->>'linkedin_url','')), ''), nullif(trim(coalesce(r->>'notes','')), ''),
          v_status, v_last_date, p_user_id)
        RETURNING id INTO v_contact_id;
      END IF;
      IF v_org_id IS NOT NULL AND v_contact_id IS NOT NULL THEN
        INSERT INTO organization_contacts (organization_id,contact_id,role_label,is_primary,user_id)
          VALUES (v_org_id,v_contact_id,nullif(trim(coalesce(r->>'role_label','')), ''),false,p_user_id)
          ON CONFLICT DO NOTHING;
      END IF;
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('ligne',v_idx,'erreur',SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('ok',v_ok,'errors',v_errors);
END; $$;

CREATE OR REPLACE FUNCTION retrolink_deal_organizations(p_deal_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_deal_name TEXT; v_linked INT := 0; v_total INT := 0;
BEGIN
  SELECT name INTO v_deal_name FROM deals WHERE id=p_deal_id AND user_id=p_user_id;
  IF v_deal_name IS NULL THEN RETURN jsonb_build_object('error','Dossier introuvable'); END IF;
  INSERT INTO deal_organizations (deal_id,organization_id,user_id)
    SELECT p_deal_id,id,p_user_id FROM organizations
    WHERE lower(trim(coalesce(deal_name_hint,'')))=lower(trim(v_deal_name)) AND user_id=p_user_id
  ON CONFLICT (deal_id,organization_id) DO NOTHING;
  GET DIAGNOSTICS v_linked = ROW_COUNT;
  INSERT INTO deal_organizations (deal_id,organization_id,user_id)
    SELECT DISTINCT p_deal_id,organization_id,p_user_id FROM activities
    WHERE deal_id=p_deal_id AND organization_id IS NOT NULL
  ON CONFLICT (deal_id,organization_id) DO NOTHING;
  SELECT count(*) INTO v_total FROM deal_organizations WHERE deal_id=p_deal_id;
  RETURN jsonb_build_object('linked',v_linked,'total',v_total);
END; $$;
