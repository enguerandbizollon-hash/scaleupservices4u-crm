-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION V16 — Alignement deal_status sur les specs CLAUDE.md
-- Anciens : active | inactive | closed
-- Nouveaux : open | paused | won | lost
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. SUPPRESSION DE LA CONTRAINTE CHECK EXISTANTE ─────────────────
ALTER TABLE deals DROP CONSTRAINT IF EXISTS chk_deal_status;

-- ── 2. RENOMMAGE DES VALEURS EN BASE ────────────────────────────────
UPDATE deals SET deal_status = 'open'   WHERE deal_status = 'active';
UPDATE deals SET deal_status = 'paused' WHERE deal_status = 'inactive';
UPDATE deals SET deal_status = 'lost'   WHERE deal_status = 'closed';
-- 'won' est un nouveau statut — aucune donnée existante à migrer

-- ── 3. RECRÉATION DE LA CONTRAINTE AVEC LES NOUVELLES VALEURS ───────
ALTER TABLE deals ADD CONSTRAINT chk_deal_status
  CHECK (deal_status IN ('open', 'paused', 'won', 'lost'));

-- ── 2. MISE À JOUR DU TRIGGER set_deal_lost_at ──────────────────────
-- Le trigger écoutait 'closed' → il doit maintenant écouter 'lost'
CREATE OR REPLACE FUNCTION set_deal_lost_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deal_status = 'lost' AND (OLD.deal_status IS NULL OR OLD.deal_status != 'lost') THEN
    NEW.lost_at := now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_deal_lost_at ON deals;
CREATE TRIGGER trg_deal_lost_at
  BEFORE UPDATE OF deal_status ON deals
  FOR EACH ROW EXECUTE FUNCTION set_deal_lost_at();

-- ── 3. VÉRIFICATION ─────────────────────────────────────────────────
-- Après exécution, aucune ligne ne doit rester avec les anciennes valeurs :
-- SELECT deal_status, count(*) FROM deals GROUP BY deal_status;
-- Résultat attendu : uniquement open | paused | won | lost
