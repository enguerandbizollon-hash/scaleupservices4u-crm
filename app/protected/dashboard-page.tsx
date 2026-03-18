import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FolderOpen, Users, Building2, Plus } from "lucide-react";

async function DashboardContent() {
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

  const stats = [
    {
      label: "Dossiers",
      value: dealsCount ?? 0,
      href: "/protected/dossiers",
      icon: FolderOpen,
      newHref: "/protected/dossiers/nouveau",
    },
    {
      label: "Contacts",
      value: contactsCount ?? 0,
      href: "/protected/contacts",
      icon: Users,
      newHref: "/protected/contacts/nouveau",
    },
    {
      label: "Organisations",
      value: orgsCount ?? 0,
      href: "/protected/organisations",
      icon: Building2,
      newHref: "/protected/organisations/nouveau",
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-sm font-medium text-slate-500">Scale Up Services 4U</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    <Icon size={20} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  </div>
                </div>
                <Link
                  href={stat.newHref}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <Plus size={15} className="text-slate-600" />
                </Link>
              </div>
              <Link
                href={stat.href}
                className="mt-4 block text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                Voir tous →
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/protected/contacts/nouveau"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            + Nouveau contact
          </Link>
          <Link
            href="/protected/dossiers/nouveau"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            + Nouveau dossier
          </Link>
          <Link
            href="/protected/organisations/nouveau"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            + Nouvelle organisation
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="p-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 mb-8" />
        <div className="grid gap-5 md:grid-cols-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
