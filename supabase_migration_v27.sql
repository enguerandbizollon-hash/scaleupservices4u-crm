-- V27 : Ajout operation_amount sur mandates
-- Montant de l'opération sous-jacente (EV M&A, montant levée, salaire annuel, budget...)
-- Distinct de estimated_fee_amount (honoraires cabinet)

ALTER TABLE mandates
  ADD COLUMN IF NOT EXISTS operation_amount numeric;

COMMENT ON COLUMN mandates.operation_amount IS
  'Montant de l''opération sous-jacente : EV deal M&A, montant levée Fundraising, salaire annuel Recrutement, budget CFO Advisory. Base de calcul du success fee.';

-- Ticket investisseur sur les jalons de facturation
-- Permet de calculer le success fee sur la tranche d'investissement concernée
ALTER TABLE fee_milestones
  ADD COLUMN IF NOT EXISTS ticket_amount numeric;

COMMENT ON COLUMN fee_milestones.ticket_amount IS
  'Montant de la tranche d''investissement (ticket) sur laquelle le success fee est calculé. Utilisé principalement en Fundraising : amount = ticket_amount × success_fee_percent / 100.';
