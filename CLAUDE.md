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
lib/ai/financial-scoring.ts     → notation IA financière
lib/ai/document-extraction.ts   → extraction données documents
lib/connectors/[source].ts      → interface par connecteur
actions/[module].ts             → Server Actions CRUD
actions/ai/[module].ts          → Server Actions IA
actions/matching.ts             → matching investisseurs
actions/ma-matching.ts          → matching M&A
actions/recruitment-matching.ts → matching RH
components/[module]/            → composants UI par module

---

## Données financières — modèle central

Les données financières sont au cœur des modules M&A et Fundraising.
Elles alimentent les dashboards, le matching et la notation IA.
Elles peuvent provenir de plusieurs canaux en parallèle.

### Canaux d'import (tous actifs simultanément)

**Manuel** : saisie directe dans la fiche dossier ou organisation
**Import CSV/Excel** : upload fichier → parsing → mapping champs → upsert
**Connecteurs** : Harmonic, Crunchbase, PitchBook → enrichissement auto
**Portail client** : upload documents (bilan, P&L, BP) → extraction IA
**API externe** : endpoint dédié pour intégrations futures

### Table : financial_data (données financières historiques)
- id (uuid PK)
- user_id (uuid)
- deal_id (uuid FK deals, nullable)
- organization_id (uuid FK organisations, nullable)
- fiscal_year (integer NOT NULL) — exercice : 2022, 2023, 2024
- revenue (numeric) — chiffre d'affaires
- ebitda (numeric) — EBITDA
- ebit (numeric) — résultat opérationnel
- net_income (numeric) — résultat net
- gross_margin (numeric) — marge brute %
- ebitda_margin (numeric) — marge EBITDA %
- total_assets (numeric) — total bilan
- net_debt (numeric) — dette nette
- equity (numeric) — capitaux propres
- headcount (integer) — effectif
- arr (numeric) — ARR (SaaS / fundraising)
- mrr (numeric) — MRR
- nrr (numeric) — Net Revenue Retention %
- cagr (numeric) — croissance annuelle %
- churn_rate (numeric) — taux de churn %
- ev_estimate (numeric) — valorisation estimée
- ev_multiple (numeric) — multiple EV/EBITDA ou EV/ARR
- source (text) — manual | csv | harmonic | crunchbase | pitchbook |
                   client_upload | api
- raw_data (jsonb) — données brutes source
- ai_extracted (boolean default false)
- ai_confidence_score (numeric) — fiabilité extraction IA
- created_at (timestamptz)
- updated_at (timestamptz)

RLS : auth.uid() = user_id.
Index sur (deal_id, fiscal_year), (organization_id, fiscal_year).

