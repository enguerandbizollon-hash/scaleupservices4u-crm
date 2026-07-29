-- V67 : critères M&A small cap du matching acquéreurs (phase 3, temps 2)
--
-- La grille de scoring validée le 2026-07-30 exige deux informations qui
-- n'existaient pas dans le modèle (hérité fundraising) :
--
--   1. Côté ACQUÉREUR (organizations) :
--      - operation_types : les opérations qu'il pratique réellement
--        (succession, MBI, sponsor de MBO, build-up, carve-out,
--        minoritaire de croissance, retournement). Confrontées au contexte
--        du dossier, elles font le score « type d'opération » (20 pts) et
--        l'éliminatoire structurel (un fonds minoritaire ne rachète pas
--        100 % d'une transmission).
--      - deal_stance : majoritaire / minoritaire / les deux.
--      - acquirer_summary : thèse libre en une phrase. Champ texte
--        canonique posé dès maintenant pour le branchement vectoriel
--        ultérieur (décision : différé sous 500 fiches).
--
--   2. Côté DOSSIER (deals) :
--      - deal_context : pourquoi ça vend (succession, MBO, build-up,
--        carve-out, adossement croissance, retournement). Trente secondes
--        de saisie qui pilotent 20 points du score et les éliminatoires.
--
-- Référentiels des valeurs : lib/crm/matching-maps.ts (source de vérité).
-- Aucune donnée existante modifiée, colonnes nullables, idempotent.

BEGIN;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS operation_types TEXT[],
  ADD COLUMN IF NOT EXISTS deal_stance TEXT,
  ADD COLUMN IF NOT EXISTS acquirer_summary TEXT;

COMMENT ON COLUMN organizations.operation_types IS
  'Opérations pratiquées par l''acquéreur : succession | mbi | mbo_sponsor | build_up | carve_out | minoritaire_croissance | retournement. Référentiel OPERATION_TYPES (matching-maps).';
COMMENT ON COLUMN organizations.deal_stance IS
  'Position capitalistique : majority | minority | both. Croisée avec partial_sale_ok du dossier (éliminatoire structure).';
COMMENT ON COLUMN organizations.acquirer_summary IS
  'Thèse d''acquisition libre (1-3 phrases). Champ canonique préparé pour la recherche vectorielle (phase ultérieure).';

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS deal_context TEXT;

COMMENT ON COLUMN deals.deal_context IS
  'Contexte de l''opération côté cédant : succession | mbo | build_up | carve_out | croissance | retournement. Référentiel DEAL_CONTEXTS (matching-maps). Pilote le score « type d''opération » du matching acquéreurs.';

COMMIT;

INSERT INTO _crm_migrations_applied (version)
  VALUES ('v67') ON CONFLICT (version) DO NOTHING;

-- ── Vérification post-application ───────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'organizations'
--     AND column_name IN ('operation_types','deal_stance','acquirer_summary');
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'deals' AND column_name = 'deal_context';
