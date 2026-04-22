# CLAUDE.md — CRM ScaleUp Services 4U
# Source de vérité absolue — lire intégralement avant tout travail

---

## Identité et vision

ScaleUp Services 4U SA est un cabinet de conseil en M&A, fundraising et
recrutement. Ce CRM est l'outil opérationnel exclusif du cabinet.
Il n'est pas un produit générique — il est taillé pour un seul usage :
celui de Scale Up Services 4U et de ses 4 collaborateurs.

### Vision plateforme

Le CRM est le cœur d'une plateforme de conseil augmentée par l'IA.
À terme, un client peut se connecter depuis le site internet du cabinet,
décrire son besoin, uploader ses documents, signer un NDA généré
automatiquement, et déclencher un processus automatisé :
— modélisation de son entreprise
— présentation commerciale et modélisation financière
— recherche de key people
— matchmaking avec des cibles, acquéreurs ou investisseurs
— suivi du dossier en temps réel depuis son espace client

L'équipe pilote tout depuis le CRM. Le client voit ce que le cabinet partage.

Chaque décision d'architecture doit aller dans ce sens.
Si une table, un composant ou une action ne peut pas s'étendre vers cette
vision → le signaler et proposer une alternative compatible.

---

## Repo et stack

Repo : github.com/enguerandbizollon-hash/scaleupservices4u-crm
User Supabase : edf600b3-0fa3-44f0-8696-dc17f481f2e1
Stack : Next.js 16 · Supabase · Tailwind · App Router · Server Actions
Déploiement : Vercel
Utilisateurs internes : 4 (M&A · Fundraising · RH · CFO Advisory)

---

## Architecture globale — trois couches

### Couche 1 — CRM interne (en construction)
Outil de pilotage quotidien pour l'équipe.
Organisations · Contacts · Dossiers · Pipeline · Tâches · Agenda
Données financières · Matching · Module RH · Module M&A IA

### Couche 2 — Portail client (futur)
Interface publique connectée au site internet.
Création de compte · Description du besoin · Upload documents · NDA auto
Suivi dossier · Matchmaking déclenché depuis le portail

### Couche 3 — IA et automatisations (transversal)
Enrichissement données via connecteurs · Traitement IA documents
Génération livrables · Matchmaking algorithmique multi-métier
Automatisation relances et communications

---

## Philosophie de construction — non négociable

### Le CRM est un organisme vivant

Modifier un élément = l'imbriquer dans l'existant, jamais s'y superposer.
Un travail nouveau ne peut jamais mettre en échec le travail précédent.

Si un nouveau développement entre en conflit avec l'existant :
1. Identifier le conflit explicitement
2. Proposer la modification de l'existant pour le rendre compatible
3. Implémenter la compatibilité avant la nouvelle fonctionnalité
4. Ne jamais ignorer un conflit

### Partir de l'existant — sans exception

Avant toute proposition de nouveau champ, table ou composant :
1. Vérifier ce qui existe en base : information_schema.columns
2. Vérifier ce qui existe dans le code : grep + lecture des fichiers
3. Réutiliser les enums, statuts, composants et patterns en place
4. Identifier les impacts sur les modules déjà livrés
5. Ne jamais créer de doublon

### Construction modulaire sans friction

Chaque module est indépendant dans son périmètre, compatible avec tous
les autres, extensible sans régression, connecté par des interfaces claires.
Un module ne redéfinit jamais ce qu'un autre a défini.
Si un référentiel existe → l'importer depuis lib/crm/matching-maps.ts.

### Scalabilité sans complexité

- Tables normalisées, relations explicites par FK
- Pas de jsonb pour des données structurées filtrables
- Index sur colonnes de filtrage fréquent (status, type, owner_id,
  deal_type, created_at, fiscal_year)
- Logique métier dans les Server Actions, pas dans la base
- Tables de liaison (pivot) pour toutes les relations N-N évolutives
- Colonnes source + external_id sur tout ce qui vient d'un connecteur

---

## Stack technique — non négociable

- Next.js 16, App Router, TypeScript strict (pas de any)
- Supabase : Auth + PostgreSQL + RLS + Storage + Realtime si besoin
- Tailwind CSS — composants réutilisables
- Server Actions exclusivement — pas d'API routes custom
- Vercel pour le déploiement
- Supabase Storage pour tous les fichiers (CV, bilans, documents)

---

## Conventions strictes

### Fichiers
- Extensions exactes : page.tsx / actions.ts / route.ts / layout.tsx
- Un fichier = une responsabilité claire

### Composants
- Jamais de onClick sur un Server Component
- Toute interactivité = "use client" explicite
- Composants réutilisables dans components/[module]/
- Jamais de composant dupliqué entre modules

### Auth et sécurité
- proxy.ts gère l'auth — ne jamais toucher middleware.ts
- Un seul createServerClient() dans lib/supabase/server.ts
- user_id obligatoire sur TOUTES les tables internes
- RLS activée sur toutes les tables sans exception
- Données portail client isolées par client_id + RLS dédiée
- Aucune donnée sensible dans les URLs, logs ou messages d'erreur

### Pattern RLS uniforme
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own [table]" ON [table]
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

