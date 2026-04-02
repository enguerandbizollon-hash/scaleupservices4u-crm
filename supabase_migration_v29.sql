-- V29 : Peupler colonnes structurées investisseur depuis anciennes colonnes texte
-- Idempotent : ne touche que les records avec colonnes structurées vides
-- Ciblé : organization_type IN ('investor','business_angel','family_office','corporate')

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 3a. investor_ticket_min / investor_ticket_max depuis investment_ticket
-- ═══════════════════════════════════════════════════════════════════════
-- Approche sûre : CASE sur patterns connus, pas de cast dynamique

UPDATE organizations SET investor_ticket_max = 500000
WHERE organization_type IN ('investor','business_angel','family_office','corporate')
  AND investor_ticket_min IS NULL AND investor_ticket_max IS NULL
  AND lower(investment_ticket) LIKE '%< 500k%';

UPDATE organizations SET investor_ticket_min = 500000, investor_ticket_max = 1000000
WHERE organization_type IN ('investor','business_angel','family_office','corporate')
  AND investor_ticket_min IS NULL AND investor_ticket_max IS NULL
  AND (lower(investment_ticket) LIKE '%500k%1m%' OR lower(investment_ticket) LIKE '%500k%–%1m%');

UPDATE organizations SET investor_ticket_min = 1000000, investor_ticket_max = 3000000
WHERE organization_type IN ('investor','business_angel','family_office','corporate')
  AND investor_ticket_min IS NULL AND investor_ticket_max IS NULL
  AND (lower(investment_ticket) LIKE '%1m%3m%' OR lower(investment_ticket) LIKE '%1m%–%3m%');

UPDATE organizations SET investor_ticket_min = 3000000, investor_ticket_max = 10000000
WHERE organization_type IN ('investor','business_angel','family_office','corporate')
  AND investor_ticket_min IS NULL AND investor_ticket_max IS NULL
  AND (lower(investment_ticket) LIKE '%3m%10m%' OR lower(investment_ticket) LIKE '%3m%–%10m%');

UPDATE organizations SET investor_ticket_min = 10000000, investor_ticket_max = 25000000
WHERE organization_type IN ('investor','business_angel','family_office','corporate')
  AND investor_ticket_min IS NULL AND investor_ticket_max IS NULL
  AND (lower(investment_ticket) LIKE '%10m%25m%' OR lower(investment_ticket) LIKE '%10m%–%25m%');

UPDATE organizations SET investor_ticket_min = 25000000
WHERE organization_type IN ('investor','business_angel','family_office','corporate')
  AND investor_ticket_min IS NULL AND investor_ticket_max IS NULL
  AND lower(investment_ticket) LIKE '%> 25m%';

-- ═══════════════════════════════════════════════════════════════════════
-- 3b. investor_sectors[] depuis sector
-- ═══════════════════════════════════════════════════════════════════════

