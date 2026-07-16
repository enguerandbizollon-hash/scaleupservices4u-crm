-- V59 : EBITDA normatif — retraitements pour valorisation M&A
--
-- L'EBITDA reporté (calculé depuis le P&L) ne reflète pas toujours la
-- capacité bénéficiaire récurrente d'une entreprise. En M&A, on retraite
-- l'EBITDA pour neutraliser :
--   - la sur-rémunération du dirigeant (ou sa sous-rémunération inverse)
--   - les charges exceptionnelles non récurrentes (litiges, restructuration)
--   - le loyer marché si la société occupe un bien dont elle est propriétaire
--     (ou inversement, si elle paye un loyer hors marché à un actionnaire)
--   - les frais ponctuels (audit M&A, conseil, intégration)
--   - tout autre ajustement libre justifié
--
-- EBITDA normatif = EBITDA reporté + Σ retraitements
--
-- Stocké sur financial_data, par exercice, en devise native.
-- Les valeurs sont des ajouts (signe positif augmente l'EBITDA normatif,
-- signe négatif le réduit — pour produits exceptionnels par exemple).
-- Calcul de l'EBITDA normatif fait côté code (computeFinancials), pas en base.
--
-- Idempotente. Pas d'impact sur les modules livrés (colonnes nullable).

BEGIN;

ALTER TABLE financial_data
  ADD COLUMN IF NOT EXISTS addback_owner_compensation NUMERIC;
ALTER TABLE financial_data
  ADD COLUMN IF NOT EXISTS addback_exceptional_charges NUMERIC;
ALTER TABLE financial_data
  ADD COLUMN IF NOT EXISTS addback_property_rent NUMERIC;
ALTER TABLE financial_data
  ADD COLUMN IF NOT EXISTS addback_one_off_fees NUMERIC;
ALTER TABLE financial_data
  ADD COLUMN IF NOT EXISTS addback_other NUMERIC;
ALTER TABLE financial_data
  ADD COLUMN IF NOT EXISTS addback_notes TEXT;

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v59') ON CONFLICT (version) DO NOTHING;

-- Vérification :
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'financial_data'
--    AND column_name LIKE 'addback_%';