### Architecture fichiers
lib/supabase/server.ts          → client unique
lib/crm/[module].ts             → fonctions de lecture
lib/crm/matching-maps.ts        → référentiels partagés (source de vérité)
lib/crm/ma-scoring.ts           → algorithme matching M&A
lib/crm/recruitment-scoring.ts  → algorithme matching RH
lib/crm/fee-calculator.ts       → calcul honoraires et jalons
lib/ai/financial-scoring.ts     → notation IA financière
lib/ai/document-extraction.ts   → extraction données documents
lib/ai/presentation-analysis.ts → analyse IA présentations et decks
lib/connectors/[source].ts      → interface par connecteur
lib/import/csv-parser.ts        → parsing import CSV/Excel
lib/import/gdrive-sync.ts       → synchronisation Google Drive
lib/dedup/organisations.ts      → déduplication organisations
actions/[module].ts             → Server Actions CRUD
actions/ai/[module].ts          → Server Actions IA
actions/import/[source].ts      → Server Actions import par canal
actions/matching.ts             → matching investisseurs
actions/ma-matching.ts          → matching M&A
actions/recruitment-matching.ts → matching RH
actions/fees.ts                 → gestion honoraires et jalons
components/[module]/            → composants UI par module

---

## Mandats — modèle formalisé

Les mandats sont le cadre commercial de chaque mission du cabinet.
Un mandat = une relation contractuelle avec un client.
Un mandat contient un ou plusieurs dossiers opérationnels (deals).

### Table : mandates
- id (uuid PK)
- user_id (uuid)
- name (text NOT NULL) — intitulé du mandat
- type (text NOT NULL) — fundraising | ma_sell | ma_buy |
                          cfo_advisor | recruitment
- client_organization_id (uuid FK organisations NOT NULL)
- description (text)
- status (text) — draft | active | on_hold | won | lost | closed
- priority (text) — low | medium | high
- owner_id (uuid FK users) — responsable du mandat
- start_date (date)
- target_close_date (date)
- end_date (date)
- currency (text default 'EUR')
- estimated_fee_amount (numeric) — honoraires estimés total
- confirmed_fee_amount (numeric) — honoraires confirmés / facturés
- retainer_monthly (numeric) — retainer mensuel si applicable
- success_fee_percent (numeric) — % success fee si applicable
- success_fee_base (text) — ev | revenue | raise_amount | salary
- notes (text)
- created_at (timestamptz)
- updated_at (timestamptz)

RLS : auth.uid() = user_id.

### Relations mandats
1 mandat → N deals (dossiers opérationnels)
1 mandat → N fee_milestones (jalons de facturation)
1 mandat → N documents
1 mandat → 1 organisation cliente

### Règles mandats
- owner_id obligatoire pour tout mandat actif
- type obligatoire pour tout mandat actif
- Un deal doit idéalement être rattaché à un mandat
- Quand un deal passe en won → mandat.status = won si dernier deal actif
- Quand un mandat passe en won/closed → deal.status doit être cohérent

---

## Honoraires et fees — modèle complet

Le cabinet génère trois types de revenus :
retainers (récurrents) · success fees (à la performance) · forfaits ponctuels.

### Table : fee_milestones (jalons de facturation)
- id (uuid PK)
- user_id (uuid)
- mandate_id (uuid FK mandates NOT NULL)
- deal_id (uuid FK deals, nullable)
- name (text) — ex: "Signing mandat", "Closing deal", "Livraison BP"
- milestone_type (text) — retainer | success_fee | fixed | expense
- amount (numeric NOT NULL)
- currency (text default 'EUR')
- due_date (date) — date prévue
- invoiced_date (date) — date facturée
- paid_date (date) — date encaissée
- status (text) — pending | invoiced | paid | cancelled
- invoice_reference (text)
- notes (text)
- created_at (timestamptz)

RLS : auth.uid() = user_id.

### Calcul success fee par deal_type

Fundraising :
success_fee = raise_amount × success_fee_percent
Ex : levée 3M CHF × 3% = 90K CHF

M&A Sell-side :
success_fee = ev_deal × success_fee_percent
Avec possible minimum garanti (min_fee)

M&A Buy-side :
success_fee = acquisition_price × success_fee_percent
Ou forfait si défini dans le mandat

Recrutement :
success_fee = annual_salary_placed × success_fee_percent
Placement standard : 15-25% du salaire annuel brut

CFO Advisory :
retainer_monthly × duration_months + forfaits livrables

### Règles fees
- Devise du jalon = devise du mandat par défaut
- Conversion automatique pour affichage dashboard (voir multi-devise)
- Alerte si jalon pending dépassant due_date de 30+ jours
- fee_milestones.status = 'paid' déclenche mise à jour
  mandate.confirmed_fee_amount

### Affichage dashboard fees
Par mandat : jalons à venir · en retard · encaissés
Global cabinet : pipeline fees (pending) · encaissé YTD · projeté année
Par collaborateur : CA généré par owner_id

---

## Multi-devise

Le cabinet opère en EUR, CHF et USD principalement.

### Règles de stockage
- Toutes les valeurs sont stockées dans la devise native du deal/mandat
- Le champ currency est obligatoire sur deals, mandates, fee_milestones,
  financial_data
- Ne jamais convertir à la volée en base — stocker la valeur native

### Table : exchange_rates (taux de change)
- id (uuid PK)
- from_currency (text) — EUR | CHF | USD | GBP
- to_currency (text)
- rate (numeric) — taux de conversion
- effective_date (date)
- source (text) — manual | api
- created_at (timestamptz)

Mise à jour : manuelle ou via Make (automatisation périodique).

### Devise de référence pour les dashboards
Devise de référence cabinet : EUR (paramétrable dans les settings)
Conversion affichage uniquement — jamais persistée
Formule : displayed_value = native_value × exchange_rate

