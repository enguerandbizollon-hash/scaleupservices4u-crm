"use client";

import {
  ImportWizardModal,
  type ImportWizardConfig,
  type ImportResult,
} from "@/components/imports/import-wizard";
import { importContacts, type ImportContactRow } from "@/actions/import";

const FIELDS = [
  {
    key: "first_name",
    label: "Prénom *",
    required: true,
    aliases: ["prenom", "firstname", "first name", "first_name", "given name"],
  },
  {
    key: "last_name",
    label: "Nom *",
    required: true,
    aliases: [
      "nom",
      "lastname",
      "last name",
      "last_name",
      "surname",
      "family name",
      "nom de famille",
    ],
  },
  {
    key: "email",
    label: "Email",
    aliases: ["email", "e-mail", "mail", "courriel", "adresse mail"],
  },
  {
    key: "phone",
    label: "Téléphone",
    aliases: ["telephone", "tel", "mobile", "phone", "gsm", "portable", "numero"],
  },
  {
    key: "title",
    label: "Fonction",
    aliases: ["fonction", "titre", "title", "role", "poste", "position", "job title"],
  },
  {
    key: "sector",
    label: "Secteur",
    aliases: ["secteur", "sector", "industry", "industrie", "domaine"],
  },
  {
    key: "organisation_name",
    label: "Organisation",
    aliases: [
      "organisation",
      "organization",
      "entreprise",
      "company",
      "societe",
      "société",
      "boite",
      "employer",
    ],
  },
  {
    key: "linkedin_url",
    label: "LinkedIn",
    aliases: ["linkedin", "linkedin url", "linkedin_url", "profil linkedin"],
  },
  {
    key: "base_status",
    label: "Statut",
    aliases: ["statut", "status"],
  },
  {
    key: "notes",
    label: "Notes",
    aliases: ["notes", "remarques", "comments", "commentaires", "commentaire"],
  },
];

async function runContactsImport(
  records: Record<string, string>[],
): Promise<ImportResult> {
  const rows: ImportContactRow[] = records.map((r) => ({
    first_name: r.first_name ?? "",
    last_name: r.last_name ?? "",
    email: r.email ?? null,
    phone: r.phone ?? null,
    title: r.title ?? null,
    sector: r.sector ?? null,
    linkedin_url: r.linkedin_url ?? null,
    base_status: r.base_status ?? null,
    organisation_name: r.organisation_name ?? null,
    notes: r.notes ?? null,
  }));
  const res = await importContacts(rows);
  return {
    total: res.total,
    created: res.created,
    matched: res.matched,
    errors: res.errors,
    extras: [
      { label: "Organisations créées", value: res.organisations_created },
      { label: "Contacts liés à une organisation", value: res.organisations_linked },
    ],
  };
}

const CONFIG: ImportWizardConfig = {
  entityLabel: "contact",
  entityLabelPlural: "contacts",
  fields: FIELDS,
  templateFilename: "template-import-contacts.csv",
  templateHeaderLabels: {
    first_name: "Prenom",
    last_name: "Nom",
    email: "Email",
    phone: "Telephone",
    title: "Fonction",
    sector: "Secteur",
    organisation_name: "Organisation",
    linkedin_url: "LinkedIn",
    notes: "Notes",
  },
  templateRow: {
    first_name: "Jean",
    last_name: "Dupont",
    email: "jean.dupont@example.com",
    phone: "+33 6 12 34 56 78",
    title: "Directeur Financier",
    sector: "Industrie",
    organisation_name: "ACME SAS",
    linkedin_url: "https://linkedin.com/in/jean-dupont",
    notes: "Rencontré au salon BPI",
  },
  runImport: runContactsImport,
};

export function ContactsImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  return (
    <ImportWizardModal
      config={CONFIG}
      onClose={onClose}
      onImported={onImported}
    />
  );
}
