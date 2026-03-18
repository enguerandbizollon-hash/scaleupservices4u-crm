import { Suspense } from "react";
import { AIChat } from "./ai-chat";
import { createClient } from "@/lib/supabase/server";

async function AIChatWrapper() {
  const supabase = await createClient();

  const [
    { count: dealsCount },
    { count: contactsCount },
    { count: orgsCount },
  ] = await Promise.all([
    supabase.from("deals").select("*", { count: "exact", head: true }),
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("organizations").select("*", { count: "exact", head: true }),
  ]);

  return (
    <AIChat
      stats={{
        deals: dealsCount ?? 0,
        contacts: contactsCount ?? 0,
        orgs: orgsCount ?? 0,
      }}
    />
  );
}

export default function AIPage() {
  return (
    <Suspense fallback={
      <div className="p-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 mb-4" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    }>
      <AIChatWrapper />
    </Suspense>
  );
}