### Affichage multi-devise
Toujours afficher la valeur native + la devise
En dashboard global : afficher la conversion en devise de référence
avec mention "(converti au taux du JJ/MM/AAAA)"
Champs concernés : valorisations, fees, montants levés, budgets M&A

---

## Tags transversaux

Les tags permettent des filtres libres sur tous les objets du CRM.
Ils sont essentiels pour le travail quotidien du cabinet.

### Tables tags
tags :
- id (uuid PK)
- user_id (uuid)
- name (text NOT NULL) — ex: "ex-Rothschild", "réseau PE", "deal 2023"
- category (text) — réseau | secteur | statut | source | autre
- color (text) — couleur hex pour affichage
- created_at (timestamptz)

object_tags (table de liaison générique) :
- id (uuid PK)
- user_id (uuid)
- tag_id (uuid FK tags)
- object_type (text) — organisation | contact | deal | candidate | mandate
- object_id (uuid) — FK vers l'objet concerné
- created_at (timestamptz)

Index sur (object_type, object_id) pour filtrage rapide.

### Utilisation des tags
- Sur les organisations : "réseau PE", "fonds top tier", "ex-client"
- Sur les contacts : "décideur", "ex-Lazard", "board member"
- Sur les candidats : "ex-Rothschild", "bilingue anglais", "DAF expérimenté"
- Sur les deals : "deal phare", "référence secteur", "closing Q1 2024"
- Sur les mandats : "mandat récurrent", "client stratégique"

### Règles tags
- Tags libres — pas de liste fermée imposée
- Suggestions basées sur les tags existants à la saisie
- Un tag supprimé retire les object_tags associés (CASCADE)
- Filtres tags disponibles sur toutes les vues liste
- Combinaison de tags possible (ET / OU)

---

## Déduplication organisations

Avec des imports multi-canaux, les doublons sont inévitables sans règles.

### Règle de détection
Deux organisations sont potentiellement doublons si :
- normalized_name identique (lowercase, sans accents, sans ponctuation)
- OU website identique (domaine exact)
- OU linkedin_url identique

normalized_name = toLowerCase(removePunctuation(removeAccents(name)))

### Processus déduplication
lib/dedup/organisations.ts :
1. À la création d'une organisation → vérifier doublons potentiels
2. Si doublon détecté → alerte UI (non bloquant) avec les candidats
3. L'utilisateur choisit : ignorer / fusionner / garder les deux
4. Fusion : toutes les FK (deals, contacts, tags) pointent vers l'org maître
   L'org secondaire passe en status = 'merged', is_merged = true,
   merged_into_id = org_maître.id

Colonnes à ajouter sur organisations :
- normalized_name (text) — généré automatiquement au save
- is_merged (boolean default false)
- merged_into_id (uuid FK organisations, nullable)
- external_ids (jsonb) — { harmonic: "...", crunchbase: "..." }

### Import multi-canaux et déduplication
Avant tout upsert depuis un connecteur :
1. Chercher par external_id (source + external_id) en priorité
2. Si absent → chercher par normalized_name ou website
3. Si match → enrichir l'existant (upsert champs)
4. Si aucun match → créer une nouvelle entrée
5. Si doublon détecté → logger pour revue manuelle

---

## Versioning des documents

Quand un document est remplacé, l'historique est conservé.

### Table : document_versions
- id (uuid PK)
- user_id (uuid)
- document_id (uuid FK ma_documents) — document parent
- version_number (integer) — 1, 2, 3...
- file_url (text) — Supabase Storage (chemin unique par version)
- file_name (text)
- file_size (integer)
- uploaded_by (uuid FK users)
- upload_notes (text) — motif de la mise à jour
- ai_extracted_data (jsonb)
- ai_processed_at (timestamptz)
- is_current (boolean default false) — une seule version courante
- created_at (timestamptz)

### Règles versioning
- À l'upload d'un nouveau fichier sur un document existant :
  → version actuelle : is_current = false
  → nouvelle version : is_current = true, version_number++
- Jamais de suppression de version — archivage uniquement
- L'analyse IA se relance automatiquement sur la nouvelle version
- Affichage : version courante visible par défaut, historique accessible
- Accès versions antérieures via URL signée temporaire (Supabase Storage)

---

## RGPD et data retention

Le cabinet traite des données personnelles sensibles (candidats RH,
contacts clients). Des règles de conservation et suppression s'appliquent.

