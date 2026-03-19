import Link from "next/link";
import { LayoutDashboard, Upload, FolderOpen, Users, Building2, Calendar, Sparkles, LogOut } from "lucide-react";

const nav = [
  { href: "/protected",               label: "Dashboard",     icon: LayoutDashboard },
  { href: "/protected/dossiers",      label: "Dossiers",      icon: FolderOpen },
  { href: "/protected/contacts",      label: "Contacts",      icon: Users },
  { href: "/protected/organisations", label: "Organisations", icon: Building2 },
  { href: "/protected/agenda",        label: "Agenda",        icon: Calendar },
  { href: "/protected/import",        label: "Import CSV",    icon: Upload },
  { href: "/protected/ia",            label: "Assistant IA",  icon: Sparkles, accent: true },
];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen flex-col" style={{
        width: 240,
        background: "var(--su-900)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="Scale UP" className="rounded-lg object-cover" style={{ width: 32, height: 32 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "white", opacity: 0.9 }}>SCALE UP</div>
              <div style={{ fontSize: 10, color: "var(--su-400)", marginTop: 1 }}>CRM Platform</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: "12px 10px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: "var(--su-400)", padding: "8px 10px 10px", textTransform: "uppercase" }}>
            Navigation
          </div>
          {nav.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}
                className={`nav-item${item.accent ? " nav-item-accent" : ""}`}
              >
                <Icon size={15} strokeWidth={1.8} />
                <span className="flex-1">{item.label}</span>
                {item.accent && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: "var(--su-600)", color: "white", borderRadius: 5, padding: "1px 6px" }}>IA</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "12px 10px" }}>
          <form action="/auth/signout" method="post">
            <button type="submit" className="nav-item w-full text-left border-0 bg-transparent cursor-pointer">
              <LogOut size={14} />
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      {/* Contenu */}
      <main className="flex-1 min-w-0" style={{ marginLeft: 240, minHeight: "100vh", background: "var(--bg)" }}>
        {children}
      </main>
    </div>
  );
}
