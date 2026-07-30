-- V72 : funnel cédant sur l'univers (pipeline métier du 2026-07-30)
--
-- « Commercialement c'est compliqué d'avoir des mandats, c'est pour ça que
-- le sourcing est très important. » Le cycle réel d'approche d'un cédant :
-- repéré → à contacter → contacté (approche) → échange en cours → mandat
-- (promu), avec deux sorties : écarté (mort) et DORMANT (« pas maintenant,
-- recontactez-moi plus tard ») qui doit se réveiller tout seul.
--
-- La colonne statut (v66) est TEXT sans contrainte : les valeurs 'echange'
-- et 'dormant' n'exigent aucun ALTER. Cette migration ajoute :
--   1. dormant_until : date de réveil d'une fiche dormante. Le cron
--      notifications la surveille : à échéance, notification + retour du
--      statut à 'a_approcher' (la fiche revient dans le triage).
--   2. approche_note : la mémoire commerciale de la fiche (« veut vendre
--      en 2027, rappeler après l'été », « fils repreneur pressenti »...).
--   3. Filet de sécurité : contrainte UNIQUE (organization_id, contact_id)
--      sur organization_contacts. linkContactToOrganisation fait déjà un
--      upsert onConflict dessus mais AUCUNE migration trackée ne la crée
--      (héritage pré-v23) : sur une base fraîche, l'upsert échouerait.

BEGIN;

ALTER TABLE univers_entreprises
  ADD COLUMN IF NOT EXISTS dormant_until DATE,
  ADD COLUMN IF NOT EXISTS approche_note TEXT;

COMMENT ON COLUMN univers_entreprises.statut IS
  'nouveau | a_approcher | approche | echange | dormant | ecarte | promu (v72 : echange = discussion en cours, dormant = à recontacter à dormant_until)';
COMMENT ON COLUMN univers_entreprises.dormant_until IS
  'Date de réveil d''une fiche dormante : le cron notifications notifie et repasse la fiche en a_approcher à échéance.';
COMMENT ON COLUMN univers_entreprises.approche_note IS
  'Mémoire commerciale de l''approche (contexte du refus, échéance évoquée, personnes citées).';

-- Réveil : le cron scanne les dormantes échues.
CREATE INDEX IF NOT EXISTS idx_univers_dormant_until
  ON univers_entreprises(dormant_until) WHERE statut = 'dormant';

-- Filet : l'unicité du lien contact-organisation que le code suppose déjà.
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_contacts_org_contact
  ON organization_contacts(organization_id, contact_id);

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v72') ON CONFLICT (version) DO NOTHING;

-- ── Vérification post-application ───────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'univers_entreprises' AND column_name IN ('dormant_until','approche_note');
-- SELECT indexname FROM pg_indexes WHERE tablename = 'organization_contacts';
