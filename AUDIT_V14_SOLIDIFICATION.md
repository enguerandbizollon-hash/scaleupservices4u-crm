# 🔍 AUDIT V14 CRM — SOLIDIFICATION PRÉ-DÉPLOIEMENT

**Date**: 25 mars 2026  
**Status**: ⚠️ **MIXED** — Compilé ✅ mais intégration incomplète 🔴  
**Prochaine action**: Correction des gaps + test complet

---

## 📊 RÉSUMÉ EXÉCUTIF

| Aspect | Status | Notes |
|--------|--------|-------|
| **Build TypeScript** | ✅ SUCCESS | 0 erreurs, 50s |
| **Fichiers V14** | ✅ 8/8 présents | Tous créés et compilés |
| **Intégration Agenda** | ✅ COMPLÈTE | Utilise UnifiedActivityModal + actions |
| **Intégration Deal Detail** | 🔴 INCOMPLÈTE | Old API + old modals | 
| **Cleanup Old Modals** | 🔴 NON FAIT | task-modal.tsx, event-modal.tsx toujours là |
| **Supabase Migration** | ❌ NON APPLIQUÉE | Doit être exécutée avant prod |
| **RLS + Security** | ⚠️ À VÉRIFIER | Dépend de la migration |
| **Tests Dev Server** | ⏸️ EN COURS | Port 3000/3001 OK |

---

## 🔴 PROBLÈMES CRITIQUES (À CORRIGER AVANT DÉPLOIEMENT)

### 1. Deal Detail Page (dossiers/[id]) — Intégration Incomplète

**Fichier**: [app/protected/dossiers/[id]/deal-detail.tsx](app/protected/dossiers/[id]/deal-detail.tsx)

**Situation**:
- ✅ Component `UnifiedActivityModal` est importé ET déclaré en state
- ✅ Types et structure existent
- 🔴 **MAIS**: N'est pas complètement câblé dans le JSX
- 🔴 Utilise encore les OLD API routes:
  - `/api/deals/{id}/tasks` (POST/PATCH/DELETE)
  - `/api/deals/{id}/activities-crud` (POST/PATCH/DELETE)
- 🔴 Old state variables comme `showEventModal` subsistent

**Impact**: 
- Dossiers page n'utilise pas les new server actions (`createUnifiedActivityAction`, etc.)
- Les participants (activity_contacts) ne sont pas créés via unified flow
- Mélange old/new causes maintenance debt

**Corrections requises**:
```diff
// AVANT
async function saveTask() {
  const d = await api("tasks", "POST", payload);
}

async function saveActivity() {
  const d = await api("activities-crud", "POST", payload);
}

// APRÈS
async function handleSaveActivity(formData: UnifiedActivityFormData) {
  const result = await createUnifiedActivityAction(formData);
  if (!result.success) throw new Error(result.error);
  setActivities([...activities, result.activity]);
}
```

---

### 2. Old Modal Components Not Removed

**Fichiers existants**:
- [app/protected/components/task-modal.tsx](app/protected/components/task-modal.tsx) — 150+ lignes, `TaskModal`, `ContactPicker`
- [app/protected/components/event-modal.tsx](app/protected/components/event-modal.tsx) — Modal pour événements

**Statut**:
- ✅ Fonctionnels mais **REDONDANTS** avec `UnifiedActivityModal`
- 🔴 Cause confusion : 3 composants modaux différents pour créer des activités
- 🔴 Maintenance overhead

**Action**: 
- ⏹️ **À SUPPRIMER** complètement
- Vérifier d'abord qu'ils ne sont importés nulle part (grep shows: deal-detail.tsx a line referencing `MailTaskModal`, pas `TaskModal`)

---

### 3. Supabase V14 Migration Not Applied

**Fichier**: [supabase_migration_v14.sql](supabase_migration_v14.sql)

**Contient**:
- ✅ `primary_organization_id` colonne sur contacts
- ✅ Colonnes unification activities (task_status, due_date, due_time, etc.)
- ✅ Indices optimisés
- ✅ RPC function `search_contacts_by_org()`
- ✅ Support deal_types[], recruitment_stage, etc.

