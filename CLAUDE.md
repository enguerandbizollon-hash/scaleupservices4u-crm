# CLAUDE.md : VF Tool (Vectis Finance)
# Source de vérité. Réécrit intégralement le 2026-08-01 (l'ancien décrivait
# des métiers supprimés et un état du build d'avril).

---

## Identité et vision

VF Tool est l'arme interne d'Enguérand Bizollon, consultant M&A
indépendant (Vectis Finance). Un seul utilisateur pilote. L'outil n'est
pas un produit générique et ne sera jamais commercialisé.

Ambition : devenir la référence banque d'affaires des petites
structures, moins de 4 M€ de CA, à l'échelle NATIONALE, en
industrialisant chaque maillon. Segment délaissé par les banques
d'affaires classiques : économique seulement si l'automatisation est
maximale et très fiable.

Principe produit non négociable : **l'outil PROPOSE, Enguérand
DISPOSE**. Des listes scorées, des brouillons Gmail, des notifications :
jamais d'envoi automatique, jamais d'action sortante autonome. Rien ne
sort de l'outil sans son geste.

### Vision client (arbitrée le 2026-08-01)

Pas de libre-service public : personne ne vient « déposer son doc et
repartir avec un teaser ». En revanche, à terme, les clients SOUS
MANDAT auront un espace fermé : y joindre leurs données financières,
comptables et commerciales, uploader leurs pièces (la dataroom se
constitue toute seule, maillon 5), et suivre leur dossier. Enguérand
contrôle tout ce qui est partagé : le client voit ce que le cabinet
décide de montrer, rien d'autre. Toute décision d'architecture doit
rester extensible vers cet espace (isolation par client + RLS dédiée)
sans jamais l'anticiper au détriment du cœur interne.

Les métiers historiques (fundraising, RH, CFO advisory) sont MORTS.
Toute trace résiduelle (colonnes investor_*, stades RH) est de
l'héritage à ne pas réactiver : les colonnes restent en base, l'UI n'en
parle plus. Nom historique du repo : scaleupservices4u-crm.

---

## La chaîne de valeur : 7 maillons

C'est LA carte d'usage (pipeline métier décrit le 2026-07-30). Chaque
développement doit se rattacher à un maillon.

