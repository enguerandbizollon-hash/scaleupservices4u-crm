-- V58 : Codes dossiers — identifiant court mémorisable par dossier
--
-- Objectif : doter chaque deal d'un code lisible du type
--   MA-S-2026-042, MA-B-2026-008, FR-2026-014, RH-2026-023, CFO-2026-006
-- Cet identifiant remplace l'UUID pour la communication humaine (mails,
-- agenda, documents, échanges client) et sert de clé de rattachement
-- pour l'ingestion Gmail (M-Gmail v57) et la sync GCal.
--
-- Format : [PREFIX]-[YYYY]-[NNN] où NNN est une séquence à 3 chiffres
-- réinitialisée chaque année, isolée par user_id.
--
-- Préfixes (single source of truth, dupliqué côté TS dans
-- lib/crm/deal-codes.ts pour l'affichage uniquement) :
--   ma_sell      → MA-S
--   ma_buy       → MA-B
--   fundraising  → FR
--   cfo_advisor  → CFO
--   recruitment  → RH
--   <autre>      → D
--
-- Génération atomique via trigger BEFORE INSERT + table compteur
-- deal_code_counters. La logique métier reste côté Server Actions,
-- mais l'attribution d'une séquence ne tolère pas la race condition
-- d'un calcul côté app (deux dossiers créés en parallèle pourraient
-- recevoir le même numéro). C'est l'unique exception légitime.
--
-- Idempotente. Backfill inclus pour les deals existants.
-- Aucun impact sur les modules livrés.

BEGIN;

-- =========================================================================
-- 1. COLONNE : deals.code
-- =========================================================================

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS code TEXT;

-- Unicité par utilisateur (un cabinet à 4 users, séries indépendantes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_user_code
  ON deals(user_id, code)
  WHERE code IS NOT NULL;

-- =========================================================================
-- 2. TABLE : deal_code_counters
-- =========================================================================
-- Une ligne par (user_id, prefix, year). next_value pointe sur le prochain
-- numéro à attribuer. L'UPSERT atomique en trigger garantit l'absence de
-- collision.

CREATE TABLE IF NOT EXISTS deal_code_counters (
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prefix      TEXT    NOT NULL,
  year        INTEGER NOT NULL,
  next_value  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, prefix, year)
);

ALTER TABLE deal_code_counters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own deal_code_counters"
    ON deal_code_counters
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================================
-- 3. FONCTION + TRIGGER : génération automatique
-- =========================================================================

CREATE OR REPLACE FUNCTION generate_deal_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_prefix TEXT;
  v_year   INTEGER;
  v_seq    INTEGER;
BEGIN
  -- Si un code est fourni explicitement (import, migration), on respecte.
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;

  v_prefix := CASE NEW.deal_type
    WHEN 'ma_sell'     THEN 'MA-S'
    WHEN 'ma_buy'      THEN 'MA-B'
    WHEN 'fundraising' THEN 'FR'
    WHEN 'cfo_advisor' THEN 'CFO'
    WHEN 'recruitment' THEN 'RH'
    ELSE 'D'
  END;

  v_year := EXTRACT(YEAR FROM COALESCE(NEW.created_at, NOW()))::INTEGER;

  -- UPSERT atomique : insère la ligne à 2 si elle n'existe pas (on consomme
  -- le 1 pour ce trigger), sinon incrémente next_value. On lit la valeur
  -- consommée via RETURNING (next_value - 1).
  INSERT INTO deal_code_counters (user_id, prefix, year, next_value)
    VALUES (NEW.user_id, v_prefix, v_year, 2)
    ON CONFLICT (user_id, prefix, year)
    DO UPDATE SET next_value = deal_code_counters.next_value + 1
    RETURNING next_value - 1 INTO v_seq;

  NEW.code := v_prefix || '-' || v_year::text || '-' || LPAD(v_seq::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_deal_code ON deals;
CREATE TRIGGER set_deal_code
  BEFORE INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION generate_deal_code();

-- =========================================================================
-- 4. BACKFILL : dossiers existants
-- =========================================================================
-- Les codes sont attribués dans l'ordre de création (created_at), par
-- (user_id, prefix, year). Aucune ligne déjà codée n'est modifiée.

DO $$
DECLARE
  d        RECORD;
  v_prefix TEXT;
  v_year   INTEGER;
  v_seq    INTEGER;
BEGIN
  FOR d IN
    SELECT id, user_id, deal_type, created_at
      FROM deals
     WHERE code IS NULL
     ORDER BY user_id, created_at, id
  LOOP
    v_prefix := CASE d.deal_type
      WHEN 'ma_sell'     THEN 'MA-S'
      WHEN 'ma_buy'      THEN 'MA-B'
      WHEN 'fundraising' THEN 'FR'
      WHEN 'cfo_advisor' THEN 'CFO'
      WHEN 'recruitment' THEN 'RH'
      ELSE 'D'
    END;
    v_year := EXTRACT(YEAR FROM COALESCE(d.created_at, NOW()))::INTEGER;

    INSERT INTO deal_code_counters (user_id, prefix, year, next_value)
      VALUES (d.user_id, v_prefix, v_year, 2)
      ON CONFLICT (user_id, prefix, year)
      DO UPDATE SET next_value = deal_code_counters.next_value + 1
      RETURNING next_value - 1 INTO v_seq;

    UPDATE deals
       SET code = v_prefix || '-' || v_year::text || '-' || LPAD(v_seq::text, 3, '0')
     WHERE id = d.id;
  END LOOP;
END $$;

COMMIT;

-- =========================================================================
-- Registre (garde-fou build)
-- =========================================================================

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v58') ON CONFLICT (version) DO NOTHING;

-- =========================================================================
-- Vérifications :
--
-- Colonne et index :
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'deals' AND column_name = 'code';
-- SELECT indexname FROM pg_indexes
--  WHERE tablename = 'deals' AND indexname = 'idx_deals_user_code';
--
-- Table compteurs :
-- SELECT table_name FROM information_schema.tables
--  WHERE table_name = 'deal_code_counters';
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE tablename = 'deal_code_counters';
--
-- Trigger actif :
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid = 'deals'::regclass AND tgname = 'set_deal_code';
--
-- Codes attribués :
-- SELECT code, deal_type, created_at FROM deals
--  WHERE user_id = auth.uid() ORDER BY created_at;
