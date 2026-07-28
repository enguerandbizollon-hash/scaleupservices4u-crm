-- V65 : fusion mandats → dossiers, volet base (phase 1, temps 5)
--
-- Contexte : l'entité mandat fait doublon avec le dossier (friction UX
-- documentée) : un dossier M&A actif a toujours un mandat, et toute
-- l'économie du mandat (honoraires, jalons) se pilote depuis le dossier.
-- Le dossier absorbe donc les champs économiques du mandat ; l'entité
-- mandat disparaît du produit (le code cesse de la référencer au temps 5,
-- la table sera DROPée dans une migration dédiée ultérieure — règle
-- "code d'abord, colonnes ensuite", sinistre v47 documenté).
--
-- Ce que fait cette migration (additive, AUCUN DROP de table/colonne) :
--   1. 6 colonnes honoraires sur deals (les dates et gcal_closing_event_id
--      existent déjà côté deals : seuls les champs économiques manquent).
--   2. fee_milestones : mandate_id devient nullable (le deal devient la clé
--      de rattachement), FK deal_id passe de SET NULL à CASCADE (un jalon
--      sans dossier n'a plus de sens). NOT NULL sur deal_id viendra avec la
--      migration de DROP, une fois le code entièrement migré.
--   3. Recalcul de deals.confirmed_fee_amount par trigger en RECALCUL COMPLET
--      (SUM des jalons paid) sur INSERT/UPDATE/DELETE. Remplace le trigger
--      incrémental v24 qui ne décrémentait jamais (paid → pending ou
--      suppression laissait un montant fantôme) et doublonnait avec un
--      recalcul applicatif dans actions/fees.ts. Source de vérité unique.
--   4. organizations.is_client recâblé sur deals : "cliente dès qu'elle a un
--      dossier non archivé" (remplace la règle v54 "mandat non draft" —
--      sans quoi le flag se figerait à la disparition des mandats).
--   5. Backfills idempotents mandat → deal. Théoriques : base purgée le
--      2026-07-17, 0 mandat / 0 deal. Écrits par principe (autre env, rejeu).

BEGIN;

-- ── 1. Colonnes honoraires sur deals ────────────────────────────────────────

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS estimated_fee_amount NUMERIC;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS confirmed_fee_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS retainer_monthly NUMERIC;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS success_fee_percent NUMERIC;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS success_fee_base TEXT;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS operation_amount NUMERIC;

COMMENT ON COLUMN deals.estimated_fee_amount IS
  'Honoraires totaux estimés du dossier (saisie manuelle, complète le calcul).';
COMMENT ON COLUMN deals.confirmed_fee_amount IS
  'Somme des jalons payés. Maintenu par trigger (tr_fee_milestones_recompute_deal_fee), ne jamais écrire à la main.';
COMMENT ON COLUMN deals.retainer_monthly IS
  'Retainer mensuel négocié, informatif (les encaissements passent par les jalons).';
COMMENT ON COLUMN deals.success_fee_percent IS
  'Success fee en % (ex. 3 pour 3%). Consommé par lib/crm/fee-calculator.ts.';
COMMENT ON COLUMN deals.success_fee_base IS
  'Base de calcul choisie explicitement (closed_amount|asking_price_mid|target_ev_mid|acquisition_budget_mid|target_amount). NULL = résolution automatique par deal_type. Honorée par fee-calculator depuis v65.';
COMMENT ON COLUMN deals.operation_amount IS
  'Montant d''opération saisi à la main — override prioritaire sur toute base dérivée du dossier.';

-- ── 2. fee_milestones : le dossier devient la clé de rattachement ───────────

ALTER TABLE fee_milestones
  ALTER COLUMN mandate_id DROP NOT NULL;

ALTER TABLE fee_milestones
  DROP CONSTRAINT IF EXISTS fee_milestones_deal_id_fkey;
ALTER TABLE fee_milestones
  ADD CONSTRAINT fee_milestones_deal_id_fkey
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_fee_milestones_deal ON fee_milestones(deal_id);

-- ── 3. Backfills mandat → deal (idempotents, no-op sur base purgée) ─────────

-- 3a. Rattacher les jalons orphelins de deal via leur mandat.
--     Déterministe si un mandat porte plusieurs deals : le plus ancien.
UPDATE fee_milestones fm
SET deal_id = d.id
FROM (
  SELECT DISTINCT ON (mandate_id) mandate_id, id
  FROM deals
  WHERE mandate_id IS NOT NULL
  ORDER BY mandate_id, created_at ASC
) d
WHERE fm.deal_id IS NULL
  AND fm.mandate_id = d.mandate_id;

