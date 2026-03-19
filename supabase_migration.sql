-- Nouvelles colonnes pour organizations
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS investment_ticket TEXT,
  ADD COLUMN IF NOT EXISTS investment_stage TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Mettre à jour base_status pour les nouveaux statuts organisations
-- (les anciens statuts restent valides, on ajoute les valeurs métier)
-- Note: statuts visuels gérés côté front, pas d'enum à changer
