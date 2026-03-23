-- ═══════════════════════════════════════════════════════════════
-- MIGRATION V7 — Convertir enums → TEXT + RPCs corrigées
-- Exécuter en entier dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. CONVERTIR LES ENUMS EN TEXT ────────────────────────────
-- Plus de problèmes de cast, même flexibilité, contraintes CHECK

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

-- Ajouter des contraintes CHECK pour maintenir l'intégrité
ALTER TABLE organizations
  ADD CONSTRAINT chk_org_type CHECK (organization_type IN (
    'client','prospect_client','investor','buyer','target','law_firm','bank',
    'advisor','accounting_firm','family_office','corporate','consulting_firm','other'
  )),
  ADD CONSTRAINT chk_org_status CHECK (base_status IN (
    'to_qualify','qualified','priority','active','dormant','inactive','excluded'
  ));

ALTER TABLE contacts
  ADD CONSTRAINT chk_contact_status CHECK (base_status IN (
    'to_qualify','qualified','priority','active','dormant','inactive','excluded'
  ));

ALTER TABLE deals
  ADD CONSTRAINT chk_deal_type CHECK (deal_type IN (
    'fundraising','ma_sell','ma_buy','cfo_advisor','recruitment'
  )),
  ADD CONSTRAINT chk_deal_status CHECK (deal_status IN ('active','inactive','closed')),
  ADD CONSTRAINT chk_deal_stage CHECK (deal_stage IN (
    'kickoff','preparation','outreach','management_meetings','dd',
    'negotiation','closing','post_closing','ongoing_support','search'
  )),
  ADD CONSTRAINT chk_priority CHECK (priority_level IN ('high','medium','low'));

