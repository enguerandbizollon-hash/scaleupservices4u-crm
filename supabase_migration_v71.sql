-- V71 : observabilité des crons (audit 2026-07-30, cran 1)
--
-- « Rien ne tourne en fond » et quand ça tourne, rien ne le prouve.
-- Chaque passage de cron (bodacc-ingest, veille-profils, notifications,
-- gmail-sync) laisse désormais une trace : début, fin, réussite, rapport
-- structuré, erreurs. C'est la matière première des KPI de fiabilité
-- (« la veille a tourné ce matin, 12 entrées, 0 erreur ») et du debug
-- (un cron muet qui échoue en silence devient visible).
--
-- Table SYSTÈME : pas de user_id (les crons tournent en service role,
-- les données ne sont rattachées à aucun utilisateur). Dérogation assumée
-- à la règle « user_id partout » : lecture pour tout utilisateur
-- authentifié, écriture réservée au service role (aucune policy INSERT).

BEGIN;

CREATE TABLE IF NOT EXISTS cron_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job          TEXT NOT NULL,            -- bodacc-ingest | veille-profils | notifications | gmail-sync
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  ok           BOOLEAN,                  -- NULL = en cours (ou mort en route)
  summary      JSONB,                    -- rapport structuré du run (compteurs)
  errors       TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_started
  ON cron_runs (job, started_at DESC);

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

-- Lecture seule pour l'UI (état des automatisations) ; écriture service role.
DO $$ BEGIN
  CREATE POLICY "Authenticated read cron_runs" ON cron_runs
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v71') ON CONFLICT (version) DO NOTHING;

-- ── Vérification post-application ───────────────────────────────────────────
-- SELECT job, started_at, ok FROM cron_runs ORDER BY started_at DESC LIMIT 5;