-- 3b. Rapatrier l'économie du mandat sur son deal (ne remplit que les vides).
UPDATE deals d
SET estimated_fee_amount  = COALESCE(d.estimated_fee_amount,  m.estimated_fee_amount),
    retainer_monthly      = COALESCE(d.retainer_monthly,      m.retainer_monthly),
    success_fee_percent   = COALESCE(d.success_fee_percent,   m.success_fee_percent),
    success_fee_base      = COALESCE(d.success_fee_base,      m.success_fee_base),
    operation_amount      = COALESCE(d.operation_amount,      m.operation_amount),
    gcal_closing_event_id = COALESCE(d.gcal_closing_event_id, m.gcal_closing_event_id),
    target_date           = COALESCE(d.target_date,           m.target_close_date),
    close_date            = COALESCE(d.close_date,            m.end_date)
FROM mandates m
WHERE d.mandate_id = m.id;

-- ── 4. Recalcul confirmed_fee_amount : trigger unique, recalcul complet ─────

DROP TRIGGER IF EXISTS tr_update_mandate_fee_on_payment ON fee_milestones;
DROP FUNCTION IF EXISTS update_mandate_confirmed_fee();

CREATE OR REPLACE FUNCTION recompute_deal_confirmed_fee(p_deal_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_deal_id IS NULL THEN RETURN; END IF;
  UPDATE deals
  SET confirmed_fee_amount = COALESCE((
        SELECT SUM(fm.amount) FROM fee_milestones fm
        WHERE fm.deal_id = p_deal_id AND fm.status = 'paid'
      ), 0),
      updated_at = NOW()
  WHERE id = p_deal_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_fee_milestones_recompute_deal_fee()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_deal_confirmed_fee(OLD.deal_id);
  ELSE
    PERFORM recompute_deal_confirmed_fee(NEW.deal_id);
    -- Jalon déplacé d'un dossier à un autre : recalculer aussi l'ancien.
    IF TG_OP = 'UPDATE' AND OLD.deal_id IS DISTINCT FROM NEW.deal_id THEN
      PERFORM recompute_deal_confirmed_fee(OLD.deal_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_fee_milestones_recompute_deal_fee ON fee_milestones;
CREATE TRIGGER tr_fee_milestones_recompute_deal_fee
AFTER INSERT OR UPDATE OR DELETE ON fee_milestones
FOR EACH ROW
EXECUTE FUNCTION trg_fee_milestones_recompute_deal_fee();

-- Remise à niveau de l'existant (no-op sur base purgée).
UPDATE deals d
SET confirmed_fee_amount = COALESCE((
  SELECT SUM(fm.amount) FROM fee_milestones fm
  WHERE fm.deal_id = d.id AND fm.status = 'paid'
), 0);

-- ── 5. is_client dérivé de deals (remplace le dérivé de mandates, v54) ──────

DROP TRIGGER IF EXISTS mandates_update_org_is_client ON mandates;
DROP FUNCTION IF EXISTS trg_mandates_update_org_is_client();
DROP FUNCTION IF EXISTS recompute_organization_is_client(UUID);

CREATE FUNCTION recompute_organization_is_client(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_org_id IS NULL THEN RETURN; END IF;
  UPDATE organizations o
  SET is_client = EXISTS (
    SELECT 1 FROM deals d
    WHERE d.organization_id = o.id AND d.is_archived = FALSE
  )
  WHERE o.id = p_org_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_deals_update_org_is_client()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_organization_is_client(OLD.organization_id);
  ELSE
    PERFORM recompute_organization_is_client(NEW.organization_id);
    IF TG_OP = 'UPDATE' AND OLD.organization_id IS DISTINCT FROM NEW.organization_id THEN
      PERFORM recompute_organization_is_client(OLD.organization_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deals_update_org_is_client ON deals;
CREATE TRIGGER deals_update_org_is_client
AFTER INSERT OR UPDATE OF organization_id, is_archived OR DELETE ON deals
FOR EACH ROW
EXECUTE FUNCTION trg_deals_update_org_is_client();

-- Backfill global du flag (no-op sur base purgée).
UPDATE organizations o
SET is_client = EXISTS (
  SELECT 1 FROM deals d
  WHERE d.organization_id = o.id AND d.is_archived = FALSE
);

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v65') ON CONFLICT (version) DO NOTHING;

-- ── Vérification post-application ───────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'deals' AND column_name IN
--     ('estimated_fee_amount','confirmed_fee_amount','retainer_monthly',
--      'success_fee_percent','success_fee_base','operation_amount');
-- SELECT is_nullable FROM information_schema.columns
--   WHERE table_name = 'fee_milestones' AND column_name = 'mandate_id';  -- YES
-- SELECT tgname FROM pg_trigger WHERE tgname IN
--   ('tr_fee_milestones_recompute_deal_fee','deals_update_org_is_client');