### Règle affichage historique
Toujours afficher N, N-1, N-2 en dashboard dossier.
N = dernier exercice disponible (pas nécessairement l'année en cours).
Calcul automatique des variations N vs N-1, N-1 vs N-2.

---

## Dashboards — spécifications par type

### Dashboard général (app/protected/dashboard)

KPIs globaux :
- Dossiers actifs par type (fundraising / ma_sell / ma_buy / recruitment)
- Pipeline par stade (Sankey ou barres empilées)
- Chiffre d'affaires potentiel des mandats actifs
- Tâches en retard (rouge) + à relancer cette semaine (orange)
- Prochains entretiens (module RH)
- Dernières activités (fil chronologique)
- Top 5 dossiers par priorité

Widgets par métier (filtrables) :
- Fundraising : ARR moyen des dossiers · rounds en cours · closings proches
- M&A : dossiers par stade · deals signés YTD · valorisations moyennes
- RH : candidats en process · placements YTD · taux de conversion

### Dashboard dossier Fundraising (deal_type = fundraising)

Bloc données entreprise :
- ARR · MRR · NRR · CAGR — affichage N / N-1 / N-2 côte à côte
- Variation colorée (vert si hausse, rouge si baisse)
- Montant recherché · valorisation cible · runway

Bloc pipeline investisseurs :
- Entonnoir : approchés → intéressés → NDA → meeting → term sheet → closing
- Tableau investisseurs avec statut contact et score matching
- Prochaines relances (date + contact)

Bloc matching :
- Top investisseurs matchés (score ≥ 70)
- Investisseurs à approcher (score 40-70, non contactés)
- Investisseurs incompatibles (score < 40 ou deal breaker)

Bloc activités :
- Fil chronologique des interactions
- Prochaine action recommandée

### Dashboard dossier M&A Sell-side (deal_type = ma_sell)

Bloc données cédant :
- CA / EBITDA / marge / dette nette — N / N-1 / N-2
- Effectif · géographie · secteur
- Valorisation indicative IA (fourchette basse / haute)
- Score financier IA (jauge 0-100)
- Asking price vs valorisation indicative

Bloc matching acquéreurs :
- Top acquéreurs potentiels triés par combined_score
- Deal breakers identifiés (badge rouge)
- Statut contact par acquéreur

Bloc progression dossier :
- Stade actuel du pipeline · probabilité de closing
- Documents présents / manquants (teaser · NDA · IM · dataroom)
- Prochaine action

### Dashboard dossier M&A Buy-side (deal_type = ma_buy)

Bloc critères acquisition :
- Secteurs cibles · géographies · fourchette taille · budget
- Critères exclusifs (deal breakers configurés)
- Rationale stratégique

Bloc cibles identifiées :
- Liste cibles scorées (BDD interne + connecteurs)
- Source par cible (badge : interne / Harmonic / Crunchbase / portail)
- Score stratégique + score financier + combined_score
- Statut approche (identifiée → approchée → NDA → discussions → offre)

Bloc pipeline cibles :
- Kanban des cibles par stade d'approche
- Prochaines actions

### Dashboard dossier RH (deal_type = recruitment)

Bloc fiche de poste :
- Intitulé · séniorité · localisation · remote · rémunération cible
- Compétences requises (liste)
- Stades pipeline configurés

Bloc pipeline candidats :
- Kanban par stage (Sourcing → Approche → Entretien RH →
  Entretien client → Offre → Closing)
- Score moyen des candidats actifs
- Top 3 candidats par combined_score

Bloc vivier matching :
- Candidats du vivier compatibles (getMatchingDeals)
- Score par critère · statut disponibilité

KPIs recrutement :
- Nb candidats par stade · taux de conversion
- Temps moyen par stade · source la plus efficace

### Dashboard organisation (fiche organisation)

Bloc profil :
- Type · statut · localisation · secteur
- Contacts clés (avec email/tel direct)

Bloc financier (si données disponibles) :
- Tableau N / N-1 / N-2 : CA · EBITDA · marge · effectif
- Source des données (badge)
- Dernière mise à jour

Bloc relations CRM :
- Dossiers liés (deals actifs et historiques)
- Candidats liés (module RH)
- Dernières activités

Bloc matching (si investisseur) :
- Dossiers fundraising compatibles et scores

---

## Données financières Fundraising — champs spécifiques

La levée de fonds nécessite des métriques SaaS / croissance spécifiques
en plus des données financières générales.

Colonnes supplémentaires sur deals (deal_type = fundraising) :
- target_raise_amount (numeric) — montant recherché
- pre_money_valuation (numeric) — valorisation pre-money cible
- post_money_valuation (numeric) — valorisation post-money
- use_of_funds (text) — utilisation des fonds
- runway_months (integer) — runway actuel en mois
- current_investors (text[]) — investisseurs actuels
- round_type (text) — seed | pre-series-a | series-a | series-b | growth |
                       bridge | convertible

Métriques SaaS (dans financial_data pour l'année en cours) :
ARR · MRR · NRR · CAGR · churn_rate · LTV · CAC · LTV_CAC_ratio

---

## Données financières M&A — champs spécifiques

Colonnes sell-side (deal_type = ma_sell) :
- asking_price_min / asking_price_max (numeric)
- partial_sale_ok (boolean default true)
- management_retention (boolean)
- deal_timing (text) — now | 6months | 1year | 2years+
- ai_financial_score (numeric) — notation IA 0-100
- ai_valuation_low / ai_valuation_high (numeric)
- ai_financial_notes (text)
- ai_analyzed_at (timestamptz)

Colonnes buy-side (deal_type = ma_buy) :
- target_sectors (text[])
- target_geographies (text[])
- target_revenue_min / max (numeric)
- target_ev_min / max (numeric)
- target_stage (text[])
- acquisition_budget_min / max (numeric)
- full_acquisition_required (boolean default false)
- strategic_rationale (text)
- excluded_sectors (text[]) — deal breaker éliminatoire
- excluded_geographies (text[])
- target_timing (text)

---

## Matching M&A — algorithme

### Deal breakers éliminatoires (score = 0 immédiat)
- Secteur dans excluded_sectors
- Taille revenue hors fourchette × 0.5 / × 2
- full_acquisition_required = true ET org.partial_sale_ok = false

### Scoring stratégique (100pts, pondération dynamique)
Secteur          30pts — exact / adjacent / aucun
Taille           25pts — dans fourchette / ±30% / hors
Géographie       15pts — exact / compatible / incompatible (GEO_COMPATIBILITY)
Profil stratég.  20pts — similarité sémantique IA (Claude API)
Timing           10pts — now+actively_selling / open / incompatible

### Score IA financier (séparé 0-100)
Croissance CA 3 ans   25pts
Marge EBITDA          25pts
Structure bilan       25pts
Comparables secteur   25pts
Input : financial_data N/N-1/N-2 + documents uploadés

### Score combiné
combined_score = strategic_score × 0.65 + financial_score × 0.35
Si financial_score absent → combined_score = strategic_score

### Direction matching
sell_to_buyer : dossier ma_sell → organisations type Repreneur / ma_buy
buy_to_target : dossier ma_buy → organisations type Cible M&A

### Matching proactif (sans mandat actif)
Un acquéreur dans la base peut être matché sur toutes les cibles connues.
Une cible peut être proposée à des acquéreurs sans qu'elle soit mandante.
C'est l'outil de croissance externe proactive de ScaleUp.

---

## Matching Fundraising — algorithme

Fonction : getInvestorMatches(dealId)
Scope : TOUTES les organisations investisseurs (base_status IN active/to_qualify)
Pas de filtre FK vers le dossier.

### Scoring (100pts, pondération dynamique)
Ticket          30pts — dans fourchette / adjacent / hors
Secteur         30pts — exact / Généraliste=100 / aucun
Stade           25pts — STAGE_MAP compatible / adjacent / incompatible
Géographie      15pts — GEO_COMPATIBILITY exact / compatible / incompatible

### Règles spéciales
- Généraliste = score secteur 100 automatiquement
- Critères null → ignorés, poids redistribués
- Profil < 3 critères renseignés → pénalité × (critères/4)
- Affichage : texte critères colorés (vert/orange/rouge/gris), pas de barres

---

## Matching RH — algorithme

### Scoring candidat vs poste (100pts, pondération dynamique)
Compétences req.   35pts — match normalisé lowercase + pondération weight
Séniorité          15pts — SENIORITY_MAP exact/adjacent/incompatible
Rémunération       20pts — dans fourchette / ±20% / hors
Géographie         15pts — RH_GEO_COMPATIBILITY exact/compatible
Remote             10pts — REMOTE_COMPATIBILITY exact/compatible
Entretiens         bonus — moyenne scores × 2 + go sur dernier (+5pts)

### Matching bidirectionnel
Dossier → vivier : getCandidateRanking(dealId)
Candidat → dossiers : getMatchingDeals(candidateId)

### Deal breakers RH
Compétence is_mandatory absente → éliminatoire sur ce critère

---

## Module RH — architecture 6 modules séquentiels

### M1 — BDD + Vivier candidats
Tables :
candidates               → vivier global, statut global, CV, LinkedIn
candidate_status_log     → immuable (INSERT uniquement), note obligatoire
candidate_jobs           → historique postes + organisations
deal_candidates          → pivot dossier ↔ candidat, stage, score, confid.
candidate_stages         → pipeline personnalisable par dossier
candidate_interviews     → feedback, score, recommandation, confidentialité
candidate_skills         → compétences scorées, internal vs shareable
deal_required_skills     → compétences requises par poste

### Statuts candidat (candidate_status)
searching    → En recherche active  (vert)
in_process   → En process           (bleu)
placed       → Placé                (purple)
employed     → En poste             (amber)
inactive     → Inactif              (gris)
blacklisted  → Blacklisté           (rouge)

Règle : changement de statut = note obligatoire + log immuable (INSERT)

### Confidentialité
notes_internal    → jamais dans exports ou rapports client
notes_shareable   → peuvent figurer dans rapport client
is_confidential   → visible internes uniquement

### Triggers M5
Candidat Placé → deal closing/won automatique
Deal won → autres candidats du dossier → statut à revoir
Entretien créé → activité auto dans agenda
Alerte réactivation si Placé depuis 18+ mois sans interaction
Fee de placement → deal.value_amount mis à jour

### M6 — Export rapport client
Contenu : skills scorées (shareable uniquement) · entretiens (non confid.)
Format : PDF via Supabase Storage · lien partageable temporaire

---

## Documents financiers — table ma_documents

- id (uuid PK)
- user_id (uuid)
- deal_id (uuid FK, nullable)
- organization_id (uuid FK, nullable)
- document_type (text) — bilan | pl | business_plan | organigramme |
                          teaser | nda | im | dataroom | autre
- file_url (text) — Supabase Storage
- fiscal_year (integer)
- ai_extracted_data (jsonb) — métriques extraites
- ai_processed_at (timestamptz)
- ai_confidence_score (numeric)
- is_confidential (boolean default true)
- source (text) — internal | client_upload | connector
- created_at (timestamptz)

---

## Connecteurs — architecture extensible

Pattern uniforme lib/connectors/[source].ts :
export interface ConnectorRecord {
  external_id: string
  source: string
  data: Record<string, unknown>
}
export async function upsertFromSource(
  records: ConnectorRecord[], source: string
): Promise<void>

Règles :
- Chaque enregistrement porte source + external_id
- Upsert uniquement — jamais de duplication
- Champs enrichis : enriched_at, enriched_by_source
- Un connecteur qui échoue ne bloque pas le reste du CRM

### Connecteurs actifs
Gmail            → relances, drafts, suivi emails
Google Calendar  → agenda, entretiens
Apollo.io        → enrichissement contacts + candidats
Harmonic         → enrichissement organisations + données financières
Make             → automatisations workflows
Notion           → documentation
Canva            → génération documents

### Connecteurs planifiés
Crunchbase / PitchBook → données financières M&A
LinkedIn               → profils candidats RH
Docusign               → NDA, mandats, signatures
Slack                  → notifications équipe
Stripe                 → facturation honoraires

---

## Enums et référentiels — lib/crm/matching-maps.ts

Source de vérité unique. Jamais hardcodé ailleurs.

### deal_type
fundraising | ma_sell | ma_buy | cfo_advisor | recruitment

### deal_stage
kickoff | preparation | outreach | management meetings | dd |
negotiation | closing | Post_closing | Ongoing_support | search

### deal_status
open | won | lost | paused

### base_status (organisations)
active | to_qualify | inactive

### task_status
open | done | cancelled

### agenda_event_type
deadline | follow_up | meeting | call | delivery | closing | other

### candidate_status
searching | in_process | placed | employed | inactive | blacklisted

### round_type (fundraising)
seed | pre-series-a | series-a | series-b | growth | bridge | convertible

### company_stage (M&A)
startup | pme | eti | grand_groupe

### sale_readiness (M&A)
not_for_sale | open | actively_selling

### deal_timing
now | 6months | 1year | 2years+

### Secteurs (partagés organisations + deals + RH + M&A)
Généraliste | SaaS | Fintech | Healthtech | Deeptech | Industrie |
Retail | Energie | Juridique | Transport | Impact | Food |
Immobilier | Edtech | Cybersécurité | Marketplace | Hardware | Autre

### Géographies investisseurs + M&A
france | suisse | dach | ue | europe |
amerique_nord | amerique_sud | asie | moyen_orient | afrique | oceanie | global

### Géographies RH
France : ile_de_france | auvergne_rhone | paca | occitanie |
         nouvelle_aquitaine | bretagne | grand_est | hauts_de_france |
         normandie | bourgogne | pays_de_la_loire | centre_val_loire |
         france_entiere
Suisse : geneve | vaud | zurich | berne | bale | suisse_romande | suisse_entiere
Europe : belgique | luxembourg | allemagne | royaume_uni |
         espagne | italie | pays_bas | europe_entiere
Global : international

### Remote (RH)
onsite | hybrid | remote | flexible

### Tickets investisseurs
<500K | 500K-1M | 1M-3M | 3M-10M | 10M-25M | >25M

### Stades entreprise (fundraising)
seed | pre-series-a | series-a | series-b | growth

### Séniorité (RH)
junior | mid | senior | lead | director | c-level

---

## IA — couche transversale

### Fonctions actives ou planifiées

Matching algorithmique
  Investisseurs ↔ fundraising (en cours de fix)
  Candidats ↔ postes RH bidirectionnel (M4)
  Acquéreurs ↔ cédants M&A (futur)
  Cibles ↔ acquéreurs buy-side (futur)

Traitement documents financiers
  Extraction automatique depuis bilans, P&L, BP uploadés
  Calcul financial_score (0-100) + valorisation indicative
  Comparables sectoriels via données connecteurs
  Persistance dans financial_data + ai_financial_notes

Génération documents
  NDA / clause de confidentialité automatique
  Rapport investisseur (matching + profil entreprise)
  Rapport candidat RH (scoring + fiche partageable)
  Teaser / one-pager pré-rempli depuis données dossier

Automatisation communications
  Drafts emails relance selon stade pipeline
  Suggestions prochaine action sur deal inactif
  Alertes réactivation candidats (18-24 mois)
  Séquences de relance planifiées

Enrichissement données
  Apollo.io → contacts + candidats
  Harmonic → organisations + financiers
  Key people search sur cibles M&A

### Règles IA
- Appels IA dans actions/ai/[module].ts
- Résultats IA dans colonnes dédiées (ai_score, ai_notes, ai_data)
  jamais dans les colonnes métier
- L'IA suggère, l'équipe valide — pas d'action automatique irréversible
- Modèle : claude-sonnet-4-20250514

---

## Portail client — architecture cible

### Parcours
1. Client décrit son besoin sur le site (fundraising / M&A / RH)
2. Création compte sécurisé
3. Signature NDA généré automatiquement
4. Upload documents (bilan, BP, organigramme, etc.)
5. Extraction IA + création dossier dans le CRM
6. Équipe notifiée + prise en charge
7. Client suit l'avancement depuis son espace
8. Matchmaking proposé selon le besoin

### Sécurité portail
- Isolation stricte client_id — un client ne voit jamais un autre client
- RLS dédiée portail (séparée de la RLS interne)
- Documents via URLs signées temporaires (Supabase Storage)
- NDA obligatoire avant accès aux fonctionnalités sensibles
- Logs d'accès sur toutes les consultations de documents

### Tables portail
client_accounts    → comptes clients externes
client_submissions → formulaires de besoin
client_documents   → documents uploadés
client_ndas        → NDA générés et signés
client_reports     → livrables partagés avec le client

---

## État du build

### Livrés ✅
Dashboard · Dossiers CRUD · Contacts CRUD · Organisations CRUD ·
Agenda · Sidebar · RLS toutes tables · Assistant IA · ActivityModal unifié

### En cours de fix 🔧
Matching investisseurs :
  Score artificiellement élevé → pénalité profil incomplet
  Affichage barres → texte critères colorés vert/orange/rouge/gris
  Scope requête → toutes organisations investisseurs
  Source de vérité → matching-maps.ts

### Roadmap 📋

Immédiat
  Fix matching investisseurs (prompt disponible)
  Harmonisation formulaires organisations

Module RH (6 modules séquentiels M1→M6)
  M1 BDD + Vivier · M2 Fiche 360° · M3 Pipeline kanban
  M4 Scoring + matching bidirel. · M5 Connexions CRM
  M6 Export + Stats

Données financières (transversal M&A + Fundraising)
  Table financial_data avec historique N/N-1/N-2
  Import multi-canaux (manuel / CSV / connecteurs / portail / IA)
  Dashboards financiers par type de dossier
  Notation IA + valorisation indicative

Module M&A matching (après RH)
  Deal breakers : secteur exclu · taille · reprise partielle
  Scoring stratégique 5 critères + scoring IA financier séparé
  Matching bidirectionnel sell↔buy
  Matching proactif (croissance externe sans mandat)
  Sources : BDD interne + Harmonic + Crunchbase + PitchBook + portail

Portail client
  Espace client public · upload documents · NDA auto · suivi dossier

Transversal
  Import CSV global · Recherche/filtre global
  Automatisation relances · Déploiement Vercel
  Statistiques globales

---

## Format de réponse attendu

### Pour un bug
1. Fichiers concernés (après grep + lecture)
2. Cause racine précise
3. Correction minimale — ne toucher que le nécessaire
4. Impact sur les autres modules

### Pour une nouvelle fonctionnalité
1. Audit de l'existant (colonnes, composants, actions présents)
2. Conflits avec l'existant + résolution proposée
3. Migration SQL avec vérification préalable (information_schema)
4. Code complet des fichiers créés ou modifiés
5. Test de validation concret

### Pour un nouveau module
1. Audit de l'existant réutilisable
2. Tables manquantes + migrations dans l'ordre
3. Conflits + résolution
4. Architecture fichiers complète
5. Ordre de build avec dépendances
6. Tests de validation par étape

### Toujours
- Diagnostic avant action — jamais de modification aveugle
- Zéro régression sur les modules livrés
- Si conflit détecté → le dire avant de coder
- Si quelque chose est mauvais → le dire et proposer mieux
- Si une décision peut bloquer la vision plateforme → le signaler