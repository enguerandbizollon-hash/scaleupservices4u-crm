export type DealView = {
  id: string;
  name: string;
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
};

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