"use client";

import {
  ImportWizardModal,
  type ImportWizardConfig,
  type ImportResult,
} from "@/components/imports/import-wizard";
import { importOrganisations, type ImportOrganisationRow } from "@/actions/import";

const FIELDS = [
  {
    key: "name",
    label: "Nom *",
    required: true,
    aliases: [
      "nom",
      "name",
      "organisation",
      "organization",
      "entreprise",
      "company",
      "societe",
      "société",
      "raison sociale",
    ],
  },
  {
    key: "organization_type",
    label: "Type",
    aliases: [
      "type",
      "categorie",
      "catégorie",
      "type organisation",
      "type entreprise",
      "nature",
    ],
  },
  {
    key: "sector",
    label: "Secteur",
    aliases: ["secteur", "sector", "industry", "industrie", "domaine"],
  },
  {
    key: "location",
    label: "Localisation",
    aliases: ["localisation", "ville", "city", "location", "siege", "siège"],
  },
  {
    key: "website",
    label: "Site web",
    aliases: ["site", "website", "site web", "url", "web"],
  },
  {
    key: "linkedin_url",
    label: "LinkedIn",
    aliases: ["linkedin", "linkedin url", "profil linkedin"],
  },
  {
    key: "description",
    label: "Description",
    aliases: ["description", "presentation", "présentation", "about"],
  },
  {
    key: "notes",
    label: "Notes",
    aliases: ["notes", "remarques", "comments", "commentaires", "commentaire"],
  },
];

async function runOrgImport(
  records: Record<string, string>[],
): Promise<ImportResult> {
  const rows: ImportOrganisationRow[] = records.map((r) => ({
    name: r.name ?? "",
    organization_type: r.organization_type ?? null,
    sector: r.sector ?? null,
    location: r.location ?? null,
    website: r.website ?? null,
    linkedin_url: r.linkedin_url ?? null,
    description: r.description ?? null,
    notes: r.notes ?? null,
  }));
  const res = await importOrganisations(rows);
  return {
    total: res.total,
    created: res.created,
    matched: res.matched,
    errors: res.errors,
  };
}

const CONFIG: ImportWizardConfig = {
  entityLabel: "organisation",
  entityLabelPlural: "organisations",
  fields: FIELDS,
  templateFilename: "template-import-organisations.csv",
  templateHeaderLabels: {
    name: "Nom",
    organization_type: "Type",
    sector: "Secteur",
    location: "Localisation",
    website: "Site web",
    linkedin_url: "LinkedIn",
    description: "Description",
    notes: "Notes",
  },
  templateRow: {
    name: "ACME SAS",
    organization_type: "client",
    sector: "Industrie",
    location: "Paris",
    website: "https://acme.example.com",
    linkedin_url: "https://linkedin.com/company/acme",
    description: "ETI industrielle 200 salariés",
    notes: "Recommandée par Jean Dupont",
  },
  runImport: runOrgImport,
};

export function OrganisationsImportModal({
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
