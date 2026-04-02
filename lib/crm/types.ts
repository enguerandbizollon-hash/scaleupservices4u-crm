export type DealView = {
  id: string;
  name: string;
  deal_status: string;
  deal_type: string;
  typeLabel: string;
  statusLabel: string;
  stageLabel: string;
  priorityLabel: string;
  organisation: string;
  sector: string;
  valuation: string;
  fundraising: string;
  startDate: string;
  targetDate: string;
  description: string;
  // Nouveaux : support multi-service
  dealTypes?: string[]; // e.g., ['fundraising', 'cfo_advisory', 'recruitment']
  recruitmentStage?: string;
  recruitmentTargetPositions?: string[];
  cfoAdvisoryScope?: string;
};

export type OrganizationView = {
  id: string;
  name: string;
  typeLabel: string;
  statusLabel: string;
  sector: string;
  country: string;
  website: string | null;
  notes: string;
  linkedDeals: string[];
};

export type ContactLinkedDealView = {
  dealName: string;
  roleInDeal: string;
  contacted: boolean;
  contactedAt: string;
  lastContactAt: string;
  nextFollowUpAt: string;
  statusInDeal: string;
  notes: string;
};

export type ContactView = {
  id: string;
  fullName: string;
  title: string;
  email: string;
  phone: string;
  linkedinUrl: string | null;
  sector: string;
  ticket: string;
  organisation: string;
  status: string;
  notes: string;
  linkedDeals: ContactLinkedDealView[];
  // Nouveaux : org primary et alerte
  primaryOrganizationId?: string | null;
  primaryOrganizationName?: string | null;
  needsOrgAssignment?: boolean; // true si primaryOrganizationId IS NULL
};

// ────────────────────────────────────────────────────────────────
// UNIFIED ACTIVITY TYPE (fusion tasks, activities, agenda)
// ────────────────────────────────────────────────────────────────
export type UnifiedActivityType =
  // Originaux activities
  | 'email_sent' | 'email_received' | 'call' | 'meeting' | 'intro' | 'note'
  // Originaux tasks
  | 'todo' | 'follow_up' | 'deck_sent' | 'nda' | 'document_sent'
  // Originaux agenda/events
  | 'deadline' | 'delivery' | 'closing'
  // Nouveaux : recrutement
  | 'recruitment_interview' | 'recruitment_feedback' | 'recruitment_task'
  // Nouveaux : services
  | 'cfo_advisory' | 'investor_meeting' | 'due_diligence'
  | 'other';

export type ActivityStatus = 'open' | 'done' | 'cancelled';

export type UnifiedActivityView = {
  id: string;
  title: string;
  summary?: string;
  activityType: UnifiedActivityType;
  status: ActivityStatus;
  // Dates
  eventDate?: string; // activity_date ou due_date (pour agenda/deadline)
  dueDate?: string;
  reminderDate?: string;
  dueTime?: string;
  completedAt?: string;
  // Contexte
  dealName?: string;
  contactName?: string;
  contactId?: string;
  organizationName?: string;
  organizationId?: string;
  // Pour meetings/calls
  location?: string;
  isAllDay?: boolean;
  // Participants (activity_contacts)
  participants?: string[]; // noms des contacts
  participantIds?: string[];
  // Création
  createdAt: string;
  updatedAt?: string;
};

// Ancien ActivityView (backward compat)
export type ActivityView = {
  id: string;
  typeLabel: string;
  title: string;
  summary: string;
  dealName: string;
  contactName: string;
  organizationName: string;
  sourceLabel: string;
  activityDate: string;
};

// Ancien TaskView (backward compat, utiliser UnifiedActivityView pour nouveau code)
export type TaskView = {
  id: string;
  title: string;
  description: string;
  dealName: string;
  contactName: string;
  priorityLabel: string;
  dueDate: string;
};

export type AgendaEventView = {
  id: string;
  title: string;
  eventTypeLabel: string;
  dealName: string;
  startsAt: string;
  location: string;
  description: string;
  attendees: string[];
};

// NOUVEAUX TYPES POUR FORMS & PICKERS
export type ContactWithOrganization = {
  contactId: string;
  contactName: string;
  organizationId?: string;
  organizationName?: string;
  role?: string;
  isPrimary?: boolean;
};

export type OrganizationWithContacts = {
  organizationId: string;
  organizationName: string;
  organizationType: string;
  contactCount: number;
  contacts: Array<{
    contactId: string;
    contactName: string;
    role: string;
    isPrimary: boolean;
  }>;
};

export type DocumentView = {
  id: string;
  dealName: string;
  name: string;
  documentTypeLabel: string;
  documentStatusLabel: string;
  documentUrl: string | null;
  versionLabel: string;
  addedAt: string;
  note: string;
};

export type PriorityView = {
  id: string;
  dealName: string;
  title: string;
  description: string;
  priorityLabel: string;
  taskStatusLabel: string;
  dueDate: string;
};

export type ChecklistItemView = {
  id: string;
  label: string;
  itemStatusLabel: string;
  isDone: boolean;
  dueDate: string;
  note: string;
};

export type ChecklistGroupView = {
  dealId: string;
  dealName: string;
  dealTypeLabel: string;
  items: ChecklistItemView[];
};