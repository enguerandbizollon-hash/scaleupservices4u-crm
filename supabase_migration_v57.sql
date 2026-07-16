-- V57 : Ingestion Gmail automatique (M-Gmail)
--
-- Installe les tables et colonnes nécessaires pour que le CRM ingère
-- automatiquement les mails entrants et sortants depuis Gmail, classe
-- chaque message vers un dossier ou un contact (Claude tool_use), et
-- crée une row dans `actions` (type = email) en cascade.
--
-- Tables nouvelles :
--
--   1. gmail_sync_state : état de la synchronisation par utilisateur.
--      Une ligne unique par user_id avec last_synced_at + last_history_id
--      pour la prochaine ingestion incrémentale.
--
--   2. gmail_processed_messages : dedup. Une ligne par (user_id,
--      gmail_message_id) avec lien vers l'action créée. Garantit qu'un
--      cron répété ne crée jamais 2x la même action.
--
-- Colonnes ajoutées sur `actions` :
--   - needs_review (bool)            : action en attente de tri manuel
--   - review_reason (text)           : raison du tri (no_contact_match,
--                                     low_confidence, ambiguous_deal)
--   - classification_source (text)   : 'subject_id' | 'ai' | 'manual'
--   - classification_confidence (num): 0-100 pour les classifications IA
--
-- Aucun impact sur les modules livrés. Toutes les colonnes ont une
-- valeur par défaut compatible avec les rows existantes.
--
-- Non-régression : tables nouvelles + colonnes nullable/avec défaut.
-- RLS appliquée (pattern auth.uid() = user_id).

BEGIN;

-- =========================================================================
-- 1. TABLE : gmail_sync_state
-- =========================================================================

CREATE TABLE IF NOT EXISTS gmail_sync_state (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Curseur d'ingestion incrémentale (Gmail History API)
  last_history_id      TEXT,
  last_synced_at       TIMESTAMPTZ,

  -- Dernier passage
  last_run_status      TEXT,
  last_run_error       TEXT,
  last_run_fetched     INTEGER DEFAULT 0,
  last_run_created     INTEGER DEFAULT 0,
  last_run_review      INTEGER DEFAULT 0,

  -- Configuration utilisateur
  is_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  ignore_domains       TEXT[] DEFAULT '{}',
  ignore_from_emails   TEXT[] DEFAULT '{}',

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gmail_sync_state DROP CONSTRAINT IF EXISTS gss_run_status_check;
ALTER TABLE gmail_sync_state ADD CONSTRAINT gss_run_status_check
  CHECK (last_run_status IS NULL OR last_run_status IN ('success','partial','failure'));

CREATE OR REPLACE FUNCTION trg_gss_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gss_set_updated_at ON gmail_sync_state;
CREATE TRIGGER gss_set_updated_at
  BEFORE UPDATE ON gmail_sync_state
  FOR EACH ROW EXECUTE FUNCTION trg_gss_set_updated_at();

ALTER TABLE gmail_sync_state ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own gmail_sync_state"
    ON gmail_sync_state
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================================
-- 2. TABLE : gmail_processed_messages
-- =========================================================================

CREATE TABLE IF NOT EXISTS gmail_processed_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_message_id    TEXT NOT NULL,
  gmail_thread_id     TEXT,
  internal_date       TIMESTAMPTZ,
  direction           TEXT NOT NULL,
  action_id           UUID REFERENCES actions(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'processed',
  ignore_reason       TEXT,
  processed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gmail_processed_messages
  DROP CONSTRAINT IF EXISTS gpm_unique_msg;
ALTER TABLE gmail_processed_messages
  ADD CONSTRAINT gpm_unique_msg UNIQUE (user_id, gmail_message_id);

ALTER TABLE gmail_processed_messages DROP CONSTRAINT IF EXISTS gpm_direction_check;
ALTER TABLE gmail_processed_messages ADD CONSTRAINT gpm_direction_check
  CHECK (direction IN ('inbound','outbound'));

ALTER TABLE gmail_processed_messages DROP CONSTRAINT IF EXISTS gpm_status_check;
ALTER TABLE gmail_processed_messages ADD CONSTRAINT gpm_status_check
  CHECK (status IN ('processed','ignored','failed'));

CREATE INDEX IF NOT EXISTS idx_gpm_user_thread
  ON gmail_processed_messages(user_id, gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_gpm_user_processed
  ON gmail_processed_messages(user_id, processed_at DESC);

ALTER TABLE gmail_processed_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own gmail_processed_messages"
    ON gmail_processed_messages
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================================
-- 3. EXTENSION : colonnes sur `actions` pour la boîte de tri
-- =========================================================================

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS review_reason TEXT;
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS classification_source TEXT;
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC;
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS email_body_preview TEXT;

ALTER TABLE actions DROP CONSTRAINT IF EXISTS actions_classification_source_check;
ALTER TABLE actions ADD CONSTRAINT actions_classification_source_check
  CHECK (classification_source IS NULL
         OR classification_source IN ('subject_id','ai','manual','none'));

ALTER TABLE actions DROP CONSTRAINT IF EXISTS actions_review_reason_check;
ALTER TABLE actions ADD CONSTRAINT actions_review_reason_check
  CHECK (review_reason IS NULL
         OR review_reason IN ('no_contact_match','low_confidence','ambiguous_deal','no_deal_match'));

CREATE INDEX IF NOT EXISTS idx_actions_needs_review
  ON actions(user_id, needs_review)
  WHERE needs_review = TRUE;

COMMIT;

-- =========================================================================
-- Registre (garde-fou build)
-- =========================================================================

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v57') ON CONFLICT (version) DO NOTHING;

-- =========================================================================
-- Vérifications :
--
-- Tables créées :
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public'
--    AND table_name IN ('gmail_sync_state','gmail_processed_messages');
--
-- Colonnes actions ajoutées :
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'actions'
--    AND column_name IN ('needs_review','review_reason','classification_source',
--                        'classification_confidence','email_body_preview');
--
-- RLS activées :
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE tablename IN ('gmail_sync_state','gmail_processed_messages');
