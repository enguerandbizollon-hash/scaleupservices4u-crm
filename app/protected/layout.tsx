import Link from "next/link";
import { FolderOpen, Users, Building2, Calendar, Activity, FileText, LayoutDashboard } from "lucide-react";

const navItems = [
  { href: "/protected", label: "Dashboard", icon: LayoutDashboard },
  { href: "/protected/contacts", label: "Contacts", icon: Users },
  { href: "/protected/dossiers", label: "Dossiers", icon: FolderOpen },
  { href: "/protected/agenda", label: "Agenda", icon: Calendar },
  { href: "/protected/organisations", label: "Organisations", icon: Building2 },
  { href: "/protected/activites", label: "Activités", icon: Activity },
  { href: "/protected/documents", label: "Documents", icon: FileText },
  { href: "/protected/ia", label: "Assistant IA", icon: Sparkles },
];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <span className="text-base font-bold tracking-tight text-slate-900">
            Scale Up CRM
          </span>
        </div>

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

        <div className="border-t border-slate-200 p-4">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <main className="ml-60 flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
