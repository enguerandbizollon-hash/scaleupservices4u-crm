# Guide d'Implémentation V14 — CRM Optimisé

## Vue d'ensemble des changements

Cette version V14 optimise fortement le CRM en :
1. **Fusionnant** tasks, activities et agenda events en une seule table `activities` unifiée
2. **Liants** les contacts aux organisations via `primary_organization_id`
3. **Supportant** les services additionnels (Recrutement, CFO Advisory)
4. **Centralisant** les participants (activity_contacts) pour tous les types d'activités

---

## 1. Migration Supabase

**Avant toute chose**, exécutez la migration SQL v14 dans Supabase :

```sql
-- Copier/coller le contenu de supabase_migration_v14.sql dans SQL Editor
```

Cette migration :
- ✅ Ajoute `primary_organization_id` à `contacts`
- ✅ Ajoute colonnes unifiées à `activities`
- ✅ Crée les RPC helper functions
- ✅ Ajoute les indices optimisés

---

## 2. Intégration dans les pages existantes

### 2.1 Créer une nouvelle activité (Task/Event/Meeting)

**Avant (2 modals différentes)**
```tsx
const [showTaskModal, setShowTaskModal] = useState(false);
const [showEventModal, setShowEventModal] = useState(false);

// Dans le JSX :
<TaskModal isOpen={showTaskModal} onClose={() => setShowTaskModal(false)} />
<EventModal isOpen={showEventModal} onClose={() => setShowEventModal(false)} />
```

**Après (1 modal unifiée)**
```tsx
"use client";
import { UnifiedActivityModal } from "@/app/protected/components/unified-activity-modal";
import { createUnifiedActivityAction } from "@/app/protected/actions/unified-activity-actions";

export function MyPage() {
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [defaultActivityType, setDefaultActivityType] = useState("meeting");

  const handleCreateActivity = async (form: UnifiedActivityFormData) => {
    const result = await createUnifiedActivityAction(form);
    return result.success;
  };

  return (
    <>
      {/* Buttons pour créer différents types */}
      <button onClick={() => {
        setDefaultActivityType("todo");
        setShowActivityModal(true);
      }}>+ Tâche</button>

      <button onClick={() => {
        setDefaultActivityType("meeting");
        setShowActivityModal(true);
      }}>+ Réunion</button>

      <button onClick={() => {
        setDefaultActivityType("recruitment_interview");
        setShowActivityModal(true);
      }}>+ Entretien Recrutement</button>

      {/* Modal unique */}
      <UnifiedActivityModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onSave={handleCreateActivity}
        dealId="optional-deal-id"
        defaultType={defaultActivityType}
      />
    </>
  );
}
```

---

### 2.2 Sélectionner un contact d'une organisation

**Avant : Multi-select chaotique**
```tsx
// Les contacts n'avaient pas de lien clair avec org
const [selectedContact, setSelectedContact] = useState("");
const allContacts = ...; // tous les contacts (confus)
```

**Après : Org → puis Contact**
```tsx
"use client";
import { OrgContactPicker } from "@/app/protected/components/org-contact-picker";

export function ContactSelectionForm() {
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  return (
    <OrgContactPicker
      organizationId={selectedOrgId}
      contactIds={selectedContactIds}
      onOrgChange={setSelectedOrgId}
      onContactsChange={setSelectedContactIds}
      multiSelect={true}
      label="Participants"
    />
  );
}
```

---

### 2.3 Afficher l'alerte si contact sans org

**Avant : Aucune indication**
```tsx
<div>
  <h3>{contact.firstName} {contact.lastName}</h3>
  <p>{contact.email}</p>
</div>
```

