-- V41 : Table notifications (rappels automatiques + brique transversale)
--
-- Objectif :
--   1. Consommer enfin actions.reminder_days (présent en base depuis v35,
--      jamais déclenché) via un cron horaire Vercel.
--   2. Fournir une brique générique réutilisable pour les futures alertes
--      RGPD (rgpd_expiry_date), fees en retard (fee_milestones.due_date),
--      et toute autre échéance.
--
-- Non inclus dans cette migration :
--   - Route /api/cron/notifications (code TS dans le lot suivant)
--   - UI cloche + panneau (code TS dans le lot suivant)
--   - Envoi email (lot ultérieur, provider non choisi)

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE : notifications
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Classification
  kind          TEXT NOT NULL,             -- action_reminder | rgpd_expiry | fee_overdue | ...
  title         TEXT NOT NULL,
  body          TEXT,

  -- Cible cliquable (fiche dossier, candidat, etc.)
  link_url      TEXT,

  -- Source originelle (pour idempotence + suppression en cascade logique)
  source_type   TEXT,                       -- action | fee_milestone | candidate | contact
  source_id     UUID,

  -- Date métier pour laquelle la notif est émise (jour précis)
  trigger_date  DATE NOT NULL,

  -- État de lecture
  read_at       TIMESTAMPTZ,

  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotence du cron : une seule notif par (user, kind, source, date).
-- Le cron peut tourner 24 fois par jour sans créer de doublons.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedupe
  ON notifications (user_id, kind, source_type, source_id, trigger_date);

-- Index de lecture côté UI (badge unread, tri récent)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own notifications" ON notifications
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- Enregistrement registre (obligatoire depuis v40)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v41') ON CONFLICT (version) DO NOTHING;

-- Vérification :
-- SELECT COUNT(*) FROM notifications;
-- SELECT * FROM _crm_migrations_applied ORDER BY version;
