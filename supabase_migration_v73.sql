-- Migration v73 : funnel acquéreur (plan R1 lot 2, conception 2026-08-01)
-- Les 5 statuts de deal_target_suggestions restent l'axe DÉCISION
-- (suggested/approved/rejected/deferred/contacted) ; la PROGRESSION
-- d'approche vit dans des colonnes datées, l'historique dans une table
-- d'événements append-only. « contacted » cesse d'être terminal : c'est
-- le début du funnel (l'approche est partie).
-- Idempotente. À appliquer dans Supabase SQL Editor AVANT tout push.

BEGIN;

-- ── 1. Colonnes funnel sur deal_target_suggestions ──────────────────────
ALTER TABLE deal_target_suggestions
  ADD COLUMN IF NOT EXISTS teaser_sent_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nda_signed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS im_sent_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offer_received_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_outreach_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_followup_at   DATE,
  ADD COLUMN IF NOT EXISTS gmail_thread_id    TEXT,
  ADD COLUMN IF NOT EXISTS gmail_draft_id     TEXT,
  ADD COLUMN IF NOT EXISTS outreach_brief_json JSONB,
  ADD COLUMN IF NOT EXISTS intent_score       NUMERIC,
  ADD COLUMN IF NOT EXISTS intent_breakdown   JSONB,
  ADD COLUMN IF NOT EXISTS intent_computed_at TIMESTAMPTZ;

COMMENT ON COLUMN deal_target_suggestions.next_followup_at IS
  'Prochaine relance proposée (règles lib/crm/funnel.ts, éditable, NULL = pas de relance). Lu par le Job 5 du cron notifications.';
COMMENT ON COLUMN deal_target_suggestions.outreach_brief_json IS
  'Brief structuré {email_subject, email_body, linkedin_message, reasoning, generated_at}. outreach_brief (TEXT) reste l''affichage copier-coller.';

CREATE INDEX IF NOT EXISTS idx_dts_next_followup
  ON deal_target_suggestions(next_followup_at)
  WHERE next_followup_at IS NOT NULL;

-- ── 2. « contacted » n'est plus terminal ────────────────────────────────
-- L'ancien index unique (deal_id, organization_id) WHERE status NOT IN
-- ('rejected','contacted') permettait des doublons dès qu'une approche
-- passait « contacted ». Dédup préalable (DB de test : on garde la ligne
-- la plus récente par couple, hors rejected), puis index resserré.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY deal_id, organization_id
                            ORDER BY created_at DESC) AS rn
  FROM deal_target_suggestions
  WHERE status <> 'rejected'
)
DELETE FROM deal_target_suggestions
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

DROP INDEX IF EXISTS dts_unique_active;
CREATE UNIQUE INDEX IF NOT EXISTS dts_unique_active
  ON deal_target_suggestions(deal_id, organization_id)
  WHERE status <> 'rejected';

-- ── 3. Source « matching » autorisée ────────────────────────────────────
-- ensureAcquirerSuggestion (onglet Acquéreurs) retrouve sa provenance
-- honnête (hotfix R0 : la valeur violait le CHECK et cassait les boutons).
ALTER TABLE deal_target_suggestions DROP CONSTRAINT IF EXISTS dts_source_check;
ALTER TABLE deal_target_suggestions ADD CONSTRAINT dts_source_check
  CHECK (source_connector IN ('apollo','harmonic','vibe','pappers','insee','manual','ai','portal','matching'));

-- ── 4. Journal d'événements append-only ─────────────────────────────────
-- reviewed_* est écrasé à chaque transition : cette table est le seul
-- historique durable du funnel. Écrite par les Server Actions, jamais
-- mise à jour ni supprimée.
CREATE TABLE IF NOT EXISTS deal_suggestion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_id UUID NOT NULL REFERENCES deal_target_suggestions(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dse_type_check CHECK (event_type IN (
    'status_change','teaser_sent','nda_signed','im_sent','offer_received',
    'followup_planned','followup_done','draft_created','note'
  ))
);

CREATE INDEX IF NOT EXISTS idx_dse_suggestion ON deal_suggestion_events(suggestion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dse_deal ON deal_suggestion_events(deal_id, created_at DESC);

ALTER TABLE deal_suggestion_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own deal_suggestion_events" ON deal_suggestion_events
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;

INSERT INTO _crm_migrations_applied (version) VALUES ('v73') ON CONFLICT (version) DO NOTHING;
