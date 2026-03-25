# CRM Context — ScaleUp Services 4U

## Stack technique
- Next.js 16, App Router, TypeScript
- Supabase (auth + base de données + RLS)
- Tailwind CSS
- Server Actions (pas de API routes custom)

## Repo
github.com/enguerandbizollon-hash/scaleupservices4u-crm

## Conventions STRICTES — ne jamais déroger
- Fichiers toujours nommés avec extension exacte : page.tsx, actions.ts, route.ts
- Jamais de onClick sur un Server Component → toujours passer par un Client Component
- user_id requis sur toutes les tables (RLS basé sur auth.uid())
- proxy.ts gère l'auth — ne jamais toucher middleware.ts pour l'auth
- Un seul createServerClient() dans lib/supabase/server.ts

## Architecture
app/
  protected/
    dossiers/         ← deals/fundraising
    contacts/
    organisations/
    agenda/
    assistant/        ← IA intégrée

lib/
  supabase/server.ts  ← client unique
  crm/
    deals.ts          ← getDeals(), getDeal(id)
    orgs.ts
    contacts.ts

actions/
  deals.ts            ← createDeal, updateDeal, deleteDeal
  orgs.ts
  contacts.ts

## Enums Supabase (valeurs exactes) — V14 OPTIMISÉ
deal_type:    fundraising | ma_sell | ma_buy | cfo_advisor | **recruitment**
deal_stage:   kickoff | preparation | outreach | management meetings | dd | negotiation | closing | Post_closing | Ongoing_support | search
deal_types:   array de deal_type (support multi-service)
base_status:  to_qualify | qualified | priority | active | dormant | inactive | excluded
activity_type: email_sent | email_received | call | meeting | follow_up | intro | note | deck_sent | nda | document_sent | **todo** | deadline | delivery | closing | **recruitment_interview** | **recruitment_feedback** | **recruitment_task** | **cfo_advisory** | **investor_meeting** | **due_diligence** | other
task_status (alias activity_status): open | done | cancelled
recruitment_stage: job_definition | sourcing | screening | phone_interview | first_interview | second_interview | final_interview | offer | negotiation | hired | rejected
cfo_advisory_type: financial_planning | investor_relations | m_and_a_support | capital_raising | operational_optimization | tax_strategy | other

## User Supabase
user_id: edf600b3-0fa3-44f0-8696-dc17f481f2e1

## État du build
✅ Dashboard
✅ Dossiers CRUD
✅ Contacts CRUD
✅ Organisations CRUD (avec cards enrichies, filtre type/statut, infos investisseur)
✅ Agenda
✅ Sidebar
✅ RLS toutes tables
✅ Assistant IA
✅ **V14 : Fusion Activities/Tasks/Agenda (UnifiedActivityView)**
✅ **V14 : Primary Organization pour Contacts**
✅ **V14 : Support Recrutement & CFO Advisory**

🔲 Import CSV
🔲 Recherche/filtre global (en cours)
🔲 Déploiement Vercel

## Règles RLS (pattern uniforme)
-- Template à appliquer sur chaque table :
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own [table]" ON [table]
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

## 🆕 V14 — OPTIMISATIONS PRINCIPALES

### Fusion Activities/Tasks/Agenda
- ✅ Une seule table `activities` avec type enrichi (`UnifiedActivityType`)
- ✅ Support `activity_contacts` pour TOUS les types (meetings, calls, tasks, events)
- ✅ Colonnes unifiées : `due_date`, `task_status`, `location`, `participants`, `reminder_date`
- ✅ Migration RPC `migrate_tasks_to_activities()` pour backward compat
- ✅ View `activities_unified` pour requêtes simplifiées

### Primary Organization pour Contacts
- ✅ Colonne `contacts.primary_organization_id` (nullable)
- ✅ Champ flag `needs_org_assignment` (TRUE si NULL) → alerte UI
- ✅ Ajouts SANS friction : contacts créés sans org OK, mais alerte visuelle
- ✅ `organization_contacts` reste pour multi-org + rôles
- ✅ RPC `set_primary_organization()` pour setter la primary org

### Support Recrutement & CFO Advisory
- ✅ `deal_types[]` pour multi-service (ex: ['fundraising', 'recruitment', 'cfo_advisory'])
- ✅ `recruitment_stage` sur deals
- ✅ `target_positions[]` pour les keypeople recherchées
- ✅ `cfo_advisory_scope` pour décrire l'intervention
- ✅ Types d'activités : `recruitment_interview`, `recruitment_feedback`, `recruitment_task`, `cfo_advisory`, `investor_meeting`, `due_diligence`

### Recherche Intelligente Multi-Org
- ✅ RPC `search_contacts_by_org(org_id, query, user_id)` → contacts dans une org
- ✅ Cmd+K global remainfor dashboard
- ✅ Nouvelles flows : Sélectionner Org → Chercher Contact dans cette Org
- ✅ Support ajouter contacts/orgs à tasks

### Participants (activity_contacts)
- ✅ Tous les types d'activités supportent `activity_contacts` (réunions, calls, tasks, events)
- ✅ RPC `add_activity_participant()` pour ajouter participant
- ✅ Tracking automatique : qui a participé à quoi

## Métier & Services
Scale UP Services 4U + Vectis Finance — Consultants M&A, Fundraising, **Recrutement (RH)**, CFO Advisory.
Un dossier peut combiner plusieurs services (ex: Redpeaks = fundraising + CFO advisory + recrutement de keypeople).
Usage solo — un seul utilisateur par instance.