UPDATE organizations SET investor_sectors = ARRAY[
  CASE
    WHEN lower(sector) LIKE '%généraliste%' OR lower(sector) LIKE '%generaliste%' THEN 'Généraliste'
    WHEN lower(sector) LIKE '%saas%' OR lower(sector) LIKE '%logiciel%' OR lower(sector) LIKE '%software%' THEN 'SaaS'
    WHEN lower(sector) LIKE '%fintech%' THEN 'Fintech'
    WHEN lower(sector) LIKE '%insurtech%' THEN 'InsurTech'
    WHEN lower(sector) LIKE '%healthtech%' OR lower(sector) LIKE '%santé%' OR lower(sector) LIKE '%medtech%' THEN 'Healthtech'
    WHEN lower(sector) LIKE '%deeptech%' OR lower(sector) LIKE '%ia%' OR lower(sector) LIKE '%intelligence artificielle%' THEN 'Deeptech'
    WHEN lower(sector) LIKE '%cyber%' THEN 'Cybersécurité'
    WHEN lower(sector) LIKE '%industrie%' OR lower(sector) LIKE '%manufacturing%' OR lower(sector) LIKE '%btp%' THEN 'Industrie'
    WHEN lower(sector) LIKE '%retail%' OR lower(sector) LIKE '%commerce%' OR lower(sector) LIKE '%distribution%' THEN 'Retail'
    WHEN lower(sector) LIKE '%energie%' OR lower(sector) LIKE '%énergie%' OR lower(sector) LIKE '%cleantech%' THEN 'Energie'
    WHEN lower(sector) LIKE '%immobilier%' OR lower(sector) LIKE '%real estate%' OR lower(sector) LIKE '%proptech%' THEN 'Immobilier'
    WHEN lower(sector) LIKE '%transport%' OR lower(sector) LIKE '%logistique%' THEN 'Transport'
    WHEN lower(sector) LIKE '%food%' OR lower(sector) LIKE '%agri%' OR lower(sector) LIKE '%agroalimentaire%' THEN 'Food'
    WHEN lower(sector) LIKE '%edtech%' OR lower(sector) LIKE '%éducation%' OR lower(sector) LIKE '%education%' THEN 'Edtech'
    WHEN lower(sector) LIKE '%marketplace%' THEN 'Marketplace'
    WHEN lower(sector) LIKE '%hardware%' OR lower(sector) LIKE '%télécom%' THEN 'Hardware'
    WHEN lower(sector) LIKE '%impact%' OR lower(sector) LIKE '%social%' THEN 'Impact'
    WHEN lower(sector) LIKE '%luxe%' OR lower(sector) LIKE '%beauté%' THEN 'Luxe'
    WHEN lower(sector) LIKE '%média%' OR lower(sector) LIKE '%media%' OR lower(sector) LIKE '%entertainment%' THEN 'Média'
    WHEN lower(sector) LIKE '%sport%' OR lower(sector) LIKE '%loisir%' THEN 'Sport'
    WHEN lower(sector) LIKE '%défense%' OR lower(sector) LIKE '%defense%' THEN 'Défense'
    WHEN lower(sector) LIKE '%aéro%' OR lower(sector) LIKE '%aerospace%' THEN 'Aéronautique'
    WHEN lower(sector) LIKE '%conseil%' OR lower(sector) LIKE '%advisory%' OR lower(sector) LIKE '%juridique%' THEN 'Conseil'
    WHEN lower(sector) LIKE '%services b2b%' THEN 'Services B2B'
    ELSE NULL
  END
]
WHERE organization_type IN ('investor','business_angel','family_office','corporate')
  AND (investor_sectors IS NULL OR investor_sectors = '{}')
  AND sector IS NOT NULL
  AND sector != ''
  -- Exclure si CASE retourne NULL (pas de match)
  AND CASE
    WHEN lower(sector) LIKE '%généraliste%' OR lower(sector) LIKE '%generaliste%' THEN TRUE
    WHEN lower(sector) LIKE '%saas%' OR lower(sector) LIKE '%logiciel%' OR lower(sector) LIKE '%software%' THEN TRUE
    WHEN lower(sector) LIKE '%fintech%' THEN TRUE
    WHEN lower(sector) LIKE '%insurtech%' THEN TRUE
    WHEN lower(sector) LIKE '%healthtech%' OR lower(sector) LIKE '%santé%' OR lower(sector) LIKE '%medtech%' THEN TRUE
    WHEN lower(sector) LIKE '%deeptech%' OR lower(sector) LIKE '%ia%' OR lower(sector) LIKE '%intelligence artificielle%' THEN TRUE
    WHEN lower(sector) LIKE '%cyber%' THEN TRUE
    WHEN lower(sector) LIKE '%industrie%' OR lower(sector) LIKE '%manufacturing%' THEN TRUE
    WHEN lower(sector) LIKE '%retail%' OR lower(sector) LIKE '%commerce%' THEN TRUE
    WHEN lower(sector) LIKE '%energie%' OR lower(sector) LIKE '%énergie%' OR lower(sector) LIKE '%cleantech%' THEN TRUE
    WHEN lower(sector) LIKE '%immobilier%' OR lower(sector) LIKE '%proptech%' THEN TRUE
    WHEN lower(sector) LIKE '%transport%' OR lower(sector) LIKE '%logistique%' THEN TRUE
    WHEN lower(sector) LIKE '%food%' OR lower(sector) LIKE '%agri%' THEN TRUE
    WHEN lower(sector) LIKE '%edtech%' OR lower(sector) LIKE '%éducation%' THEN TRUE
    WHEN lower(sector) LIKE '%marketplace%' THEN TRUE
    WHEN lower(sector) LIKE '%hardware%' THEN TRUE
    WHEN lower(sector) LIKE '%impact%' OR lower(sector) LIKE '%social%' THEN TRUE
    WHEN lower(sector) LIKE '%luxe%' OR lower(sector) LIKE '%beauté%' THEN TRUE
    WHEN lower(sector) LIKE '%média%' OR lower(sector) LIKE '%media%' THEN TRUE
    WHEN lower(sector) LIKE '%sport%' THEN TRUE
    WHEN lower(sector) LIKE '%défense%' OR lower(sector) LIKE '%defense%' THEN TRUE
    WHEN lower(sector) LIKE '%aéro%' THEN TRUE
    WHEN lower(sector) LIKE '%conseil%' OR lower(sector) LIKE '%advisory%' OR lower(sector) LIKE '%juridique%' THEN TRUE
    WHEN lower(sector) LIKE '%services b2b%' THEN TRUE
    ELSE FALSE
  END;

