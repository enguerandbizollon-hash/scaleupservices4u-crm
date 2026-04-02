-- V33 : Ajout next_action_date sur deals (relances dans l'agenda)

ALTER TABLE deals ADD COLUMN IF NOT EXISTS next_action_date DATE;
CREATE INDEX IF NOT EXISTS idx_deals_next_action_date ON deals(next_action_date);
