-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V8 — Import atomic orgs+contacts en une transaction
-- ═══════════════════════════════════════════════════════════════

-- Vérifier/créer la contrainte unique sur organization_contacts
DO $$ BEGIN
  ALTER TABLE organization_contacts 
    ADD CONSTRAINT oc_unique UNIQUE (organization_id, contact_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RPC unique : importe orgs ET contacts ET fait tous les liens
CREATE OR REPLACE FUNCTION import_deal_dataset(
  p_deal_name TEXT,
  p_orgs      JSONB,
  p_contacts  JSONB,
  p_user_id   UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r           JSONB;
  v_deal_id   UUID;
  v_org_id    UUID;
  v_contact_id UUID;
  v_status    TEXT;
  v_ok_orgs   INT := 0;
  v_ok_cons   INT := 0;
  v_ok_links  INT := 0;
  v_errors    JSONB := '[]'::JSONB;
  v_idx       INT;
  v_last_date DATE;
  v_valid_statuses TEXT[] := ARRAY['to_qualify','qualified','priority','active','dormant','inactive','excluded'];
  v_valid_types    TEXT[] := ARRAY['client','prospect_client','investor','buyer','target',
    'law_firm','bank','advisor','accounting_firm','family_office','corporate','consulting_firm','other'];
  v_status_map JSONB := '{
    "rencontre":"qualified","arencontrer":"to_qualify","contacte":"active",
    "arelancer":"active","qualified":"qualified","active":"active",
    "to_qualify":"to_qualify","priority":"priority","dormant":"dormant",
    "inactive":"inactive","excluded":"excluded"
  }';
  -- Map org_name → org_id (construit pendant l'import des orgs)
  v_org_map   JSONB := '{}'::JSONB;
BEGIN

  -- ── 1. Résoudre le deal ──────────────────────────────────────
  SELECT id INTO v_deal_id FROM deals
    WHERE lower(trim(name)) = lower(trim(p_deal_name))
      AND user_id = p_user_id
    LIMIT 1;

  IF v_deal_id IS NULL THEN
    -- Créer le deal si inexistant
    INSERT INTO deals (name, deal_type, deal_status, deal_stage, priority_level, user_id)
      VALUES (trim(p_deal_name), 'fundraising', 'active', 'outreach', 'high', p_user_id)
    RETURNING id INTO v_deal_id;
  END IF;

  -- ── 2. Importer les organisations ────────────────────────────
  v_idx := 0;
  FOR r IN SELECT * FROM jsonb_array_elements(p_orgs) LOOP
    v_idx := v_idx + 1;
    BEGIN
      IF trim(coalesce(r->>'name','')) = '' THEN CONTINUE; END IF;

      v_status := coalesce(
        v_status_map ->> lower(replace(coalesce(r->>'base_status',''),' ','')),
        'to_qualify'
      );
      
      DECLARE v_org_type TEXT;
      BEGIN
        v_org_type := lower(trim(coalesce(r->>'organization_type','other')));
        IF NOT (v_org_type = ANY(v_valid_types)) THEN v_org_type := 'other'; END IF;
        
        -- Upsert org
        SELECT id INTO v_org_id FROM organizations
          WHERE lower(trim(name)) = lower(trim(r->>'name')) AND user_id = p_user_id LIMIT 1;

        IF v_org_id IS NULL THEN
          INSERT INTO organizations (
            name, organization_type, base_status, sector, location,
            website, description, investment_ticket, investment_stage,
            deal_name_hint, user_id
          ) VALUES (
            trim(r->>'name'), v_org_type, v_status,
            nullif(trim(coalesce(r->>'sector','')), ''),
            nullif(trim(coalesce(r->>'location','')), ''),
            nullif(trim(coalesce(r->>'website','')), ''),
            nullif(trim(coalesce(r->>'description','')), ''),
            nullif(trim(coalesce(r->>'investment_ticket','')), ''),
            nullif(trim(coalesce(r->>'investment_stage','')), ''),
            p_deal_name, p_user_id
          ) RETURNING id INTO v_org_id;
        ELSE
          UPDATE organizations SET
            organization_type = v_org_type, base_status = v_status,
            sector      = coalesce(nullif(trim(coalesce(r->>'sector','')), ''), sector),
            location    = coalesce(nullif(trim(coalesce(r->>'location','')), ''), location),
            website     = coalesce(nullif(trim(coalesce(r->>'website','')), ''), website),
            description = coalesce(nullif(trim(coalesce(r->>'description','')), ''), description),
            investment_ticket = coalesce(nullif(trim(coalesce(r->>'investment_ticket','')), ''), investment_ticket),
            investment_stage  = coalesce(nullif(trim(coalesce(r->>'investment_stage','')), ''), investment_stage),
            deal_name_hint = p_deal_name
          WHERE id = v_org_id;
        END IF;

        -- Lier au deal IMMÉDIATEMENT
        INSERT INTO deal_organizations (deal_id, organization_id, user_id)
          VALUES (v_deal_id, v_org_id, p_user_id)
          ON CONFLICT (deal_id, organization_id) DO NOTHING;

        -- Créer activité si date fournie
        IF nullif(trim(coalesce(r->>'contact_date','')), '') IS NOT NULL THEN
          IF NOT EXISTS (SELECT 1 FROM activities WHERE organization_id=v_org_id AND deal_id=v_deal_id) THEN
            DECLARE v_date DATE;
            BEGIN
              IF trim(r->>'contact_date') ~ '^\d{2}/\d{2}/\d{4}$' THEN
                v_date := to_date(trim(r->>'contact_date'), 'DD/MM/YYYY');
              ELSE
                v_date := trim(r->>'contact_date')::DATE;
              END IF;
              INSERT INTO activities (title,activity_type,activity_date,organization_id,deal_id,summary,user_id)
                VALUES ('Prise de contact — '||trim(r->>'name'),'email',v_date,v_org_id,v_deal_id,'Import',p_user_id);
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
          END IF;
        END IF;

        -- Stocker dans la map org_name → org_id pour les contacts
        v_org_map := jsonb_set(v_org_map, ARRAY[lower(trim(r->>'name'))], to_jsonb(v_org_id::text));
        v_ok_orgs := v_ok_orgs + 1;
      END;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('type','org','idx',v_idx,'err',SQLERRM);
    END;
  END LOOP;

  -- ── 3. Importer les contacts ─────────────────────────────────
  v_idx := 0;
  FOR r IN SELECT * FROM jsonb_array_elements(p_contacts) LOOP
    v_idx := v_idx + 1;
    BEGIN
      IF trim(coalesce(r->>'first_name',''))='' OR trim(coalesce(r->>'last_name',''))='' THEN
        CONTINUE;
      END IF;

      v_status := lower(trim(coalesce(r->>'base_status','')));
      IF NOT (v_status = ANY(v_valid_statuses)) THEN v_status := 'to_qualify'; END IF;

      -- Parser date
      v_last_date := NULL;
      BEGIN
        IF nullif(trim(coalesce(r->>'last_contact_date','')), '') IS NOT NULL THEN
          IF trim(r->>'last_contact_date') ~ '^\d{2}/\d{2}/\d{4}$' THEN
            v_last_date := to_date(trim(r->>'last_contact_date'), 'DD/MM/YYYY');
          ELSIF trim(r->>'last_contact_date') ~ '^\d{4}-\d{2}-\d{2}$' THEN
            v_last_date := trim(r->>'last_contact_date')::DATE;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN v_last_date := NULL;
      END;

      -- Résoudre org depuis la map construite à l'étape 2
      v_org_id := NULL;
      IF nullif(trim(coalesce(r->>'organisation_name','')), '') IS NOT NULL THEN
        DECLARE v_org_key TEXT; v_org_val TEXT;
        BEGIN
          v_org_key := lower(trim(r->>'organisation_name'));
          v_org_val := v_org_map ->> v_org_key;
          IF v_org_val IS NOT NULL THEN
            v_org_id := v_org_val::UUID;
          ELSE
            -- Fallback: chercher en base
            SELECT id INTO v_org_id FROM organizations
              WHERE lower(trim(name)) = v_org_key AND user_id = p_user_id LIMIT 1;
            IF v_org_id IS NOT NULL THEN
              v_org_map := jsonb_set(v_org_map, ARRAY[v_org_key], to_jsonb(v_org_id::text));
            END IF;
          END IF;
        END;
      END IF;

      -- Déduplication contact
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
          base_status = v_status,
          last_contact_date = coalesce(v_last_date, last_contact_date),
          email    = coalesce(email, nullif(lower(trim(coalesce(r->>'email',''))), '')),
          phone    = coalesce(phone, nullif(trim(coalesce(r->>'phone','')), '')),
          title    = coalesce(title, nullif(trim(coalesce(r->>'title','')), '')),
          linkedin_url = coalesce(linkedin_url, nullif(trim(coalesce(r->>'linkedin_url','')), ''))
        WHERE id = v_contact_id;
      ELSE
        INSERT INTO contacts (first_name,last_name,email,phone,title,sector,country,linkedin_url,base_status,last_contact_date,user_id)
        VALUES (
          trim(r->>'first_name'), trim(r->>'last_name'),
          nullif(lower(trim(coalesce(r->>'email',''))), ''),
          nullif(trim(coalesce(r->>'phone','')), ''),
          nullif(trim(coalesce(r->>'title','')), ''),
          nullif(trim(coalesce(r->>'sector','')), ''),
          nullif(trim(coalesce(r->>'country','')), ''),
          nullif(trim(coalesce(r->>'linkedin_url','')), ''),
          v_status, v_last_date, p_user_id
        ) RETURNING id INTO v_contact_id;
      END IF;

      -- Lier contact → org (immédiatement)
      IF v_org_id IS NOT NULL AND v_contact_id IS NOT NULL THEN
        INSERT INTO organization_contacts (organization_id,contact_id,role_label,is_primary,user_id)
          VALUES (v_org_id, v_contact_id, nullif(trim(coalesce(r->>'role_label','')), ''), false, p_user_id)
          ON CONFLICT (organization_id, contact_id) DO NOTHING;
        v_ok_links := v_ok_links + 1;
      END IF;

      v_ok_cons := v_ok_cons + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('type','contact','idx',v_idx,'err',SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'deal_id',   v_deal_id,
    'ok_orgs',   v_ok_orgs,
    'ok_contacts', v_ok_cons,
    'ok_links',  v_ok_links,
    'errors',    v_errors
  );
END; $$;