-- ═══════════════════════════════════════════════════════════════════════
-- 3c. investor_stages[] depuis investment_stage
-- ═══════════════════════════════════════════════════════════════════════

UPDATE organizations SET investor_stages = ARRAY[
  CASE
    WHEN lower(investment_stage) LIKE '%pré-série a%' OR lower(investment_stage) LIKE '%pre-series a%' THEN 'Pré-Série A'
    WHEN lower(investment_stage) LIKE '%série a%' OR lower(investment_stage) LIKE '%series a%' THEN 'Série A'
    WHEN lower(investment_stage) LIKE '%série b%' OR lower(investment_stage) LIKE '%series b%' THEN 'Série B'
    WHEN lower(investment_stage) LIKE '%late%' OR lower(investment_stage) LIKE '%buyout%' OR lower(investment_stage) LIKE '%lbo%' THEN 'Late Stage'
    WHEN lower(investment_stage) LIKE '%growth%' THEN 'Growth'
    WHEN lower(investment_stage) LIKE '%pre-seed%' OR lower(investment_stage) LIKE '%preseed%' THEN 'Seed'
    WHEN lower(investment_stage) LIKE '%seed%' THEN 'Seed'
    WHEN lower(investment_stage) LIKE '%généraliste%' OR lower(investment_stage) LIKE '%toutes%' THEN 'Généraliste'
    ELSE NULL
  END
]
WHERE organization_type IN ('investor','business_angel','family_office','corporate')
  AND (investor_stages IS NULL OR investor_stages = '{}')
  AND investment_stage IS NOT NULL
  AND investment_stage != ''
  AND CASE
    WHEN lower(investment_stage) LIKE '%série%' OR lower(investment_stage) LIKE '%series%' THEN TRUE
    WHEN lower(investment_stage) LIKE '%seed%' OR lower(investment_stage) LIKE '%preseed%' THEN TRUE
    WHEN lower(investment_stage) LIKE '%growth%' THEN TRUE
    WHEN lower(investment_stage) LIKE '%late%' OR lower(investment_stage) LIKE '%buyout%' OR lower(investment_stage) LIKE '%lbo%' THEN TRUE
    WHEN lower(investment_stage) LIKE '%généraliste%' OR lower(investment_stage) LIKE '%toutes%' THEN TRUE
    ELSE FALSE
  END;

