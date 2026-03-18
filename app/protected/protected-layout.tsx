import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LogOut, FolderOpen, Users, Building2, Calendar, Activity, FileText, LayoutDashboard } from "lucide-react";

const navItems = [
  { href: "/protected", label: "Dashboard", icon: LayoutDashboard },
  { href: "/protected/contacts", label: "Contacts", icon: Users },
  { href: "/protected/dossiers", label: "Dossiers", icon: FolderOpen },
  { href: "/protected/agenda", label: "Agenda", icon: Calendar },
  { href: "/protected/organisations", label: "Organisations", icon: Building2 },
  { href: "/protected/activites", label: "Activités", icon: Activity },
  { href: "/protected/documents", label: "Documents", icon: FileText },
];

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data?.user) {
    redirect("/auth/login");
  }

  const email = data.user.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <span className="text-base font-bold tracking-tight text-slate-900">
            Scale Up CRM
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User + Logout */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-slate-700">{email}</p>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title="Se déconnecter"
              >
                <LogOut size={15} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-60 flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
