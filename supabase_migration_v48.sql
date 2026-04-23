-- V48 : Rattrapage structural — CREATE TABLE manquantes
--
-- Contexte : l'audit cohérence spec CLAUDE.md ↔ migrations SQL a révélé
-- que plusieurs tables et colonnes documentées n'ont jamais été créées
-- par une migration trackée. En dev, ça marche car la DB a été
-- initialisée pré-v23 avec un schéma *partiel*. En prod fresh, les
-- migrations v23+ échoueraient. Même en dev, certaines colonnes
-- manquantes (ex: candidates.current_organization_id) provoquent déjà
-- des bugs latents (crash INDEX sur colonne inexistante).
--
-- Stratégie idempotente à trois niveaux, appliquée sur chaque table :
--   1. CREATE TABLE IF NOT EXISTS  (pour DB fresh)
--   2. ALTER TABLE ADD COLUMN IF NOT EXISTS  (pour DB partielle pré-v23)
--   3. CREATE INDEX IF NOT EXISTS  (après garantie colonnes présentes)
--
-- Résultat : safe sur DB fresh ET sur DB partielle existante.
-- Aucune suppression, aucun backfill, aucun changement de type.
--
-- Source de vérité : CLAUDE.md, enrichi des colonnes référencées par
-- le code existant (contacts.investment_ticket_label, country,
-- first/last_contact_at, etc.) pour cohérence prod-fresh.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — organizations : external_ids (déduplication multi-connecteurs)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS external_ids JSONB DEFAULT '{}'::jsonb;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2 — contacts (référencée par actions/v35, deals/v36 dirigeant_id)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contacts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name              TEXT,
  last_name               TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Rattrapage colonnes pour DB partielle pré-v23
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS full_name                TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email                    TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone                    TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linkedin_url             TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS title                    TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sector                   TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS country                  TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS investment_ticket_label  TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS base_status              TEXT DEFAULT 'to_qualify';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes                    TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes_internal           TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS do_not_contact           BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_date        DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_contact_at         TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_at          TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_follow_up_at        TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rgpd_consent             BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rgpd_consent_date        TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rgpd_expiry_date         DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS anonymized_at            TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_contacts_user   ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email  ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(base_status);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own contacts" ON contacts
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3 — organization_contacts (pivot N-N orgs ↔ contacts)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS organization_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  contact_id      UUID NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE organization_contacts ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE organization_contacts ADD COLUMN IF NOT EXISTS role_label TEXT;
ALTER TABLE organization_contacts ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_org_contacts_org     ON organization_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_contacts_contact ON organization_contacts(contact_id);

ALTER TABLE organization_contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own org_contacts" ON organization_contacts
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4 — candidates (référencée par actions/v39, module RH)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS candidates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Rattrapage colonnes pour DB partielle pré-v23
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email                    TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone                    TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS linkedin_url             TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_url                   TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS title                    TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_title            TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS contact_id               UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS seniority                TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS key_skills               TEXT[] DEFAULT '{}';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS target_sectors           TEXT[] DEFAULT '{}';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS target_geographies       TEXT[] DEFAULT '{}';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS remote_policy            TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_min               NUMERIC;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_max               NUMERIC;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS currency                 TEXT DEFAULT 'EUR';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS candidate_status         TEXT DEFAULT 'searching';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS global_status            TEXT DEFAULT 'searching';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_confidential          BOOLEAN DEFAULT TRUE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notes                    TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notes_internal           TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notes_shareable          TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source                   TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS rgpd_consent             BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS rgpd_consent_date        TIMESTAMPTZ;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS rgpd_expiry_date         DATE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS anonymized_at            TIMESTAMPTZ;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_candidates_user   ON candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(candidate_status);
CREATE INDEX IF NOT EXISTS idx_candidates_org    ON candidates(current_organization_id);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own candidates" ON candidates
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5 — candidate_status_log (historique immuable, CLAUDE.md §M5)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS candidate_status_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE candidate_status_log ADD COLUMN IF NOT EXISTS old_status  TEXT;
ALTER TABLE candidate_status_log ADD COLUMN IF NOT EXISTS new_status  TEXT;
ALTER TABLE candidate_status_log ADD COLUMN IF NOT EXISTS note        TEXT;
ALTER TABLE candidate_status_log ADD COLUMN IF NOT EXISTS changed_by  UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_candidate_log_candidate ON candidate_status_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_log_created   ON candidate_status_log(created_at DESC);

