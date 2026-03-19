import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FolderOpen, Users, Building2, Plus, TrendingUp, Calendar, Sparkles } from "lucide-react";

async function DashboardContent() {
  const supabase = await createClient();

  const [
    { count: dealsCount },
    { count: contactsCount },
    { count: orgsCount },
    { count: tasksCount },
  ] = await Promise.all([
    supabase.from("deals").select("*", { count: "exact", head: true }),
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("organizations").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("task_status", "open"),
  ]);

  const stats = [
    { label: "Dossiers", value: dealsCount ?? 0, href: "/protected/dossiers", newHref: "/protected/dossiers/nouveau", icon: FolderOpen, bg: "bg-amber-50", border: "border-amber-200", iconColor: "text-amber-600", accent: "bg-amber-500" },
    { label: "Contacts", value: contactsCount ?? 0, href: "/protected/contacts", newHref: "/protected/contacts/nouveau", icon: Users, bg: "bg-emerald-50", border: "border-emerald-200", iconColor: "text-emerald-600", accent: "bg-emerald-500" },
    { label: "Organisations", value: orgsCount ?? 0, href: "/protected/organisations", newHref: "/protected/organisations/nouveau", icon: Building2, bg: "bg-sky-50", border: "border-sky-200", iconColor: "text-sky-600", accent: "bg-sky-500" },
    { label: "Tâches ouvertes", value: tasksCount ?? 0, href: "/protected/agenda", newHref: "/protected/agenda/nouvelle-tache", icon: Calendar, bg: "bg-violet-50", border: "border-violet-200", iconColor: "text-violet-600", accent: "bg-violet-500" },
  ];

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-10">
        <p className="text-sm font-semibold tracking-widest text-[#C9A84C]">SCALE UP SERVICES 4U</p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight text-[#0F1B2D]">Dashboard</h1>
        <p className="mt-2 text-sm text-[#6B8CAE]">Vue d'ensemble de votre activité M&A / Advisory</p>
      </div>

      {/* Stats */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`relative overflow-hidden rounded-2xl border ${stat.border} ${stat.bg} p-6`}>
              <div className={`absolute top-0 right-0 h-1 w-24 ${stat.accent} rounded-bl-xl`} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-2 text-4xl font-bold text-[#0F1B2D]">{stat.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg} border ${stat.border}`}>
                  <Icon size={20} className={stat.iconColor} />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Link href={stat.href} className="text-xs font-medium text-slate-500 hover:text-[#0F1B2D] transition-colors">
                  Voir tous →
                </Link>
                <Link href={stat.newHref} className={`flex h-7 w-7 items-center justify-center rounded-lg ${stat.accent} text-white hover:opacity-90 transition-opacity`}>
                  <Plus size={13} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions rapides */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold tracking-widest text-[#0F1B2D]">ACTIONS RAPIDES</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/protected/contacts/nouveau" className="rounded-xl bg-[#0F1B2D] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B2A4A] transition-colors">
              + Nouveau contact
            </Link>
            <Link href="/protected/dossiers/nouveau" className="rounded-xl border border-[#E8E0D0] px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8] transition-colors">
              + Nouveau dossier
            </Link>
            <Link href="/protected/organisations/nouveau" className="rounded-xl border border-[#E8E0D0] px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8] transition-colors">
              + Nouvelle organisation
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles size={18} className="text-cyan-600" />
            <h2 className="text-sm font-semibold tracking-widest text-[#0F1B2D]">ASSISTANT IA</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">Rédige des emails, analyse des dossiers, qualifie des contacts.</p>
          <Link href="/protected/ia" className="inline-flex items-center gap-2 rounded-xl bg-[#0F1B2D] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B2A4A] transition-colors">
            <Sparkles size={14} />
            Ouvrir l'assistant
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
        <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-200 mb-10" />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
