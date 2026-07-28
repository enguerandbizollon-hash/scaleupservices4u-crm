-- V66 : univers marché + signaux (phase 2, temps 1 — la machine à mandats)
--
-- Trois tables nouvelles, rien n'est modifié sur l'existant :
--
--   1. signaux : le flux de veille quotidien, pivot SIREN. Alimenté par le
--      cron BODACC (ventes/cessions, procédures collectives, radiations en
--      entier ; dépôts de comptes croisés avec les SIREN connus seulement).
--      UNIQUE (source, external_id) = ingestion idempotente, le rejeu d'une
--      journée ne crée jamais de doublon.
--   2. screening_profiles : les chasses d'Enguérand. Filtres composables en
--      JSONB (NAF, CA, âge dirigeant, géo...), rejouables, avec veille
--      périodique optionnelle par profil.
--   3. univers_entreprises : la veille qualifiée (10-50k fiches max, décision
--      validée), PK = siren (dédup naturelle). Hors des listes CRM ;
--      promotion explicite vers organizations quand une cible devient réelle.
--
-- RLS (outil interne mono-utilisateur, jamais commercialisé — décision plan) :
--   - signaux : lecture + update (marquer lu, lier une org) pour tout
--     utilisateur authentifié ; INSERT/DELETE réservés au service role (cron).
--   - univers_entreprises : tout pour l'authentifié (statuts, promotion
--     gérés depuis l'UI) ; l'ingestion passe par les server actions.
--   - screening_profiles : RLS user classique (auth.uid() = user_id).
--
-- Purge : fonction purge_signaux_non_rattaches() (12 mois, signaux sans
-- organisation liée), appelée par le cron d'ingestion. Pas de pg_cron.

BEGIN;

-- ── 1. screening_profiles (défini d'abord : univers y fait référence) ───────

CREATE TABLE IF NOT EXISTS screening_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_total_results INTEGER,
  watch_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  watch_frequency TEXT NOT NULL DEFAULT 'weekly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE screening_profiles IS
  'Profils de chasse sauvegardés (screening API Recherche d''Entreprises). filters = {naf[], secteurs[], ca_min, ca_max, resultat_net_min, age_dirigeant_min, age_dirigeant_max, departements[], regions[], effectif_tranches[], categorie, actives_seulement}.';

CREATE INDEX IF NOT EXISTS idx_screening_profiles_user ON screening_profiles(user_id);

ALTER TABLE screening_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own screening profiles" ON screening_profiles;
CREATE POLICY "Users manage own screening profiles" ON screening_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 2. univers_entreprises : la veille qualifiée ────────────────────────────

CREATE TABLE IF NOT EXISTS univers_entreprises (
  siren TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  naf TEXT,
  secteur TEXT,                 -- dérivé via sectorFromNaf() à l'ingestion
  departement TEXT,
  ville TEXT,
  date_creation DATE,
  effectif_code TEXT,           -- code INSEE (ex. 12 = 20-49)
  effectif_label TEXT,
  categorie TEXT,               -- PME | ETI | GE
  finances JSONB NOT NULL DEFAULT '{}'::jsonb,    -- {"2024": {"ca": ..., "resultat_net": ...}}
  dirigeants JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{nom, prenoms, qualite, date_de_naissance}]
  age_dirigeant_principal INTEGER,                -- calculé à l'ingestion (post-filtre qualite)
  cedabilite_score NUMERIC,                       -- posé au T4 (radar)
  cedabilite_raisons TEXT[],
  statut TEXT NOT NULL DEFAULT 'nouveau',         -- nouveau | a_approcher | approche | ecarte | promu
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,  -- si promu
  source_profile_id UUID REFERENCES screening_profiles(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE univers_entreprises IS
  'Univers de veille marché (cible 10-50k fiches). PK = siren. Hors des listes CRM : promotion explicite vers organizations (dédup SIREN v64) quand une cible devient réelle.';

CREATE INDEX IF NOT EXISTS idx_univers_statut ON univers_entreprises(statut);
CREATE INDEX IF NOT EXISTS idx_univers_secteur ON univers_entreprises(secteur);
CREATE INDEX IF NOT EXISTS idx_univers_departement ON univers_entreprises(departement);
CREATE INDEX IF NOT EXISTS idx_univers_score ON univers_entreprises(cedabilite_score DESC NULLS LAST);

ALTER TABLE univers_entreprises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access univers" ON univers_entreprises;
CREATE POLICY "Authenticated full access univers" ON univers_entreprises
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── 3. signaux : le flux de veille, pivot SIREN ─────────────────────────────

CREATE TABLE IF NOT EXISTS signaux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siren TEXT NOT NULL,
  source TEXT NOT NULL,                  -- bodacc | recherche_entreprises | pappers | manual
  signal_type TEXT NOT NULL,             -- vente_cession | procedure_collective | radiation |
                                         -- depot_comptes | entree_screening | changement_dirigeant
  signal_date DATE NOT NULL,             -- date de l'événement (parution, jugement)
  titre TEXT NOT NULL,                   -- résumé humain, affiché tel quel dans le flux
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,  -- brut structuré (jugement, acte, sirens...)
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'info', -- info | opportunite | alerte
  read_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  external_id TEXT NOT NULL,             -- id de l'annonce source
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, external_id)
);

COMMENT ON TABLE signaux IS
  'Flux de veille marché, pivot SIREN. Ingestion idempotente par UNIQUE(source, external_id) : le rejeu d''une journée BODACC ne double jamais.';
COMMENT ON COLUMN signaux.payload IS
  'Brut structuré de la source : {sirens[], jugement{}, acte{}, tribunal, ville, cp, departement, region, commercant...}.';

CREATE INDEX IF NOT EXISTS idx_signaux_siren ON signaux(siren);
CREATE INDEX IF NOT EXISTS idx_signaux_type_date ON signaux(signal_type, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_signaux_unread ON signaux(created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_signaux_org ON signaux(organization_id) WHERE organization_id IS NOT NULL;

ALTER TABLE signaux ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read signaux" ON signaux;
CREATE POLICY "Authenticated read signaux" ON signaux
  FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "Authenticated update signaux" ON signaux;
CREATE POLICY "Authenticated update signaux" ON signaux
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
-- INSERT / DELETE : aucune policy → réservés au service role (cron d'ingestion).

-- ── 4. Purge des signaux non rattachés (12 mois, décision validée) ──────────

CREATE OR REPLACE FUNCTION purge_signaux_non_rattaches()
RETURNS INTEGER AS $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM signaux
  WHERE organization_id IS NULL
    AND created_at < NOW() - INTERVAL '12 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION purge_signaux_non_rattaches() IS
  'Supprime les signaux de plus de 12 mois jamais rattachés à une organisation. Appelée par le cron bodacc-ingest. Retourne le nombre de lignes purgées.';

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v66') ON CONFLICT (version) DO NOTHING;

-- ── Vérification post-application ───────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('signaux','screening_profiles','univers_entreprises');
-- SELECT policyname, tablename FROM pg_policies
--   WHERE tablename IN ('signaux','screening_profiles','univers_entreprises');
-- SELECT proname FROM pg_proc WHERE proname = 'purge_signaux_non_rattaches';