ALTER TABLE candidate_status_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own candidate logs" ON candidate_status_log
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 6 — deal_candidates (pivot N-N deal ↔ candidate, pipeline RH)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS deal_candidates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id       UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deal_candidates ADD COLUMN IF NOT EXISTS stage            TEXT DEFAULT 'sourcing';
ALTER TABLE deal_candidates ADD COLUMN IF NOT EXISTS needs_review     BOOLEAN DEFAULT FALSE;
ALTER TABLE deal_candidates ADD COLUMN IF NOT EXISTS technical_score  NUMERIC;
ALTER TABLE deal_candidates ADD COLUMN IF NOT EXISTS financial_score  NUMERIC;
ALTER TABLE deal_candidates ADD COLUMN IF NOT EXISTS combined_score   NUMERIC;
ALTER TABLE deal_candidates ADD COLUMN IF NOT EXISTS placement_fee    NUMERIC;
ALTER TABLE deal_candidates ADD COLUMN IF NOT EXISTS notes            TEXT;
ALTER TABLE deal_candidates ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_deal_candidates_deal      ON deal_candidates(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_candidates_candidate ON deal_candidates(candidate_id);
CREATE INDEX IF NOT EXISTS idx_deal_candidates_stage     ON deal_candidates(stage);

ALTER TABLE deal_candidates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own deal_candidates" ON deal_candidates
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 7 — deal_organizations (référencée v36 ALTER TABLE)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS deal_organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deal_organizations ADD COLUMN IF NOT EXISTS user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE deal_organizations ADD COLUMN IF NOT EXISTS role_in_dossier TEXT;

CREATE INDEX IF NOT EXISTS idx_deal_orgs_deal ON deal_organizations(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_orgs_org  ON deal_organizations(organization_id);

ALTER TABLE deal_organizations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own deal_organizations" ON deal_organizations
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 8 — ma_documents (documents dossier avec versioning + IA)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ma_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS deal_id                 UUID REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS organization_id         UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS candidate_id            UUID REFERENCES candidates(id) ON DELETE SET NULL;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS document_type           TEXT;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS file_name               TEXT;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS file_size               INTEGER;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS fiscal_year             INTEGER;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS current_version_number  INTEGER DEFAULT 1;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS ai_extracted_data       JSONB;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS ai_summary              TEXT;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS ai_processed_at         TIMESTAMPTZ;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS ai_confidence_score     NUMERIC;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS is_confidential         BOOLEAN DEFAULT TRUE;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS source                  TEXT;
ALTER TABLE ma_documents ADD COLUMN IF NOT EXISTS external_id             TEXT;

CREATE INDEX IF NOT EXISTS idx_ma_documents_deal ON ma_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_ma_documents_org  ON ma_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_ma_documents_cand ON ma_documents(candidate_id);

ALTER TABLE ma_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own ma_documents" ON ma_documents
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 9 — deal_documents (référencée v34 document_versions.document_id)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS deal_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  added_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS document_type   TEXT;
ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS document_status TEXT;
ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS document_url    TEXT;
ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS version_label   TEXT;
ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS note            TEXT;

CREATE INDEX IF NOT EXISTS idx_deal_documents_deal ON deal_documents(deal_id);

ALTER TABLE deal_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own deal_documents" ON deal_documents
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 10 — investor_commitments (pipeline investisseurs Fundraising)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS investor_commitments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id     UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE investor_commitments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE investor_commitments ADD COLUMN IF NOT EXISTS amount          NUMERIC;
ALTER TABLE investor_commitments ADD COLUMN IF NOT EXISTS currency        TEXT DEFAULT 'EUR';
ALTER TABLE investor_commitments ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'indication';
ALTER TABLE investor_commitments ADD COLUMN IF NOT EXISTS committed_at    DATE;
ALTER TABLE investor_commitments ADD COLUMN IF NOT EXISTS notes           TEXT;
ALTER TABLE investor_commitments ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_investor_commitments_deal ON investor_commitments(deal_id);
CREATE INDEX IF NOT EXISTS idx_investor_commitments_org  ON investor_commitments(organization_id);

ALTER TABLE investor_commitments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own investor_commitments" ON investor_commitments
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 11 — rgpd_log (audit trail RGPD, CLAUDE.md §RGPD)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rgpd_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rgpd_log ADD COLUMN IF NOT EXISTS object_type   TEXT;
ALTER TABLE rgpd_log ADD COLUMN IF NOT EXISTS object_id     UUID;
ALTER TABLE rgpd_log ADD COLUMN IF NOT EXISTS action        TEXT;
ALTER TABLE rgpd_log ADD COLUMN IF NOT EXISTS performed_by  UUID REFERENCES auth.users(id);
ALTER TABLE rgpd_log ADD COLUMN IF NOT EXISTS notes         TEXT;

CREATE INDEX IF NOT EXISTS idx_rgpd_log_object  ON rgpd_log(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_rgpd_log_created ON rgpd_log(created_at DESC);

ALTER TABLE rgpd_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users read own rgpd_log" ON rgpd_log
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Registre (garde-fou build)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v48') ON CONFLICT (version) DO NOTHING;

-- Vérification complète :
-- SELECT table_name FROM information_schema.tables WHERE table_schema='public'
--  AND table_name IN (
--    'contacts','organization_contacts','candidates','candidate_status_log',
--    'deal_candidates','deal_organizations','ma_documents','deal_documents',
--    'investor_commitments','rgpd_log'
--  )
--  ORDER BY table_name;
--
-- Les colonnes critiques :
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name='candidates'
--    AND column_name IN ('current_organization_id','candidate_status','contact_id')
--  ORDER BY column_name;
