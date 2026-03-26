-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION V18 — Module RH M1 : Vivier candidats
-- 8 tables + RLS + indexes
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. CANDIDATES — vivier global ───────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  linkedin_url      TEXT,
  cv_url            TEXT,
  title             TEXT,
  current_company   TEXT,
  location          TEXT,
  seniority         TEXT,
  remote_preference TEXT,
  salary_current    NUMERIC,
  salary_target     NUMERIC,
  candidate_status  TEXT NOT NULL DEFAULT 'searching'
                    CHECK (candidate_status IN ('searching','in_process','placed','employed','inactive','blacklisted')),
  notes_internal    TEXT,
  notes_shareable   TEXT,
  is_confidential   BOOLEAN NOT NULL DEFAULT false,
  source            TEXT NOT NULL DEFAULT 'manual',
  external_id       TEXT,
  available_from    DATE,
  last_contact_date DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own candidates" ON candidates
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_candidates_user        ON candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status      ON candidates(candidate_status);
CREATE INDEX IF NOT EXISTS idx_candidates_name        ON candidates(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_candidates_last_contact ON candidates(last_contact_date);

-- ── 2. CANDIDATE_STATUS_LOG — log immuable (INSERT uniquement) ──────
CREATE TABLE IF NOT EXISTS candidate_status_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  old_status    TEXT,
  new_status    TEXT NOT NULL,
  note          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE candidate_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own candidate_status_log" ON candidate_status_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own candidate_status_log" ON candidate_status_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_csl_candidate ON candidate_status_log(candidate_id);

-- ── 3. CANDIDATE_JOBS — historique postes ───────────────────────────
CREATE TABLE IF NOT EXISTS candidate_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  company_name    TEXT,
  title           TEXT NOT NULL,
  start_date      DATE,
  end_date        DATE,
  is_current      BOOLEAN NOT NULL DEFAULT false,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE candidate_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own candidate_jobs" ON candidate_jobs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cjobs_candidate ON candidate_jobs(candidate_id);

-- ── 4. DEAL_CANDIDATES — pivot dossier ↔ candidat ──────────────────
CREATE TABLE IF NOT EXISTS deal_candidates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  stage           TEXT NOT NULL DEFAULT 'sourcing',
  combined_score  NUMERIC,
  is_confidential BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, candidate_id)
);

ALTER TABLE deal_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own deal_candidates" ON deal_candidates
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_dc_deal      ON deal_candidates(deal_id);
CREATE INDEX IF NOT EXISTS idx_dc_candidate ON deal_candidates(candidate_id);

-- ── 5. CANDIDATE_STAGES — pipeline personnalisable par dossier ──────
CREATE TABLE IF NOT EXISTS candidate_stages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE candidate_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own candidate_stages" ON candidate_stages
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cstages_deal ON candidate_stages(deal_id);

-- ── 6. CANDIDATE_INTERVIEWS — entretiens ────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_interviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_candidate_id UUID REFERENCES deal_candidates(id) ON DELETE SET NULL,
  candidate_id      UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  deal_id           UUID REFERENCES deals(id) ON DELETE SET NULL,
  user_id           UUID NOT NULL REFERENCES auth.users(id),
  interviewer       TEXT,
  interview_date    TIMESTAMPTZ,
  interview_type    TEXT CHECK (interview_type IN ('rh','client','technique','autre')),
  score             NUMERIC CHECK (score BETWEEN 0 AND 10),
  feedback          TEXT,
  recommendation    TEXT CHECK (recommendation IN ('go','no_go','maybe')),
  is_confidential   BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE candidate_interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own candidate_interviews" ON candidate_interviews
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cint_candidate ON candidate_interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_cint_deal      ON candidate_interviews(deal_id);

-- ── 7. CANDIDATE_SKILLS — compétences scorées ───────────────────────
CREATE TABLE IF NOT EXISTS candidate_skills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  skill_name   TEXT NOT NULL,
  level        TEXT CHECK (level IN ('junior','mid','senior','expert')),
  is_shareable BOOLEAN NOT NULL DEFAULT true,
  weight       NUMERIC NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE candidate_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own candidate_skills" ON candidate_skills
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cskills_candidate ON candidate_skills(candidate_id);

-- ── 8. DEAL_REQUIRED_SKILLS — compétences requises par poste ────────
CREATE TABLE IF NOT EXISTS deal_required_skills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  skill_name   TEXT NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  weight       NUMERIC NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE deal_required_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own deal_required_skills" ON deal_required_skills
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_drs_deal ON deal_required_skills(deal_id);
