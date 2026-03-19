import Link from "next/link";
import {
  FolderOpen, Users, Building2, Calendar,
  Activity, FileText, LayoutDashboard, Sparkles, LogOut
} from "lucide-react";

const navItems = [
  { href: "/protected", label: "Dashboard", icon: LayoutDashboard, color: "text-sky-300" },
  { href: "/protected/contacts", label: "Contacts", icon: Users, color: "text-emerald-300" },
  { href: "/protected/dossiers", label: "Dossiers", icon: FolderOpen, color: "text-amber-300" },
  { href: "/protected/agenda", label: "Agenda", icon: Calendar, color: "text-violet-300" },
  { href: "/protected/organisations", label: "Organisations", icon: Building2, color: "text-rose-300" },
  { href: "/protected/activites", label: "Activités", icon: Activity, color: "text-orange-300" },
  { href: "/protected/documents", label: "Documents", icon: FileText, color: "text-slate-400" },
  { href: "/protected/ia", label: "Assistant IA", icon: Sparkles, color: "text-cyan-300" },
];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F5F0E8]">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-[#0F1B2D]">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-[#1E3050] px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C9A84C]">
            <span className="text-xs font-bold text-white">SU</span>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest text-[#C9A84C]">SCALE UP</p>
            <p className="text-xs text-[#6B8CAE]">CRM Platform</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-xs font-semibold tracking-widest text-[#3A5A7A]">NAVIGATION</p>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#8BACC8] transition-all duration-150 hover:bg-white/5 hover:text-white"
                  >
                    <Icon size={16} strokeWidth={1.8} className={item.color} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-[#1E3050] p-4">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#6B8CAE] transition-all hover:bg-white/5 hover:text-white"
            >
              <LogOut size={15} />
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <main className="ml-64 flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
