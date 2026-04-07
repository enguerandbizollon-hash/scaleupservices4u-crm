-- V37 : Champ document_url sur actions
-- Permet d'attacher un lien (Drive, Notion, lien externe) à toute action.

BEGIN;
  ALTER TABLE actions
    ADD COLUMN IF NOT EXISTS document_url TEXT;
COMMIT;
