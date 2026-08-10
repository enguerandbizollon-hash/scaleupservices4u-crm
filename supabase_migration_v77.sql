-- Migration v77 : attribution durable des resultats de chasse.
--
-- univers_entreprises.source_profile_id est un DERNIER ECRIVAIN : chaque
-- re-ingestion (autre chasse, veille hebdo) l'ecrase, et les resultats d'une
-- chasse s'evaporent de l'onglet Cibles du mandat et du filtre ?chasse= de
-- Prospection. Cette table N-N memorise TOUTES les chasses qui ont vu une
-- fiche : une cible reste attribuee a sa chasse tant que la chasse existe.
--
-- ON DELETE CASCADE côte profil : supprimer une chasse retire ses
-- attributions (coherent avec l'UI : une chasse supprimee n'a plus de
-- fiches). RLS identique a univers_entreprises (acces authenticated,
-- outil mono-utilisateur, hors listes CRM).
--
-- Idempotente. A appliquer dans Supabase SQL Editor AVANT tout push.

BEGIN;

CREATE TABLE IF NOT EXISTS univers_chasse_hits (
  siren TEXT NOT NULL REFERENCES univers_entreprises(siren) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES screening_profiles(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (siren, profile_id)
);

COMMENT ON TABLE univers_chasse_hits IS
  'Quelles chasses (screening_profiles) ont vu quelle fiche univers. Attribution durable : source_profile_id (dernier ecrivain) reste en legacy, les lectures par chasse (onglet Cibles du mandat, filtre ?chasse= de Prospection) passent par ici.';

CREATE INDEX IF NOT EXISTS idx_uch_profile ON univers_chasse_hits(profile_id);

ALTER TABLE univers_chasse_hits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access chasse hits" ON univers_chasse_hits;
CREATE POLICY "Authenticated full access chasse hits" ON univers_chasse_hits
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Backfill : l'attribution actuelle (dernier ecrivain) amorce la table.
INSERT INTO univers_chasse_hits (siren, profile_id, first_seen_at, last_seen_at)
SELECT ue.siren, ue.source_profile_id, ue.first_seen_at, ue.last_seen_at
FROM univers_entreprises ue
WHERE ue.source_profile_id IS NOT NULL
ON CONFLICT (siren, profile_id) DO NOTHING;

COMMIT;

INSERT INTO _crm_migrations_applied (version) VALUES ('v77') ON CONFLICT (version) DO NOTHING;
