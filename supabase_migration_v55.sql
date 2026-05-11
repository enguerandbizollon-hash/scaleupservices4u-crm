-- V55 : Stades de dossier par metier (deal_stage adaptatif)
--
-- Contexte : jusqu'a V54, deals.deal_stage stocke une liste unique de 10
-- valeurs transversales (kickoff, preparation, outreach, management_meetings,
-- dd, negotiation, closing, post_closing, ongoing_support, search), peu
-- importe le type du dossier. Consequence : un dossier RH pouvait passer en
-- "Due Diligence" et un dossier CFO en "Outreach", ce qui n'a aucun sens.
--
-- Cette migration remappe les valeurs existantes vers des stades propres a
-- chaque deal_type (fundraising / ma_sell / ma_buy / recruitment /
-- cfo_advisor). La source de verite applicative est DEAL_STAGES_BY_TYPE dans
-- lib/crm/matching-maps.ts (V55b cote code).
--
-- Aucune contrainte CHECK n'est ajoutee sur deal_stage : la validation se
-- fait cote Server Action (updateDealStageAction) via isValidStage(type,
-- stage). La colonne reste TEXT nullable pour rester souple si le metier
-- etend les stades.
--
-- Sequences cibles par metier :
--
--   fundraising : kickoff -> preparation -> outreach -> meetings ->
--                 term_sheets -> closing -> post_closing
--
--   ma_sell     : kickoff -> preparation -> outreach -> meetings ->
--                 loi -> dd -> spa -> closing -> post_closing
--
--   ma_buy      : kickoff -> criteria -> sourcing -> outreach ->
--                 loi -> dd -> spa -> closing
--
--   recruitment : kickoff -> sourcing -> pre_qualification -> interviews ->
--                 offer -> placement -> probation
--
--   cfo_advisor : kickoff -> onboarding -> delivery -> support

BEGIN;

-- =========================================================================
-- Mapping automatique des stades existants vers les nouveaux stades par
-- deal_type. Idempotent : si un stade est deja dans le nouveau vocabulaire
-- (ex. "meetings", "loi", "sourcing"...), le CASE le laisse tel quel via
-- le fallthrough final.
-- =========================================================================

UPDATE deals SET deal_stage = CASE deal_type

  WHEN 'fundraising' THEN CASE deal_stage
    WHEN 'management_meetings' THEN 'meetings'
    WHEN 'negotiation'         THEN 'term_sheets'
    WHEN 'dd'                  THEN 'meetings'
    WHEN 'ongoing_support'     THEN 'post_closing'
    WHEN 'search'              THEN 'kickoff'
    ELSE deal_stage
  END

  WHEN 'ma_sell' THEN CASE deal_stage
    WHEN 'management_meetings' THEN 'meetings'
    WHEN 'negotiation'         THEN 'spa'
    WHEN 'ongoing_support'     THEN 'post_closing'
    WHEN 'search'              THEN 'preparation'
    ELSE deal_stage
  END

  WHEN 'ma_buy' THEN CASE deal_stage
    WHEN 'preparation'         THEN 'criteria'
    WHEN 'management_meetings' THEN 'outreach'
    WHEN 'negotiation'         THEN 'spa'
    WHEN 'post_closing'        THEN 'closing'
    WHEN 'ongoing_support'     THEN 'closing'
    WHEN 'search'              THEN 'sourcing'
    ELSE deal_stage
  END

  WHEN 'recruitment' THEN CASE deal_stage
    WHEN 'preparation'         THEN 'sourcing'
    WHEN 'outreach'            THEN 'sourcing'
    WHEN 'management_meetings' THEN 'interviews'
    WHEN 'dd'                  THEN 'pre_qualification'
    WHEN 'negotiation'         THEN 'offer'
    WHEN 'closing'             THEN 'placement'
    WHEN 'post_closing'        THEN 'probation'
    WHEN 'ongoing_support'     THEN 'probation'
    WHEN 'search'              THEN 'sourcing'
    ELSE deal_stage
  END

  WHEN 'cfo_advisor' THEN CASE deal_stage
    WHEN 'preparation'         THEN 'onboarding'
    WHEN 'outreach'            THEN 'onboarding'
    WHEN 'management_meetings' THEN 'delivery'
    WHEN 'dd'                  THEN 'delivery'
    WHEN 'negotiation'         THEN 'delivery'
    WHEN 'closing'             THEN 'delivery'
    WHEN 'post_closing'        THEN 'support'
    WHEN 'ongoing_support'     THEN 'support'
    WHEN 'search'              THEN 'kickoff'
    ELSE deal_stage
  END

  ELSE deal_stage
END;

-- =========================================================================
-- Index (garantie, peut deja exister)
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_deals_deal_stage ON deals(deal_stage);
CREATE INDEX IF NOT EXISTS idx_deals_deal_type_stage ON deals(deal_type, deal_stage);

COMMIT;

-- =========================================================================
-- Registre (garde-fou build)
-- =========================================================================

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v55') ON CONFLICT (version) DO NOTHING;

-- =========================================================================
-- Verifications apres execution :
--
-- Distribution des stades par type (aucun stade legacy ne doit subsister) :
-- SELECT deal_type, deal_stage, COUNT(*) AS n
--   FROM deals
--  GROUP BY deal_type, deal_stage
--  ORDER BY deal_type, deal_stage;
--
-- Detection d'eventuels stades orphelins (valeurs inattendues) :
-- SELECT DISTINCT deal_type, deal_stage
--   FROM deals
--  WHERE deal_stage NOT IN (
--    'kickoff','preparation','outreach','meetings','term_sheets',
--    'closing','post_closing',
--    'loi','dd','spa',
--    'criteria','sourcing','pre_qualification','interviews','offer',
--    'placement','probation',
--    'onboarding','delivery','support'
--  );
