import { createClient } from "@/lib/supabase/server";
import { DealWizard } from "./_components/deal-wizard";

export default async function NouveauDossierPage({ searchParams }: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const initialType = type === "ma_buy" ? "ma_buy" : type === "ma_sell" ? "ma_sell" : undefined;
  const supabase = await createClient();

  const [orgsRes, contactsRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id,name")
      .order("name"),
    supabase
      .from("contacts")
      .select("id,first_name,last_name,email")
      .order("last_name"),
  ]);

  return (
    <DealWizard
      organisations={orgsRes.data ?? []}
      contacts={contactsRes.data ?? []}
      initialType={initialType}
    />
  );
}