1. **Détecter les cédants** : chasses composables (API Recherche
   d'Entreprises), univers dédupliqué par SIREN, 6 sources de signaux
   (BODACC 7 types, RGE, Fusacq, France Travail, veille), radar de
   cédabilité déterministe (`lib/crm/cedabilite.ts`), enrichissement
   Pappers, synthèse 360 IA. Sources à venir : bourses de cession
   désanonymisées, holdings patrimoniales, harvest score, presse
   régionale, décès INSEE, INPI.
2. **Qualifier** : revue du matin (`app/protected/page.tsx`), tri radar,
   fiche 360 (drawer), 7 statuts du funnel cédant (nouveau, à approcher,
   approché, échange, dormant avec réveil automatique, écarté, promu),
   triage par lot. À venir : multi-radar (cédant / consolidateur /
   croissance), backtest du barème.
3. **Approcher le cédant** : promotion dirigeant vers contact,
   enrichissement coordonnées (Hunter puis Apollo), notes d'approche,
   dormance avec date de réveil.
4. **Gagner le mandat** : deals avec cadre honoraires complet (retainer,
   success fee, jalons, trigger de recalcul).
5. **Constituer le dossier** : création en un geste depuis l'univers,
   screening auto-rempli par IA (échec notifié), teaser industrialisé
   (`lib/ai/teaser-engine.ts`, anonymisé par code), documents
   (`ma_documents` + Storage privé). À venir : IM, checklist de pièces,
   puis dépôt de pièces par le client sous mandat (vision client).
6. **Vendre le mandat (matchmaking)** : grille de scoring acquéreurs
   (`lib/crm/acquirer-scoring.ts` : capacité 25, secteur 20, opération
   20, appétit 15, géo 10, structure 10), onglet Acquéreurs adressable
   (`?tab=acquereurs`), page `/protected/acquereurs`, base peuplée par
   3 gestes (Marquer acquéreur depuis l'univers, approbation de
   suggestion, création manuelle). En construction (plan R1) : funnel
   d'approche teaser → NDA → IM → offre, relances J+N, brouillons Gmail,
   score d'intention. Sens inverse (buy-side) : legacy, à reconstruire.
7. **Piloter** : revue du matin, statistiques, notifications, cron_runs.

Le plan de construction détaillé (R0 à R5) vit dans la mémoire projet
et le fichier de plan approuvé le 2026-08-01. Ordre : réparations,
CLAUDE.md, funnel acquéreur, sources, multi-radar et backtest, IM et
dataroom, finitions.

---

## Stack et architecture

- Next.js 16 App Router, TypeScript STRICT (zéro `any`, zéro erreur tsc)
- Supabase : Auth + PostgreSQL + RLS + Storage
- Server Actions pour tout CRUD ; routes API réservées aux crons,
  webhooks/OAuth et flux techniques
- Vercel : déploiement + crons (`vercel.json`)
- Un seul utilisateur réel mais `user_id` sur TOUTES les tables, RLS
  partout : `auth.uid() = user_id`
- Auth : middleware Supabase (`proxy.ts` à la racine qui délègue à
  `lib/supabase/proxy.ts`). NextAuth a été supprimé (2026-08-01).
- OAuth Google : UN SEUL flux, `/api/gcal` (4 scopes explicites :
  calendar.events, drive.readonly, gmail.readonly, gmail.compose),
  tokens dans `user_settings`, refresh via
  `lib/gcal/gcal-client.ts:getValidToken` (passer le client admin en
  contexte cron)

### Structure des fichiers (réelle)

- `lib/crm/*` : logique métier pure et testable (cedabilite,
  acquirer-scoring, health-score, labels, matching-maps, notifications,
  cron-runs, univers-ingest, cedabilite-ingest, fee-calculator)
- `lib/connectors/*` : un fichier par source (bodacc, rge, fusacq,
  france-travail, recherche-entreprises, pappers, apollo, gmail-ingest)
- `lib/ai/*` : moteurs IA (anthropic.ts = client central, teaser-engine,
  brief-engine, prospect-brief, email-classifier)
- `lib/gmail/`, `lib/gcal/` : clients Google
- `actions/*.ts` : Server Actions par module (prospection, deals,
  organisations, contacts, suggestions, ma-matching, livrables, fees,
  signaux, gmail-ingest, screening)
- `app/protected/*` : pages (prospection, signaux, dossiers, acquereurs,
  taches, agenda, inbox, organisations, contacts, statistiques, import,
  connecteurs, ia) ; accueil = revue du matin
- `app/api/cron/*` : bodacc-ingest (quotidien 05:30), veille-profils
  (04:30 lun-ven), notifications (horaire, 4 jobs + relances à venir),
  gmail-sync (4 fois/jour lun-ven) ; tous tracés dans `cron_runs`,
  auth `Bearer CRON_SECRET`, client admin
- `components/[module]/` : composants UI
- `tests/` : vitest (282+ tests), lancés au prebuild

### Tables clés

- `univers_entreprises` (pivot SIREN) : la prospection. finances jsonb,
  dirigeants jsonb, actionnariat (v68), cedabilite_score + raisons,
  statut, dormant_until (v72), synthese (v69)
- `signaux` : UNIQUE(source, external_id), pivot SIREN, read_at
- `organizations` : annuaire + profil acquéreur (v67 : operation_types,
  deal_stance, acquirer_summary + fourchettes v36) ; familles acquéreurs
  = ACQUIRER_BUYER_TYPES (buyer, corporate, investor, business_angel,
  family_office)
- `deals` : LE dossier-mandat (fusion mandats v65 : honoraires portés
  par le deal), screening (v53), teaser_content (v70), deal_context (v67)
- `deal_target_suggestions` (v56) : le funnel acquéreur (5 statuts
  décision + colonnes d'étape datées à venir en v73)
- `contacts`, `organization_contacts` (liaison), `actions` (table
  unifiée tâches/activités/emails), `ma_documents` (+ Storage
  `deal-documents`), `fee_milestones`, `notifications` (dédup par index
  unique), `cron_runs`, `user_settings` (tokens Google)

---

## Principes de construction : non négociables

### L'outil est UN organisme, pas une collection d'écrans

Directive d'Enguérand (2026-08-01) : « il faut mettre en harmonie tous
nos outils, qu'ils s'imbriquent, fonctionnent ensemble et soient
performants ». Concrètement :
- Chaque brique NOURRIT la suivante : signaux → radar → fiche 360 →
  promotion → mandat → matching → funnel → relances → revue du matin.
  Un développement qui ne se raccorde pas à ce flux doit être justifié.
- Navigation dans les DEUX sens : si A pointe vers B, B doit pouvoir
  revenir vers A (ex. fiche organisation → fiche 360 prospection).
- Un chiffre affiché est TOUJOURS un lien vers la liste exacte qu'il
  compte (leçon des KPI menteurs, audit 2026-07-31). Jamais de chiffre
  mort.
- Performance : index sur toute colonne de filtre fréquent, requêtes
  batchées (pattern batch 500), jamais de requête dans une boucle,
  `revalidatePath` sur toutes les pages qui lisent ce qu'une action
  écrit, pas de recalcul coûteux à l'affichage quand il peut être
  persisté.

### Partir de l'existant, sans exception

Avant tout nouveau champ, table ou composant : vérifier la base
(migrations), grep le code, réutiliser les référentiels et patterns en
place. Ne JAMAIS créer de doublon. Un travail nouveau ne met jamais en
échec le travail précédent ; si conflit, le dire AVANT de coder et
rendre l'existant compatible d'abord.

### Sources uniques de vérité (import obligatoire, jamais de copie)

- Libellés : `lib/crm/labels.ts` (types d'organisation, types de
  dossier ma_sell = « Cession » / ma_buy = « Acquisition », rôles dans
  le dossier, un seul mot pour l'acheteur : « Acquéreur »)
- Référentiels métier : `lib/crm/matching-maps.ts` (secteurs, géos,
  stades, DEAL_CONTEXTS, OPERATION_TYPES, DEAL_STANCES, statuts et
  rôles de suggestion)
- Signaux : `components/prospection/statut-meta.ts` (STATUT_META,
  SIGNAL_TYPE_LABELS)
- Familles acquéreurs : `ACQUIRER_BUYER_TYPES` dans
  `lib/crm/acquirer-scoring.ts`
- Scores : déterministes et AUDITABLES (chaque point justifié dans un
  tableau `raisons` affiché tel quel). L'IA génère du narratif, jamais
  un score opaque.

### Sourcing : des sources simultanées et complémentaires

Chaque source apporte un signal qu'elle est seule à voir. Elles ne se
superposent jamais : dédup UNIQUE(source, external_id), croisement par
SIREN, le radar fusionne. Toute nouvelle source suit ce contrat.

### IA

- Client central `lib/ai/anthropic.ts` (callClaude/callClaudeRaw),
  jamais de fetch Anthropic direct ni de modèle codé en dur
- Tiers : smart (défaut claude-sonnet-5, override ANTHROPIC_MODEL) et
  fast pour la classification de masse (défaut claude-haiku-4-5,
  override ANTHROPIC_MODEL_FAST)
- Travail long en `after()` avec RE-LECTURE avant écriture (ne jamais
  écraser ce que l'utilisateur a tapé pendant la génération) et ÉCHEC
  NOTIFIÉ par la cloche (jamais un console.error muet)

---

## Conventions strictes

### Qualité avant chaque commit

- `npx tsc --noEmit` : zéro erreur (lancer depuis le dossier du repo,
  PAS le dossier parent qui porte le même nom)
- `npx vitest run` : tout vert
- Un commit par correction, jamais groupés ; messages en français
- PIÈGE PowerShell : `[id]` dans un chemin est un JOKER. Utiliser
  `-LiteralPath` pour tout chemin contenant des crochets, et
  `':(literal)...'` pour les pathspecs git.

### Migrations SQL

- Fichiers `supabase_migration_vN.sql`, idempotents (IF NOT EXISTS,
  DO $$ ... EXCEPTION), BEGIN/COMMIT, et se terminent par
  `INSERT INTO _crm_migrations_applied (version) VALUES ('vN')
  ON CONFLICT DO NOTHING;`
- Enguérand les applique LUI-MÊME dans Supabase SQL Editor AVANT tout
  push ; `scripts/check-migrations.mjs` tourne au prebuild et bloque
  sinon (`npm run check:migrations` en local)
- Dernière appliquée : v72. Prochaine libre : v73 (funnel acquéreur).
- Jamais de valeur en dur qui contredit un CHECK SQL : vérifier la
  contrainte dans le fichier de migration avant d'insérer (leçon
  dts_source_check).

### Sécurité et périmètre

- `git push` : JAMAIS. Enguérand pousse lui-même.
- `.env.local` est SA zone : lire localement si besoin, ne JAMAIS
  afficher une valeur (ni en clair, ni tronquée), ne jamais lui
  redemander un état qu'il a déjà donné.
- Aucune donnée sensible dans URLs, logs, messages d'erreur.
- RLS sur toute nouvelle table, pattern uniforme
  `auth.uid() = user_id`. Les futures tables du portail client sous
  mandat seront isolées par client avec une RLS dédiée.
- GCal/Gmail isolés par userId, jamais de token partagé.

### Textes affichés (règles Enguérand)

- JAMAIS de tiret cadratin, remplacer par virgule, deux-points ou point
- « Vectis Finance » toujours complet, jamais « Vectis » seul
- Ton sobre et direct, pas de superlatifs gratuits
- Vocabulaire métier : mandat, cédant, acquéreur, cession, acquisition
  (le franglais M&A Sell/Buy est banni de l'UI)

---

## État du build (2026-08-01)

### Vivant et vérifié
Univers + chasses + 6 sources de signaux + radar auditable + veilles
quotidiennes tracées ; funnel cédant 7 statuts avec réveil automatique ;
revue du matin ; mandats avec honoraires, screening IA, teaser,
documents ; matching acquéreurs (grille + onglet adressable + page
Acquéreurs + 3 gestes de peuplement) ; ingestion Gmail + boîte de tri ;
notifications dédupliquées ; 282 tests.

### En construction (plan R1)
Funnel d'approche acquéreur : v73 (colonnes d'étape datées +
`deal_suggestion_events`), brouillons Gmail (gmail.compose accordé via
reconnexion), relances J+N (Job 5 du cron notifications), score
d'intention v1, IM (v74, pattern teaser-engine).

### Dettes connues (assumées, planifiées)
Recherche globale sans l'univers ; double recherche (sidebar + Cmd+K) ;
kanban à simplifier ; agenda vieux monde (1436 lignes client) ; stades
RH résiduels dans matching-maps ; « radar » encore 2 sens à l'écran ;
buy-side legacy. Côté Enguérand : push de la branche, clés
APOLLO/HUNTER, compte INPI, reconnexion Google (nouveaux scopes).

---

## Format de réponse attendu

### Pour un bug
1. Fichiers concernés (après grep + lecture)
2. Cause racine précise
3. Correction minimale
4. Impact sur les autres modules

### Pour une fonctionnalité
1. Audit de l'existant (réutiliser avant de créer)
2. Conflits et résolution
3. Migration SQL idempotente si besoin (avec garde CHECK)
4. Code complet, tests ajoutés
5. Raccordement au flux (qui nourrit quoi, liens dans les deux sens)

### Toujours
- Diagnostic avant action, jamais de modification aveugle
- Zéro régression sur les modules livrés
- État des lieux après modification : fait, reste à faire, effets de bord
- Si quelque chose est mauvais, le dire et proposer mieux
- Ce que l'écran MONTRE doit correspondre à ce qui est raconté : après
  chaque lot, vérifier le parcours réel sur localhost:3000