**Après : Warning visuelle**
```tsx
"use client";
import { ContactOrgAssignmentWarning } from "@/app/protected/components/contact-org-assignment-warning";
import { setContactPrimaryOrganizationAction } from "@/app/protected/actions/unified-activity-actions";

export function ContactCard({ contact }) {
  const [showAssignModal, setShowAssignModal] = useState(false);

  const handleAssignOrg = async (orgId: string) => {
    await setContactPrimaryOrganizationAction(contact.id, orgId);
    // Recharger contact ou invalider cache
  };

  return (
    <div>
      {/* Warning si pas de primary org */}
      <ContactOrgAssignmentWarning
        showAlert={!contact.primaryOrganizationId}
        contactName={`${contact.firstName} ${contact.lastName}`}
        onAssignClick={() => setShowAssignModal(true)}
        inline={true}
      />

      <h3>{contact.firstName} {contact.lastName}</h3>
      <p>{contact.email}</p>

      {/* Modal pour assigner org (à créer) */}
    </div>
  );
}
```

---

### 2.4 Créer un deal avec plusieurs services

**Avant : Champ `deal_type` unique**
```tsx
<select>
  <option value="fundraising">Fundraising</option>
  <option value="ma_sell">M&A Sell-side</option>
</select>
```

**Après : `deal_types[]` pour multi-service**
```tsx
"use client";
const DEAL_TYPES = [
  "fundraising",
  "cfo_advisor",
  "recruitment",
  "ma_sell",
  "ma_buy"
];

export function DealForm() {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const handleToggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSave = async () => {
    // Envoyer deal_types: selectedTypes au backend
    const result = await fetch("/api/deals", {
      method: "POST",
      body: JSON.stringify({
        name: "Redpeaks",
        deal_types: selectedTypes, // ['fundraising', 'recruitment', 'cfo_advisor']
        // ...
      }),
    });
  };

  return (
    <div>
      <h3>Services</h3>
      {DEAL_TYPES.map(type => (
        <label key={type}>
          <input
            type="checkbox"
            checked={selectedTypes.includes(type)}
            onChange={() => handleToggleType(type)}
          />
          {dealTypeLabels[type]}
        </label>
      ))}
    </div>
  );
}
```

---

## 3. Ajouter des participants à une activité

### Via le modal UnifiedActivityModal
Automatique pour les types `meeting`, `call`, `recruitment_interview`.

### Via action serveur
```tsx
import { addActivityParticipantAction } from "@/app/protected/actions/unified-activity-actions";

const result = await addActivityParticipantAction(
  activityId,
  contactId
);

if (result.success) {
  // Participant ajouté
  toast.success("Participant ajouté");
}
```

---

## 4. Mettre à jour les fonctions de récupération de données

### Avant : 3 fonctions séparées
```tsx
const activities = await getActivitiesView();
const tasks = await getTasksView();
const events = await getEventsView();
```

### Après : 1 fonction unifiée
```tsx
// À créer : lib/crm/get-activities-unified.ts
export async function getActivitiesUnified(userId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("activities_unified")  // VIEW créée en V14
    .select("*")
    .eq("user_id", userId)
    .order("event_date", { ascending: false });

  return data as UnifiedActivityView[];
}
```

---

## 5. Checklist d'implémentation

### Phase 1 : Foundation ✅
- [x] Migration Supabase V14 appliquée
- [x] Types TypeScript mis à jour
- [x] Labels mis à jour
- [x] Composants créés (OrgContactPicker, UnifiedActivityModal, Warning)
- [x] Actions serveur créées
- [x] API route contacts-by-org créée

### Phase 2 : Intégration (À faire)
- [ ] Remplacer task-modal.tsx par UnifiedActivityModal (dossiers/[id])
- [ ] Remplacer event-modal.tsx par UnifiedActivityModal (dossiers/[id])
- [ ] Mettre à jour contacts/[id]/page.tsx avec ContactOrgAssignmentWarning
- [ ] Mettre à jour organisations/[id]/org-detail.tsx pour afficher avertissements
- [ ] Créer get-activities-unified.ts
- [ ] Adapter dashboard pour afficher activities unifiées
- [ ] Mettre à jour search/route.ts pour multi-org

### Phase 3 : Polish (À faire)
- [ ] Tests de migration (tasks → activities)
- [ ] Verification RLS sur nouvelles colonnes
- [ ] Performances indices
- [ ] Documentation utilisateur

---

## 6. Exemples d'utilisation

### Exemple 1 : Dossier avec tâches et réunions