**Blockers**:
- ❌ **Pas encore exécutée sur Supabase**
- ❌ RLS policies ne peuvent pas être vérifiées avant application
- ❌ `primary_organization_id` n'existe pas → UI warning ne peut pas fonctionner

**Action**: 
- 1️⃣ **Backup database** (via Supabase Dashboard)
- 2️⃣ Copier/coller migration dans Supabase SQL Editor
- 3️⃣ Exécuter et vérifier (check new columns, RPC functions)
- 4️⃣ Vérifier RLS policies

---

## 🟡 PROBLÈMES SECONDAIRES (À CORRIGER)

### 4. ContactOrgAssignmentWarning Jamais Utilisée

**Fichier**: [app/protected/components/contact-org-assignment-warning.tsx](app/protected/components/contact-org-assignment-warning.tsx)

**Statut**: 
- ✅ Component créé et compilé
- 🔴 **JAMAIS IMPORTÉE** dans les pages contacts

**Usage attendu**:
```tsx
// Dans pages contacts, après le refetch :
{contact.primaryOrganizationId === null && (
  <ContactOrgAssignmentWarning 
    contactName={contact.fullName} 
    organizationName={suggestedOrg}
  />
)}
```

**Action**: Intégrer dans [app/protected/contacts/[id]/page.tsx](app/protected/contacts/[id]/page.tsx)

---

### 5. OrgContactPicker Usage Minimal

**Statut**:
- ✅ Component créé et utilisé dans `UnifiedActivityModal`
- 🟡 **Potentiel inutilisé** dans autres formulaires d'ajout de contacts

