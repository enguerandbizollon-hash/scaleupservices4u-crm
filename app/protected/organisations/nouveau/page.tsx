import { OrganisationForm } from "@/components/organisations/OrganisationForm";
import { organizationTypeLabels } from "@/lib/crm/labels";

// ?type=buyer pré-sélectionne le type : « Nouvel acquéreur » depuis la page
// Acquéreurs ouvrait un formulaire au type « Autre », donc hors matching
// (revue adversariale). Type inconnu = comportement par défaut.
export default async function NouvelleOrganisationPage({ searchParams }: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const initialType = type && type in organizationTypeLabels ? type : undefined;
  return <OrganisationForm mode="create" initialData={initialType ? { organization_type: initialType } : {}} />;
}
