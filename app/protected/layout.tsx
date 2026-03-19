import Link from "next/link";
import { LayoutDashboard, FolderOpen, Users, Building2, Calendar, Sparkles, LogOut, Upload, Plug } from "lucide-react";

const nav = [
  { href: "/protected",                label: "Dashboard",      icon: LayoutDashboard },
  { href: "/protected/dossiers",       label: "Dossiers",       icon: FolderOpen },
  { href: "/protected/contacts",       label: "Contacts",       icon: Users },
  { href: "/protected/organisations",  label: "Organisations",  icon: Building2 },
  { href: "/protected/agenda",         label: "Agenda",         icon: Calendar },
  { href: "/protected/import",         label: "Import CSV",     icon: Upload },
  { href: "/protected/connecteurs",    label: "Connecteurs",    icon: Plug },
  { href: "/protected/ia",             label: "Assistant IA",   icon: Sparkles, accent: true },
];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <aside style={{
        position: "fixed", left: 0, top: 0, zIndex: 40,
        width: 240, height: "100vh", display: "flex", flexDirection: "column",
        background: "var(--su-900)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo-icon.png" alt="Scale UP" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "white", opacity: 0.9 }}>SCALE UP</div>
              <div style={{ fontSize: 10, color: "var(--su-400)", marginTop: 1 }}>CRM Platform</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: "var(--su-400)", padding: "8px 10px 10px", textTransform: "uppercase" }}>
            Navigation
          </div>
          {nav.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 10, marginBottom: 2,
                fontSize: 13, fontWeight: 500,
                color: item.accent ? "white" : "var(--su-200)",
                background: item.accent ? "rgba(45,110,164,0.25)" : "transparent",
                textDecoration: "none",
              }}>
                <Icon size={15} strokeWidth={1.8} />
                <span style={{ flex: 1 }}>{item.label}</span>
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
            <button type="submit" style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "9px 10px", borderRadius: 10, background: "transparent",
              border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
              color: "var(--su-400)", textAlign: "left",
            }}>
              <LogOut size={14} />
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <main style={{ marginLeft: 240, flex: 1, minWidth: 0, minHeight: "100vh", background: "var(--bg)" }}>
        {children}
      </main>
    </div>
  );
}
