-- V39 : Liaison candidate sur actions (recrutement)
-- Permet de rattacher entretien / test technique / appel candidat à
-- une fiche candidat. Sync GCal automatique via le bloc existant
-- dans actions/actions.ts (l'email du candidat est ajouté aux
-- attendees côté Server Action, pas en SQL).

BEGIN;
  ALTER TABLE actions
    ADD COLUMN IF NOT EXISTS candidate_id UUID
      REFERENCES candidates(id) ON DELETE SET NULL;

  CREATE INDEX IF NOT EXISTS idx_actions_candidate
    ON actions(candidate_id);
COMMIT;