### Durées de conservation par objet
Candidats (candidates) :
- Actifs (searching / in_process) : durée illimitée
- Placés (placed / employed) : 5 ans après le placement
- Inactifs sans interaction : 2 ans après dernière interaction
- Blacklistés : 3 ans (pour justifier l'exclusion si contesté)

Contacts (contacts) :
- Durée illimitée si liés à un deal ou mandat actif
- 3 ans après dernière interaction si aucun deal lié

Documents clients :
- Documents contractuels (NDA, mandats) : 10 ans
- Documents financiers clients : 5 ans après clôture du dossier
- CV candidats : durée de vie du candidat dans le vivier

### Colonnes RGPD à ajouter
Sur candidates :
- rgpd_consent (boolean default false) — consentement recueilli
- rgpd_consent_date (timestamptz)
- rgpd_expiry_date (date) — date de suppression prévue
- anonymized_at (timestamptz) — date d'anonymisation si effectuée

Sur contacts :
- do_not_contact (boolean default false) — déjà présent, à respecter
- rgpd_expiry_date (date)

### Processus d'anonymisation
Jamais de suppression physique — anonymisation uniquement.
Anonymisation = remplacement des données personnelles par des valeurs
neutres tout en conservant les métriques agrégées.

Champs anonymisés sur candidates :
first_name = "Anonymisé" · last_name = "Candidat" · email = null
phone = null · linkedin_url = null · cv_url = null

Les deal_candidates, scores et statistiques sont conservés.

### Alertes RGPD
- 30 jours avant rgpd_expiry_date → alerte dans le dashboard
- L'utilisateur confirme : prolonger / anonymiser / archiver
- Log de toutes les actions RGPD dans une table dédiée

### Table : rgpd_log
- id (uuid PK)
- user_id (uuid)
- object_type (text) — candidate | contact
- object_id (uuid)
- action (text) — consent_recorded | anonymized | expiry_extended |
                   deletion_requested | data_exported
- performed_by (uuid FK users)
- notes (text)
- created_at (timestamptz)

---

## Statistiques cabinet — reporting global

Le cabinet doit pouvoir mesurer sa performance globale et par métier.

### Table : cabinet_stats (vue calculée ou table matérialisée)
Calculée à la volée depuis les données existantes.
Pas de table dédiée — utiliser des Server Actions qui agrègent.

### Métriques globales (dashboard général)

Revenue cabinet :
- Fees encaissés YTD (fee_milestones.status = 'paid', année en cours)
- Fees facturés YTD (status = 'invoiced')
- Pipeline fees (status = 'pending')
- Objectif annuel vs réalisé (paramétrable dans settings)
- Projection fin d'année (linear extrapolation)

Performance dossiers :
- Taux de closing par deal_type (won / total fermés)
- Durée moyenne par stade et par deal_type
- Dossiers ouverts / fermés / en attente
- Valeur moyenne des deals par type

Performance équipe :
- Fees générés par owner_id
- Nombre de dossiers actifs par collaborateur
- Taux de conversion individuel

### Métriques par métier

Fundraising :
- Montants levés YTD total
- Taille moyenne des rounds
- Délai moyen signing → closing
- Top secteurs fundraising

M&A :
- Valeur totale des transactions YTD
- Nombre de deals signés
- Valorisation moyenne
- Répartition sell-side / buy-side

Recrutement :
- Nombre de placements YTD
- Taux de conversion vivier → placement
- Délai moyen sourcing → placement
- Source la plus efficace (LinkedIn / réseau / inbound)
- Taux de réussite à 6 mois (candidat toujours en poste)

### Dashboard statistiques (/protected/statistiques)
Filtres : période (mois / trimestre / année) · deal_type · owner_id
Graphiques : évolution fees · pipeline par stade · conversions
Export : CSV ou PDF des statistiques

---

## Données financières — modèle central unifié

Les données financières sont communes à tous les types de dossiers.
Chaque métier utilise un sous-ensemble de la même table financial_data.
Ne jamais créer de tables financières séparées par deal_type.

### Principe fondamental
La table financial_data est universelle.
Un dossier M&A peut avoir des métriques SaaS (ARR, NRR) si la cible est SaaS.
Un dossier Fundraising peut avoir un EBITDA si la société est profitable.
Tous les champs sont nullable — on renseigne ce qui est pertinent.
L'affichage est conditionnel selon le contexte, pas le stockage.

### Table : financial_data
- id (uuid PK)
- user_id (uuid)
- deal_id (uuid FK deals, nullable)
- organization_id (uuid FK organisations, nullable)
- fiscal_year (integer NOT NULL)
- period_type (text) — annual | quarterly | monthly
- period_label (text) — ex: "Q1 2024", "FY 2023"
- currency (text default 'EUR') — devise native des données

Métriques P&L et bilan :
- revenue · gross_profit · gross_margin · ebitda · ebitda_margin
- ebit · net_income · total_assets · net_debt · equity
- cash · capex · working_capital
- revenue_growth · ebitda_growth

Métriques opérationnelles :
- headcount · headcount_growth · revenue_per_employee

Métriques SaaS / récurrence (disponibles pour tous les deal_types) :
- arr · mrr · nrr · grr · churn_rate · cagr
- ltv · cac · ltv_cac_ratio · payback_months

Valorisation :
- ev_estimate · ev_revenue_multiple · ev_ebitda_multiple
- ev_arr_multiple · equity_value

Métadonnées import :
- source (text) — manual | csv | excel | gdrive | harmonic |
                   crunchbase | pitchbook | client_upload | api | portal
- external_id (text)
- raw_data (jsonb)
- ai_extracted (boolean default false)
- ai_confidence_score (numeric)
- ai_extraction_notes (text)
- imported_at (timestamptz)
- created_at · updated_at (timestamptz)

RLS : auth.uid() = user_id.
Index : (deal_id, fiscal_year), (organization_id, fiscal_year), source.

### Règle affichage historique
Toujours afficher N, N-1, N-2 en dashboard dossier.
N = dernier exercice disponible.
Calcul automatique des variations N vs N-1, N-1 vs N-2.
Affichage conditionnel métriques SaaS si arr > 0 ou mrr > 0.
Affichage conditionnel EBITDA si ebitda renseigné.

---

## Import des données financières — multi-canaux

Tous les canaux aboutissent à la même table financial_data.
Le champ source trace l'origine. L'upsert évite les doublons.

### Canal 1 — Saisie manuelle
Formulaire dans la fiche dossier ou organisation.
Champs organisés par catégorie (P&L · Bilan · SaaS · Valorisation).

### Canal 2 — Import CSV / Excel
Upload fichier → lib/import/csv-parser.ts.
Mapping automatique des colonnes avec suggestion IA.
Prévisualisation avant import (10 premières lignes).
Rapport d'import (lignes importées / erreurs / doublons).

### Canal 3 — Google Drive
lib/import/gdrive-sync.ts.
Sélection d'un fichier Google Sheets depuis le CRM.
Parsing automatique → même pipeline que CSV.
Synchronisation manuelle (bouton) ou planifiée (Make).
Scope OAuth : lecture seule sur les fichiers sélectionnés.

### Canal 4 — Connecteurs externes
Harmonic · Crunchbase / PitchBook → upsert via ConnectorRecord pattern.
Déclenchement : manuel (bouton Enrichir) ou automatique à la création.

### Canal 5 — Portail client
Le client uploade ses documents depuis son espace.
Analyse IA automatique à l'upload.
Résultats persistés avec source = 'portal'.

### Canal 6 — API externe
Endpoint POST /api/financial-data avec authentification API key.
Pour intégrations futures (ERP client, outils comptables).

### Analyse IA documents
lib/ai/document-extraction.ts — extraction depuis PDF/Excel/images
lib/ai/presentation-analysis.ts — analyse decks, teasers, BP

Types analysés : bilans · P&L · business plans · présentations ·
teasers M&A · états financiers consolidés

L'IA retourne toujours :
- Métriques extraites avec niveau de confiance
- Métriques manquantes ou ambiguës
- Résumé narratif de l'entreprise
- Flags si incohérences détectées

---

## Données financières — spécificités par deal_type

### Fundraising
Champs spécifiques sur deals :
target_raise_amount · pre_money_valuation · post_money_valuation
use_of_funds · runway_months · current_investors · round_type

Métriques prioritaires : ARR · MRR · NRR · CAGR · churn · LTV · CAC
+ revenue · gross_margin · ebitda si société profitable

### M&A Sell-side
Champs spécifiques sur deals :
asking_price_min/max · partial_sale_ok · management_retention
deal_timing · ai_financial_score · ai_valuation_low/high
ai_financial_notes · ai_analyzed_at

Métriques prioritaires : revenue · ebitda · ebitda_margin · net_debt
+ arr / nrr si modèle récurrent

### M&A Buy-side
Champs spécifiques sur deals :
target_sectors · target_geographies · target_revenue_min/max
target_ev_min/max · target_stage · acquisition_budget_min/max
full_acquisition_required · strategic_rationale
excluded_sectors · excluded_geographies · target_timing

---

## Module RH — liens et architecture

### Chaîne de données client RH complète
Organisation cliente (organisations)
  → Mandat recruitment (mandates via client_organization_id)
    → Dossier recruitment (deals via mandate_id + organization_id)
      → Candidats en process (deal_candidates)
        → Candidat placé (candidates.current_organization_id)

### Règles de liaison
- deal_candidates.deal_id → deals.id (deal_type = recruitment)
- deal_candidates.candidate_id → candidates.id
- candidates.current_organization_id = deals.organization_id au placement
- candidates.contact_id → contacts.id (nullable, si contact CRM existant)

### Trigger placement (M5)
Quand deal_candidates passe en placed :
→ candidates.global_status = 'placed'
→ candidates.current_organization_id = deals.organization_id
→ candidate_status_log INSERT (note obligatoire)
→ deal.status = 'won'
→ fee_milestones success_fee → status = 'invoiced'
→ mandate.confirmed_fee_amount mis à jour

### Dashboard organisation — onglet RH
- Dossiers RH actifs et historiques
- Candidats en process pour ce client
- Candidats placés avec date et poste
- Taux de placement (placés / présentés)
- Honoraires générés via dossiers RH

### Architecture 6 modules séquentiels
M1 BDD + Vivier · M2 Fiche 360° · M3 Pipeline kanban
M4 Scoring + matching bidirel. · M5 Connexions + triggers
M6 Export + Stats

### Statuts candidat
searching · in_process · placed · employed · inactive · blacklisted
Règle : changement = note obligatoire + INSERT log immuable

### Confidentialité
notes_internal → jamais dans exports
notes_shareable → rapport client OK
is_confidential → interne uniquement

---

## Matching M&A — algorithme

### Deal breakers éliminatoires
Secteur dans excluded_sectors · Revenue hors fourchette ×0.5/×2
full_acquisition_required = true ET org.partial_sale_ok = false

### Scoring stratégique (100pts)
Secteur 30 · Taille 25 · Géographie 15 · Profil stratég. 20 · Timing 10

### Score IA financier (séparé 0-100)
Croissance revenue 25 · Marge EBITDA 25 · Bilan 25 · Comparables 25

### Score combiné
strategic × 0.65 + financial × 0.35
Si financial absent → combined = strategic

### Directions
sell_to_buyer : ma_sell → Repreneur / ma_buy
buy_to_target : ma_buy → Cible M&A
Matching proactif sans mandat actif possible.

---

## Matching Fundraising — algorithme

Scope : TOUTES organisations investisseurs actives.
Scoring : Ticket 30 · Secteur 30 · Stade 25 · Géographie 15
Généraliste = secteur 100. Pondération dynamique. Pénalité < 3 critères.

---

## Matching RH — algorithme

Scoring : Compétences 35 · Séniorité 15 · Rémunération 20 ·
Géographie 15 · Remote 10 · Entretiens bonus
Bidirectionnel : getCandidateRanking(dealId) / getMatchingDeals(candidateId)

---

## Documents — table ma_documents

- id · user_id · deal_id · organization_id · candidate_id (nullable)
- document_type : bilan | pl | business_plan | organigramme | teaser |
                   nda | im | dataroom | cv | presentation | rapport | autre
- file_url · file_name · file_size · fiscal_year
- current_version_number (integer default 1)
- ai_extracted_data · ai_summary · ai_processed_at · ai_confidence_score
- is_confidential (boolean default true)
- source · external_id · created_at

---

## Dashboards — spécifications par type

### Dashboard général
KPIs globaux :
- Dossiers actifs par type
- Pipeline par stade
- Fees encaissés YTD · pipeline fees · projection annuelle
- Tâches en retard · relances dues
- Prochains entretiens RH
- Dernières activités

Widgets par métier (filtrables) :
- Fundraising : ARR moyen · rounds · closings proches
- M&A : dossiers par stade · deals signés · valorisations
- RH : candidats en process · placements YTD · taux conversion
- Fees : encaissé · facturé · pipeline · objectif vs réalisé

### Dashboard dossier Fundraising
Bloc données : ARR/MRR/NRR/CAGR + EBITDA si profitable — N/N-1/N-2
Bloc fees : jalons du mandat · statut encaissement
Bloc pipeline investisseurs + matching + activités

### Dashboard dossier M&A Sell-side
Bloc données : CA/EBITDA/marge/dette + ARR si SaaS — N/N-1/N-2
Bloc valorisation IA · asking price
Bloc fees : success fee estimé · jalons
Bloc matching acquéreurs + progression

### Dashboard dossier M&A Buy-side
Bloc critères acquisition + deal breakers
Bloc cibles scorées + pipeline kanban
Bloc fees : honoraires mandat

### Dashboard dossier RH
Bloc fiche de poste + organisation cliente
Bloc pipeline candidats (kanban)
Bloc vivier matching
Bloc fees : success fee placement prévu
KPIs recrutement

### Dashboard organisation
Bloc profil · contacts clés · tags
Bloc financier N/N-1/N-2 (devise native + conversion)
Bloc relations CRM : dossiers · mandats · activités
Bloc RH si client recrutement
Bloc matching si investisseur

### Dashboard statistiques (/protected/statistiques)
Période · deal_type · owner_id filtrables
Revenue cabinet · performance dossiers · métriques par métier
Export CSV/PDF

---

## Connecteurs — architecture extensible

Pattern lib/connectors/[source].ts :
export interface ConnectorRecord {
  external_id: string
  source: string
  data: Record<string, unknown>
}
export async function upsertFromSource(records, source): Promise<void>

Règles : source + external_id · upsert uniquement · enriched_at tracé
Un connecteur qui échoue ne bloque pas le CRM.

### Actifs
Gmail · Google Calendar · Google Drive · Apollo.io · Harmonic · Make
Notion · Canva

### Planifiés
Crunchbase/PitchBook · LinkedIn · Docusign · Slack · Stripe

---

## IA — couche transversale

Matching · Traitement documents · Génération documents
Automatisation communications · Enrichissement données

Règles :
- Appels dans actions/ai/[module].ts
- Résultats dans colonnes dédiées (ai_*)
- L'IA suggère, l'équipe valide
- Modèle : claude-sonnet-4-20250514

---

## Portail client — architecture cible

Parcours : besoin → compte → NDA → upload → analyse IA → dossier CRM
→ suivi → matchmaking

Sécurité : client_id isolation · RLS dédiée · URLs signées · logs accès

Tables : client_accounts · client_submissions · client_documents ·
         client_ndas · client_reports

---

## Enums et référentiels — lib/crm/matching-maps.ts

deal_type : fundraising | ma_sell | ma_buy | cfo_advisor | recruitment
deal_stage : kickoff | preparation | outreach | management meetings | dd |
             negotiation | closing | Post_closing | Ongoing_support | search
deal_status : open | won | lost | paused
mandate_status : draft | active | on_hold | won | lost | closed
base_status : active | to_qualify | inactive
task_status : open | done | cancelled
agenda_event_type : deadline | follow_up | meeting | call | delivery |
                    closing | other
candidate_status : searching | in_process | placed | employed |
                   inactive | blacklisted
fee_milestone_type : retainer | success_fee | fixed | expense
fee_milestone_status : pending | invoiced | paid | cancelled
round_type : seed | pre-series-a | series-a | series-b | growth |
             bridge | convertible
company_stage : startup | pme | eti | grand_groupe
sale_readiness : not_for_sale | open | actively_selling
deal_timing : now | 6months | 1year | 2years+
period_type : annual | quarterly | monthly
rgpd_action : consent_recorded | anonymized | expiry_extended |
              deletion_requested | data_exported
currency : EUR | CHF | USD | GBP
tag_category : réseau | secteur | statut | source | autre
import_source : manual | csv | excel | gdrive | harmonic | crunchbase |
                pitchbook | client_upload | api | portal

Secteurs : Généraliste | SaaS | Fintech | Healthtech | Deeptech |
Industrie | Retail | Energie | Juridique | Transport | Impact | Food |
Immobilier | Edtech | Cybersécurité | Marketplace | Hardware | Autre

Géographies investisseurs + M&A :
france | suisse | dach | ue | europe | amerique_nord | amerique_sud |
asie | moyen_orient | afrique | oceanie | global

Géographies RH :
France : ile_de_france | auvergne_rhone | paca | occitanie |
         nouvelle_aquitaine | bretagne | grand_est | hauts_de_france |
         normandie | bourgogne | pays_de_la_loire | centre_val_loire |
         france_entiere
Suisse : geneve | vaud | zurich | berne | bale | suisse_romande | suisse_entiere
Europe : belgique | luxembourg | allemagne | royaume_uni |
         espagne | italie | pays_bas | europe_entiere
Global : international

Remote RH : onsite | hybrid | remote | flexible
Tickets investisseurs : <500K | 500K-1M | 1M-3M | 3M-10M | 10M-25M | >25M
Stades entreprise : seed | pre-series-a | series-a | series-b | growth
Séniorité RH : junior | mid | senior | lead | director | c-level

---

## État du build

### Livrés ✅
Dashboard · Dossiers CRUD · Contacts CRUD · Organisations CRUD ·
Agenda · Sidebar · RLS toutes tables · Assistant IA · ActivityModal unifié
Matching investisseurs (scoring + pénalité profil incomplet + UI
critères colorés + source matching-maps.ts)
Matching M&A bidirectionnel (deal breakers + score stratégique +
score IA financier + score combiné — actions/ma-matching.ts +
lib/crm/ma-scoring.ts + ma-matching-tab.tsx)
Module dossier : Dirigeant structuré + création organisation inline +
role_in_dossier (v36 — DirigeantSection.tsx + deal-detail.tsx)
Module recrutement : ActionModal types interview/technical_test +
filtre candidate_id sur ActionTimeline + bloc actions sur fiche
candidat (v39)
Auth via middleware.ts Next.js (renommé depuis proxy.ts)
Sync GCal : exclusion propre note/email dans updateAction

### Roadmap 📋

Module RH — M4 à M6 (M1-M3 livrés, M4 matching bidirel. candidats
ouvert en P3)

Données financières — transversal
  Table financial_data unifiée · Import multi-canaux
  Analyse IA documents · Dashboards N/N-1/N-2

Mandats et honoraires
  Tables mandates + fee_milestones · Calcul fees par deal_type
  Dashboard fees cabinet

Données transversales
  Tags · Déduplication · Versioning documents
  Multi-devise · RGPD log · Statistiques cabinet

Portail client

Transversal
  Pipeline kanban · Notifications/rappels automatiques · Export PDF
  Connecteurs Harmonic/Apollo sur organisations investisseurs
  Recherche globale · Enrichissement Pappers/INSEE · Déploiement Vercel

---

## Format de réponse attendu

### Pour un bug
1. Fichiers concernés (après grep + lecture)
2. Cause racine précise
3. Correction minimale
4. Impact sur les autres modules

### Pour une nouvelle fonctionnalité
1. Audit de l'existant
2. Conflits + résolution
3. Migration SQL avec vérification préalable
4. Code complet des fichiers modifiés
5. Test de validation concret

### Pour un nouveau module
1. Audit réutilisable
2. Tables + migrations dans l'ordre
3. Conflits + résolution
4. Architecture fichiers complète
5. Ordre de build avec dépendances
6. Tests de validation par étape

### Toujours
- Diagnostic avant action — jamais de modification aveugle
- Zéro régression sur les modules livrés
- Si conflit → le dire avant de coder
- Si quelque chose est mauvais → le dire et proposer mieux
- Si une décision bloque la vision plateforme → le signaler

## ROADMAP ET BACKLOG — État au 21 avril 2026

### ÉTAT DU PROJET
Version : V39
Zero erreur TypeScript confirmé.
DB de test — sera vidée et reremplie proprement au passage en prod.
Pas de migration SQL sur données existantes requise.

---

### RÉCEMMENT LIVRÉS ✅

#### Module dossier — 3 problèmes fermés (v36)
- Dirigeant structuré : colonnes dirigeant_id (FK contacts) +
  dirigeant_nom/email/telephone/titre. UI complète dans
  components/dossiers/DirigeantSection.tsx (search, create inline,
  edit, display). Server Action updateDealDirigeant.
- Création organisation inline : bouton "Créer cette organisation"
  dans le sélecteur d'org de deal-detail.tsx (lignes ~659-725).
  Préremplit nom depuis la recherche. createOrganisationAction
  puis linkOrganisationToDeal enchaînés.
- role_in_dossier sur deal_organizations (v36) : badge coloré +
  dropdown éditable dans deal-detail.tsx (lignes ~745-753).
  10 rôles (client, banque, repreneur, investisseur, avocat,
  expert-comptable, conseil, cible, acquéreur, autre).

#### Matching M&A bidirectionnel
- actions/ma-matching.ts : getMaBuyerMatches (sell_to_buyer) et
  getMaTargetMatches (buy_to_target)
- lib/crm/ma-scoring.ts : deal breakers + scoring stratégique
  (secteur 30, taille 25, géo 15, profil 20, timing 10) + scoring
  IA financier (croissance, marge, bilan, comparables) + score
  combiné (0.65 strat + 0.35 fin)
- UI : app/protected/dossiers/[id]/ma-matching-tab.tsx

#### Recrutement — liaison actions/candidats (v39)
- Colonne actions.candidate_id + index
- ActionModal : types interview (👥) et technical_test (🧪)
- ActionTimeline : filtre candidate_id + pills interview/test
- Bloc ActionTimeline sur fiche candidat
- Sync GCal : email candidat en attendee automatique

#### Sync GCal — fix note/email
- updateAction ne déclenche plus la sync pour les types hors
  GCAL_SYNC_TYPES (évite création d'events orphelins via le
  fallback update→create de la route sync-event)

#### Auth — middleware Next.js 16
- Renommage proxy.ts → middleware.ts (le framework n'invoque
  que middleware.ts, proxy.ts n'était jamais exécuté)
- getClaims() → getUser() (validation Supabase SSR-safe)
- publicPaths explicites + redirect auth→/protected pour users
  connectés

#### Import financier CSV — TERMINÉ (commits 0f41b4b / 16bf8a9)
- Priorité exact match avant fuzzy matching
- Dédoublonnage colonnes (payroll mappé 4×, revenue 3×)
- 12 colonnes auparavant ignorées

---

### P0 — AVANT TOUTE UTILISATION CLIENT

#### 1. Validation ActionModal (test manuel end-to-end)
Audit statique fait (21/04) : GeoSelect couvre bien les 4 fiches
ciblées · ActionModal supporte 9 types · fix sync GCal livré.
Reste à tester main :
- Création / édition de chaque type d'action en UX réelle
- Vérifier qu'un event GCal est créé sur meeting/call/deadline/task/
  interview/technical_test/document_request, et aucun sur note/email
- Vérifier que la sync prend bien le titre + date/heure + attendees

---

### P1 — PROCHAIN BLOC STRUCTURANT

#### 2. Notifications et rappels automatiques
- reminder_days[] est en base sur la table actions mais jamais
  déclenché
- Implémenter via Vercel Cron (toutes les heures)
- Pour chaque action avec reminder_days et due_date :
  si (due_date - today) IN reminder_days → créer une
  notification in-app (table notifications) + email si activé
- Afficher badge de notification dans la sidebar
- Brique réutilisable pour : alertes RGPD (rgpd_expiry_date),
  alertes fees en retard (fee_milestones.due_date + 30j),
  relances tâches

#### 3. Pipeline kanban dossiers
- Vue kanban par stade en complément de la vue liste
- Colonnes : Kickoff → Préparation → Outreach →
  Management Meetings → DD → Négociation → Closing
- Drag & drop pour changer de stade
- Carte : nom dossier, type, montant cible, prochaine action
- Filtre par type de mission (M&A sell, M&A buy, Fundraising)

#### 4. Connecteurs Harmonic/Apollo sur organisations
- État actuel : Apollo présent uniquement sur enrichissement
  contact (app/api/enrich/contact/route.ts). Aucun lib/connectors/.
  Harmonic absent.
- Construire lib/connectors/apollo.ts et lib/connectors/harmonic.ts
  suivant le pattern ConnectorRecord (source + external_id + upsert)
- Cibler les colonnes investor_* des organisations : sectors[],
  stages[], geographies[], ticket_min/max
- Bouton "Enrichir" sur fiche organisation

---

### P2 — VALEUR AJOUTÉE FORTE

#### 5. Export PDF / Word
- Liste investisseurs avec scores et statuts de contact
- Synthèse dossier (informations clés + données financières)
- Rapport d'avancement client (pipeline + interactions)
- Utiliser la skill docx disponible dans le projet

#### 6. Dashboard amélioré
- Deals par stade avec montants
- Investisseurs contactés par dossier (taux de couverture)
- Taux de conversion par type de mission
- Top 5 dossiers actifs avec prochaine action
- Honoraires pipeline vs encaissé (graphe mensuel)

#### 7. Recherche globale
- Barre de recherche transversale (Cmd+K)
- Résultats : dossiers, organisations, contacts, actions
- Recherche full-text sur nom, description, notes
- Navigation directe vers la fiche

---

### P3 — BACKLOG MOYEN TERME

#### 8. Module RH M4 — Matching bidirectionnel candidats
- Architecture validée, non implémentée
- Scorer candidat → poste ET poste → candidat
- Critères : compétences, séniorité, secteur, géographie,
  prétentions salariales
- Intégrer dans le pipeline RH existant (M3)

#### 9. Enrichissement automatique organisations (légal)
- Intégration Pappers API (données légales françaises)
- Fallback INSEE/SIRENE (gratuit)
- Bouton "Enrichir" sur fiche organisation
- Peupler : SIREN, forme juridique, dirigeant légal,
  CA, effectifs, adresse

---

### PRINCIPES DE DÉVELOPPEMENT — RAPPEL

**Règle absolue** : toujours lire les fichiers existants avant
de proposer quoi que ce soit. Diagnostiquer avant d'implémenter.

**Single source of truth** :
- Secteurs → SECTORS dans matching-maps.ts
- Géographies → GEO_ALL dans matching-maps.ts
- Stages → STAGE_ORDER dans matching-maps.ts
- Parsers → investor-parsers.ts

**Ne jamais supprimer** sans instruction explicite.

**Un commit par correction**, jamais groupés.

**TypeScript strict** :
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "node_modules\|\.next"
Zéro erreur avant tout commit.

**Migrations SQL** : toujours idempotentes.
CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$

Chaque migration supabase_migration_vN.sql doit :
1. Être idempotente (peut être rejouée sans erreur)
2. Se terminer impérativement par :
     INSERT INTO _crm_migrations_applied (version)
       VALUES ('vN') ON CONFLICT (version) DO NOTHING;
3. Être appliquée dans Supabase SQL Editor AVANT tout push

Le script scripts/check-migrations.mjs tourne au prebuild (npm run
build l'exécute en préambule) et échoue si un fichier local n'est
pas enregistré dans la table _crm_migrations_applied. Impossible
de déployer sur Vercel avec une migration non appliquée.

Commande locale : `npm run check:migrations`

**GCal** : toujours isolé par userId.
Jamais de token partagé entre utilisateurs.

**Pas de migration données existantes** : la DB de test
sera vidée et reremplie proprement au passage en prod.
resolveInvestorFields() reste en place jusqu'à cette date.