-- ═══════════════════════════════════════════════════════════════════════
-- 3d. investor_geographies[] depuis location
-- ═══════════════════════════════════════════════════════════════════════

UPDATE organizations SET investor_geographies = ARRAY[
  CASE
    WHEN lower(location) LIKE '%global%' OR lower(location) LIKE '%worldwide%' OR lower(location) LIKE '%international%' THEN 'global'
    WHEN lower(location) LIKE '%france%' THEN 'france'
    WHEN lower(location) LIKE '%suisse%' OR lower(location) LIKE '%switzerland%' OR lower(location) LIKE '%genève%' OR lower(location) LIKE '%zurich%' THEN 'suisse'
    WHEN lower(location) LIKE '%dach%' OR lower(location) LIKE '%allemagne%' OR lower(location) LIKE '%germany%' THEN 'dach'
    WHEN lower(location) LIKE '%europe%' THEN 'europe'
    WHEN lower(location) LIKE '%usa%' OR lower(location) LIKE '%états-unis%' OR lower(location) LIKE '%north america%' THEN 'amerique_nord'
    WHEN lower(location) LIKE '%asie%' OR lower(location) LIKE '%asia%' THEN 'asie'
    ELSE NULL
  END
]
WHERE organization_type IN ('investor','business_angel','family_office','corporate')
  AND (investor_geographies IS NULL OR investor_geographies = '{}')
  AND location IS NOT NULL
  AND location != ''
  AND CASE
    WHEN lower(location) LIKE '%global%' OR lower(location) LIKE '%worldwide%' OR lower(location) LIKE '%international%' THEN TRUE
    WHEN lower(location) LIKE '%france%' THEN TRUE
    WHEN lower(location) LIKE '%suisse%' OR lower(location) LIKE '%switzerland%' OR lower(location) LIKE '%genève%' OR lower(location) LIKE '%zurich%' THEN TRUE
    WHEN lower(location) LIKE '%dach%' OR lower(location) LIKE '%allemagne%' THEN TRUE
    WHEN lower(location) LIKE '%europe%' THEN TRUE
    WHEN lower(location) LIKE '%usa%' OR lower(location) LIKE '%états-unis%' THEN TRUE
    WHEN lower(location) LIKE '%asie%' OR lower(location) LIKE '%asia%' THEN TRUE
    ELSE FALSE
  END;

-- ═══════════════════════════════════════════════════════════════════════
-- 3e. investor_stage_min / investor_stage_max (nouvelles colonnes)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS investor_stage_min TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS investor_stage_max TEXT;

-- Peupler depuis investor_stages[] si renseigné
UPDATE organizations SET
  investor_stage_min = investor_stages[1],
  investor_stage_max = investor_stages[array_length(investor_stages, 1)]
WHERE organization_type IN ('investor','business_angel','family_office','corporate')
  AND investor_stage_min IS NULL
  AND investor_stages IS NOT NULL
  AND array_length(investor_stages, 1) > 0;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- Vérification post-migration
-- ═══════════════════════════════════════════════════════════════════════

-- SELECT
--   COUNT(*) AS total_investors,
--   COUNT(investor_ticket_min) AS has_ticket_min,
--   COUNT(investor_sectors) FILTER (WHERE investor_sectors != '{}') AS has_sectors,
--   COUNT(investor_stages) FILTER (WHERE investor_stages != '{}') AS has_stages,
--   COUNT(investor_geographies) FILTER (WHERE investor_geographies != '{}') AS has_geos,
--   COUNT(investor_stage_min) AS has_stage_min
-- FROM organizations
-- WHERE organization_type IN ('investor','business_angel','family_office','corporate');
