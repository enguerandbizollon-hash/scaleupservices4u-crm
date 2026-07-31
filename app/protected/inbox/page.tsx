import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getInboxToReview, getGmailSyncStatus } from "@/actions/gmail-ingest";
import { InboxList } from "./inbox-list";

export const revalidate = 0;

interface DealOption {
  id: string;
  name: string;
  deal_type: string;
}

interface ContactOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

async function loadOptions(): Promise<{ deals: DealOption[]; contacts: ContactOption[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { deals: [], contacts: [] };

  const [{ data: deals }, { data: contacts }] = await Promise.all([
    supabase
      .from("deals")
      .select("id, name, deal_type")
      .eq("user_id", user.id)
      .eq("deal_status", "open")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .eq("user_id", user.id)
      .order("last_name", { ascending: true })
      .limit(500),
  ]);

  return {
    deals: (deals ?? []) as DealOption[],
    contacts: (contacts ?? []) as ContactOption[],
  };
}

async function Content() {
  const [items, syncStatus, options] = await Promise.all([
    getInboxToReview(),
    getGmailSyncStatus(),
    loadOptions(),
  ]);

  return (
    <InboxList
      items={items}
      syncStatus={syncStatus}
      dealOptions={options.deals}
      contactOptions={options.contacts}
    />
  );
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 32, background: "var(--bg)", minHeight: "100vh" }}>
          <div className="skeleton" style={{ height: 40, width: 280, marginBottom: 20 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 96, borderRadius: 12 }} />
            ))}
          </div>
        </div>
      }
    >
      <Content />
    </Suspense>
  );
}