-- ── 2. RPC IMPORT ORGANISATIONS (sans cast enum) ──────────────
CREATE OR REPLACE FUNCTION bulk_import_organizations(p_rows JSONB, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r JSONB; v_org_id UUID; v_deal_id UUID;
  v_ok INT := 0; v_errors JSONB := '[]'::JSONB;
  v_status TEXT; v_org_type TEXT; v_idx INT := 0;
  v_status_map JSONB := '{
    "rencontre":"qualified","arencontrer":"to_qualify","contacte":"active",
    "arelancer":"active","qualified":"qualified","active":"active",
    "to_qualify":"to_qualify","priority":"priority","dormant":"dormant",
    "inactive":"inactive","excluded":"excluded"
  }';
  v_valid_types TEXT[] := ARRAY['client','prospect_client','investor','buyer','target',
    'law_firm','bank','advisor','accounting_firm','family_office','corporate','consulting_firm','other'];
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx := v_idx + 1;
    BEGIN
      IF trim(coalesce(r->>'name','')) = '' THEN
        v_errors := v_errors || jsonb_build_object('ligne',v_idx,'erreur','nom manquant');
        CONTINUE;
      END IF;

      v_status := coalesce(
        v_status_map ->> lower(replace(coalesce(r->>'base_status',''),' ','')),
        'to_qualify'
      );

      v_org_type := lower(trim(coalesce(r->>'organization_type','other')));
      IF NOT (v_org_type = ANY(v_valid_types)) THEN v_org_type := 'other'; END IF;

      SELECT id INTO v_org_id FROM organizations
        WHERE lower(trim(name)) = lower(trim(r->>'name')) AND user_id = p_user_id LIMIT 1;

      IF v_org_id IS NULL THEN
        INSERT INTO organizations (
          name, organization_type, base_status, sector, location,
          website, notes, description, investment_ticket, investment_stage,
          deal_name_hint, user_id
        ) VALUES (
          trim(r->>'name'), v_org_type, v_status,
          nullif(trim(coalesce(r->>'sector','')), ''),
          nullif(trim(coalesce(r->>'location','')), ''),
          nullif(trim(coalesce(r->>'website','')), ''),
          nullif(trim(coalesce(r->>'notes','')), ''),
          nullif(trim(coalesce(r->>'description','')), ''),
          nullif(trim(coalesce(r->>'investment_ticket','')), ''),
          nullif(trim(coalesce(r->>'investment_stage','')), ''),
          nullif(trim(coalesce(r->>'deal_name','')), ''),
          p_user_id
        ) RETURNING id INTO v_org_id;
      ELSE
        UPDATE organizations SET
          organization_type  = v_org_type,
          base_status        = v_status,
          sector             = coalesce(nullif(trim(coalesce(r->>'sector','')), ''), sector),
          location           = coalesce(nullif(trim(coalesce(r->>'location','')), ''), location),
          website            = coalesce(nullif(trim(coalesce(r->>'website','')), ''), website),
          notes              = coalesce(nullif(trim(coalesce(r->>'notes','')), ''), notes),
          description        = coalesce(nullif(trim(coalesce(r->>'description','')), ''), description),
          investment_ticket  = coalesce(nullif(trim(coalesce(r->>'investment_ticket','')), ''), investment_ticket),
          investment_stage   = coalesce(nullif(trim(coalesce(r->>'investment_stage','')), ''), investment_stage),
          deal_name_hint     = coalesce(nullif(trim(coalesce(r->>'deal_name','')), ''), deal_name_hint)
        WHERE id = v_org_id;
      END IF;

      -- Lier au dossier
      IF nullif(trim(coalesce(r->>'deal_name','')), '') IS NOT NULL THEN
        SELECT id INTO v_deal_id FROM deals
          WHERE lower(trim(name)) = lower(trim(r->>'deal_name')) AND user_id = p_user_id LIMIT 1;
        IF v_deal_id IS NOT NULL THEN
          INSERT INTO deal_organizations (deal_id, organization_id, user_id)
            VALUES (v_deal_id, v_org_id, p_user_id)
            ON CONFLICT (deal_id, organization_id) DO NOTHING;
          IF nullif(trim(coalesce(r->>'contact_date','')), '') IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM activities WHERE organization_id=v_org_id AND deal_id=v_deal_id) THEN
              INSERT INTO activities (title, activity_type, activity_date, organization_id, deal_id, summary, user_id)
              VALUES (
                'Prise de contact — ' || trim(r->>'name'), 'email',
                to_date(trim(r->>'contact_date'), CASE
                  WHEN trim(r->>'contact_date') ~ '^\d{2}/\d{2}/\d{4}$' THEN 'DD/MM/YYYY'
                  ELSE 'YYYY-MM-DD' END),
                v_org_id, v_deal_id, 'Import CSV', p_user_id
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
END; $$;

-- ── 3. RPC IMPORT CONTACTS (sans cast enum) ───────────────────
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
        v_errors := v_errors || jsonb_build_object('ligne',v_idx,'erreur','prénom/nom manquant');
        CONTINUE;
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

      -- Résoudre organisation
      v_org_id := NULL;
      IF nullif(trim(coalesce(r->>'organisation_name','')), '') IS NOT NULL THEN
        SELECT id INTO v_org_id FROM organizations
          WHERE lower(trim(name)) = lower(trim(r->>'organisation_name'))
            AND user_id = p_user_id LIMIT 1;
        IF v_org_id IS NULL THEN
          INSERT INTO organizations (name, organization_type, base_status, user_id)
            VALUES (trim(r->>'organisation_name'), 'other', 'to_qualify', p_user_id)
          RETURNING id INTO v_org_id;
        END IF;
      END IF;

      -- Déduplication
      v_contact_id := NULL;
      IF nullif(lower(trim(coalesce(r->>'email',''))), '') IS NOT NULL THEN
        SELECT id INTO v_contact_id FROM contacts
          WHERE email = lower(trim(r->>'email')) LIMIT 1;
      END IF;
      IF v_contact_id IS NULL THEN
        SELECT id INTO v_contact_id FROM contacts
          WHERE lower(trim(first_name)) = lower(trim(r->>'first_name'))
            AND lower(trim(last_name))  = lower(trim(r->>'last_name'))
            AND user_id = p_user_id LIMIT 1;
      END IF;

      IF v_contact_id IS NOT NULL THEN
        UPDATE contacts SET
          phone         = coalesce(phone,         nullif(trim(coalesce(r->>'phone','')), '')),
          title         = coalesce(title,         nullif(trim(coalesce(r->>'title','')), '')),
          sector        = coalesce(sector,        nullif(trim(coalesce(r->>'sector','')), '')),
          country       = coalesce(country,       nullif(trim(coalesce(r->>'country','')), '')),
          linkedin_url  = coalesce(linkedin_url,  nullif(trim(coalesce(r->>'linkedin_url','')), '')),
          notes         = coalesce(notes,         nullif(trim(coalesce(r->>'notes','')), '')),
          email         = coalesce(email,         nullif(lower(trim(coalesce(r->>'email',''))), '')),
          base_status   = v_status,
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
          nullif(trim(coalesce(r->>'phone','')),          ''),
          nullif(trim(coalesce(r->>'title','')),          ''),
          nullif(trim(coalesce(r->>'sector','')),         ''),
          nullif(trim(coalesce(r->>'country','')),        ''),
          nullif(trim(coalesce(r->>'linkedin_url','')),  ''),
          nullif(trim(coalesce(r->>'notes','')),          ''),
          v_status, v_last_date, p_user_id
        ) RETURNING id INTO v_contact_id;
      END IF;

      -- Lier à l'organisation
      IF v_org_id IS NOT NULL AND v_contact_id IS NOT NULL THEN
        INSERT INTO organization_contacts (organization_id, contact_id, role_label, is_primary, user_id)
          VALUES (v_org_id, v_contact_id, nullif(trim(coalesce(r->>'role_label','')), ''), false, p_user_id)
          ON CONFLICT DO NOTHING;
      END IF;

      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('ligne', v_idx, 'erreur', SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('ok', v_ok, 'errors', v_errors);
END; $$;

-- ── 4. METTRE À JOUR LES ROUTES PATCH (statuts) ───────────────
-- Les routes API PATCH envoient du texte → plus de problème de cast
-- RAS, elles utilisent supabase-js qui gère le TEXT nativement

-- ── 5. REFRESH INDEX FULL-TEXT ────────────────────────────────
UPDATE organizations SET search_vector = search_vector WHERE search_vector IS NOT NULL;
UPDATE contacts SET search_vector = search_vector WHERE search_vector IS NOT NULL;