**Où ajouter**:
- Contact form creation (sélectionner org d'abord)
- Deal contact linking
- Activity participant selection (DÉJÀ FAIT dans UnifiedActivityModal)

---

## ✅ CE QUI FONCTIONNE BIEN

### 6. Agenda Page — Implémentation Complète

**Fichier**: [app/protected/agenda/page.tsx](app/protected/agenda/page.tsx)

✅ Utilise `UnifiedActivityModal`  
✅ Appelle `updateUnifiedActivityAction` / `createUnifiedActivityAction`  
✅ Support des 25+ types d'activités  
✅ Participants via activity_contacts  

**Verdict**: Cette page est un modèle à reproduire pour deal-detail.tsx

---

### 7. Types TypeScript — Bien Structurés

**Fichier**: [lib/crm/types.ts](lib/crm/types.ts)

✅ Tous les types V14 présents:
- `UnifiedActivityType` (25+ valeurs)
- `UnifiedActivityView` (structure unifiée)
- `ContactView` avec `primaryOrganizationId`, `needsOrgAssignment`
- `DealView` avec `dealTypes[]`, `recruitmentStage`, etc.

✅ Aucun `as any` visible  
✅ TypeScript strict mode compatible

---

## 📋 PLAN D'ACTION À TROIS NIVEAUX

### 🟢 LEVEL 1: ERREURS BLOCKERS (Doit être fait)

```
1. [ ] Appliquer migration Supabase V14
   └─ File: supabase_migration_v14.sql
   └─ Steps: Backup → SQL Editor → Run → Verify
   └─ Time: 10 min
   └─ Risk: Medium (backup en place)

2. [ ] Intégrer UnifiedActivityModal dans deal-detail.tsx
   └─ Remplacer saveTask(), saveActivity() old API calls
   └─ Utiliser createUnifiedActivityAction, updateUnifiedActivityAction
   └─ Tester: créer une tâche, une réunion depuis dossiers/[id]
   └─ Time: 30 min
   └─ Risk: Low (ancien code reste comme fallback)

3. [ ] Supprimer les old modal components
   └─ Grep pour s'assurer non-utilisés
   └─ Delete: task-modal.tsx, event-modal.tsx
   └─ Update imports dans deal-detail
   └─ Time: 15 min
   └─ Risk: Low (UnifiedActivityModal remplace)
```

### 🟡 LEVEL 2: INTÉGRATIONS SECONDAIRES (Should be done)

```
4. [ ] Intégrer ContactOrgAssignmentWarning
   └─ Ajouter dans contacts/[id]/page.tsx
   └─ Déclencher si primaryOrganizationId === null
   └─ Time: 10 min

5. [ ] Vérifier RLS Policies après migration
   └─ SQL query : check activity_contacts, organization_contacts RLS
   └─ Ensure user_id filtering on all tables
   └─ Time: 10 min

6. [ ] Tester OrgContactPicker dans contact form
   └─ Sélectionner org, puis contacts de cet org
   └─ Time: 20 min
```

### 🔵 LEVEL 3: POLISH (Nice to have)

```
7. [ ] Add user feedback notifications
   └─ Toast on activity create/update success
   └─ Time: 15 min

8. [ ] Performance: Add revalidatePath() optimizations
   └─ Eager invalidation for commonly visited pages
   └─ Time: 10 min

9. [ ] Document new workflows in README_V14.md
   └─ Update checklist with "Production Ready" section
   └─ Time: 15 min
```

---

## 🚀 PRÉPARATION DÉPLOIEMENT

### Pre-Deploy Checklist

```
Migration & Database:
  [ ] Backup Supabase database
  [ ] Apply supabase_migration_v14.sql
  [ ] Verify RLS policies on new tables
  [ ] Check activity_contacts table populated correctly

Code Integration:
  [ ] Refactor deal-detail.tsx to use UnifiedActivityModal
  [ ] Remove task-modal.tsx mentions from imports
  [ ] Remove event-modal.tsx file
  [ ] Verify MailTaskModal still works (separate component)

Testing:
  [ ] npm run build (no TS errors)
  [ ] npm run lint (pass all checks)
  [ ] npm run dev (start without errors)
  [ ] Test agenda: create todo, meeting, recruitment_interview
  [ ] Test deal-detail: create activity via modal
  [ ] Test contact view: see org assignment warning if no primary org
  [ ] Test OrgContactPicker: select org, then contacts

Deployment:
  [ ] Create PR with all V14 fixes
  [ ] Code review (especially deal-detail changes)
  [ ] Merge to main
  [ ] Deploy to staging Vercel
  [ ] Smoke test on staging
  [ ] Deploy to production
  [ ] Monitor Sentry/logs for errors

Post-Deploy:
  [ ] Verify all activity types working in prod
  [ ] Check participant assignment
  [ ] Confirm primary org warning shows
```

---

## 💾 FICHIERS À MODIFIER

| File | Change | Priority |
|------|--------|----------|
| [app/protected/dossiers/[id]/deal-detail.tsx](app/protected/dossiers/[id]/deal-detail.tsx) | Refactor to use UnifiedActivityModal + server actions | 🔴 CRITICAL |
| [app/protected/components/task-modal.tsx](app/protected/components/task-modal.tsx) | DELETE | 🔴 CRITICAL |
| [app/protected/components/event-modal.tsx](app/protected/components/event-modal.tsx) | DELETE | 🔴 CRITICAL |
| [app/protected/contacts/[id]/page.tsx](app/protected/contacts/[id]/page.tsx) | Add ContactOrgAssignmentWarning | 🟡 SECONDARY |
| [supabase_migration_v14.sql](supabase_migration_v14.sql) | APPLY TO SUPABASE (not a file change) | 🔴 CRITICAL |

---

## 🎯 NEXT CALL TO ACTION

**Vous** (utilisateur):
1. Choisir le niveau d'implémentation (Level 1/2/3 ou All)
2. Confirmer que vous voulez procéder aux modifications
3. Spécifier si Supabase migration doit être appliquée maintenant ou plus tard

**Moi** (Claude):
1. Appliquer les modifications Code selon votre choix
2. Générer les scripts SQL si needed
3. Tester localement (npm run build/dev)
4. Documenter les changements pour la PR

---

## 📞 QUESTIONS CLARIFIANTES

Avant de commencer les corrections, répondez-moi:

1. **Supabase Migration**: 
   - [ ] Appliquer la v14 maintenant? 
   - [ ] Ou attendre votre validation en Supabase Dashboard d'abord?

2. **Niveau d'intégration**:
   - [ ] Level 1 seulement (blockers)
   - [ ] Level 1+2 (blockers + intégrations)
   - [ ] All (blockers + intégrations + polish)

3. **Timeline**:
   - Deployer aujourd'hui?
   - Ou après tests approfondis?

**Dites-moi vos choix, et je procède immédiatement.**
