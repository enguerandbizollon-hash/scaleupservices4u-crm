-- V38 : Champs destinataires email sur actions
-- Permet de tracer les destinataires (to/cc) et l'expéditeur (from)
-- pour les actions de type "email".

BEGIN;
  ALTER TABLE actions
    ADD COLUMN IF NOT EXISTS email_to   TEXT[],
    ADD COLUMN IF NOT EXISTS email_cc   TEXT[],
    ADD COLUMN IF NOT EXISTS email_from TEXT;
COMMIT;