```tsx
// app/protected/dossiers/[id]/page.tsx
"use client";
import { UnifiedActivityModal, UnifiedActivityFormData } from "@/app/protected/components/unified-activity-modal";
import { createUnifiedActivityAction } from "@/app/protected/actions/unified-activity-actions";

export function DossierDetail({ deal }) {
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityType, setActivityType] = useState("todo");

  const handleSaveActivity = async (form: UnifiedActivityFormData) => {
    const result = await createUnifiedActivityAction({
      ...form,
      dealId: deal.id,
    });
    return result.success;
  };

  return (
    <div>
      <h1>{deal.name}</h1>

      {/* Buttons pour créer activités */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { setActivityType("todo"); setShowActivityModal(true); }}>
          + Tâche
        </button>
        <button onClick={() => { setActivityType("meeting"); setShowActivityModal(true); }}>
          + Réunion
        </button>
        <button onClick={() => { setActivityType("recruitment_interview"); setShowActivityModal(true); }}>
          + Entretien
        </button>
      </div>

      {/* Modal */}
      <UnifiedActivityModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onSave={handleSaveActivity}
        dealId={deal.id}
        defaultType={activityType}
      />

      {/* Afficher les activities du deal (à implémenter) */}
    </div>
  );
}
```

### Exemple 2 : Organisation avec contacts (avec warning)

```tsx
// app/protected/organisations/[id]/org-detail.tsx
"use client";
import { ContactOrgAssignmentWarning } from "@/app/protected/components/contact-org-assignment-warning";
import { setContactPrimaryOrganizationAction } from "@/app/protected/actions/unified-activity-actions";

export function OrgDetail({ org, contacts }) {
  const contactsWithoutOrg = contacts.filter(c => !c.primaryOrganizationId);

  return (
    <div>
      <h1>{org.name}</h1>

      {/* Warning globale */}
      {contactsWithoutOrg.length > 0 && (
        <div style={{ background: "rgba(239,68,68,0.05)", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <strong>{contactsWithoutOrg.length} contact(s)</strong> sans organisation primaire
        </div>
      )}

      {/* Liste contacts */}
      {contacts.map(contact => (
        <div key={contact.id} style={{ padding: 12, border: "1px solid #ddd", marginBottom: 8, borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3>{contact.firstName} {contact.lastName}</h3>
              <p>{contact.email}</p>
            </div>
            <ContactOrgAssignmentWarning
              showAlert={!contact.primaryOrganizationId}
              contactName={`${contact.firstName} ${contact.lastName}`}
              inline={true}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 7. Backward Compatibility

Les anciennes colonnes et tables restent intactes :
- `tasks` table : reste, les nouvelles créations vont dans `activities`
- `activity_contacts` & `task_contacts` : fusionnées en `activity_contacts` pour le nouveau code
- `events` : déprécié en faveur d'`activities` avec `activity_type='deadline'|'meeting'`

Pour migrer les tasks existantes vers activities :
```sql
-- Depuis Supabase SQL Editor
SELECT migrate_tasks_to_activities('edf600b3-0fa3-44f0-8696-dc17f481f2e1'::UUID);
```

---

## 8. Support API/Connecteurs

Grâce aux actions sans friction et aux RPC helpers, le CRM supporte maintenant :

✅ Création contacts sans org (alerte UI)
✅ Import CSV multi-org avec participants
✅ Webhooks pour créer activities via API
✅ Connecteurs Zapier/Make pour ajouter tasks/events

Exemple webhook :
```bash
curl -X POST https://crm.app/api/activities \
  -H "Authorization: Bearer API_KEY" \
  -d '{
    "title": "Call client",
    "activityType": "call",
    "dealId": "...",
    "organizationId": "...",
    "participantContactIds": ["..."]
  }'
```

---

## Ressources

- Migration SQL: `supabase_migration_v14.sql`
- Types: `lib/crm/types.ts` (UnifiedActivityType, UnifiedActivityView)
- Composants: `app/protected/components/`
  - `org-contact-picker.tsx`
  - `unified-activity-modal.tsx`
  - `contact-org-assignment-warning.tsx`
- Actions: `app/protected/actions/unified-activity-actions.ts`
- API: `app/api/search/contacts-by-org/route.ts`
