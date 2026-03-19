import Link from "next/link";
import {
  LayoutDashboard, FolderOpen, Users, Building2,
  CalendarDays, Sparkles, LogOut, Upload, Plug
} from "lucide-react";

const NAV = [
  { href: "/protected",                label: "Dashboard",     icon: LayoutDashboard },
  { href: "/protected/dossiers",       label: "Dossiers",      icon: FolderOpen },
  { href: "/protected/contacts",       label: "Contacts",      icon: Users },
  { href: "/protected/organisations",  label: "Organisations", icon: Building2 },
  { href: "/protected/agenda",         label: "Agenda",        icon: CalendarDays },
  { href: "/protected/import",         label: "Import",        icon: Upload },
  { href: "/protected/connecteurs",    label: "Connecteurs",   icon: Plug },
  { href: "/protected/ia",             label: "Assistant IA",  icon: Sparkles, accent: true },
];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg)" }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        position:"fixed", left:0, top:0, zIndex:50,
        width:220, height:"100vh",
        display:"flex", flexDirection:"column",
        background:"var(--su-900)",
        borderRight:"1px solid rgba(255,255,255,0.06)",
      }}>

        {/* Logo */}
        <div style={{ padding:"22px 20px 18px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:34, height:34, borderRadius:9,
              background:"var(--su-600)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13, fontWeight:800, color:"#fff",
              letterSpacing:"-0.02em",
            }}>SU</div>
            <div>
              <div style={{ fontSize:11, fontWeight:800, letterSpacing:"0.1em", color:"#fff" }}>SCALE UP</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:1 }}>CRM Platform</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:"auto", padding:"14px 10px" }}>
          <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.14em", color:"rgba(255,255,255,0.25)", padding:"0 8px 10px", textTransform:"uppercase" }}>
            Menu
          </div>
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} style={{
                display:"flex", alignItems:"center", gap:9,
                padding:"8px 10px", borderRadius:9, marginBottom:1,
                fontSize:12.5, fontWeight:500,
                color: item.accent ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.6)",
                background: item.accent ? "rgba(37,85,160,0.22)" : "transparent",
                border: item.accent ? "1px solid rgba(37,85,160,0.3)" : "1px solid transparent",
                transition:"all 0.12s",
                textDecoration:"none",
              }}>
                <Icon size={14} strokeWidth={1.8} style={{ flexShrink:0 }}/>
                <span style={{ flex:1 }}>{item.label}</span>
                {item.accent && (
                  <span style={{ fontSize:9, fontWeight:800, background:"var(--su-500)", color:"#fff", borderRadius:4, padding:"1px 5px", letterSpacing:"0.04em" }}>IA</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding:"12px 10px", borderTop:"1px solid rgba(255,255,255,0.07)" }}>
          <form action="/auth/signout" method="post">
            <button type="submit" style={{
              display:"flex", alignItems:"center", gap:9,
              width:"100%", padding:"8px 10px", borderRadius:9,
              background:"transparent", border:"none", cursor:"pointer",
              fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.35)",
              fontFamily:"inherit", textAlign:"left",
              transition:"color 0.12s",
            }}>
              <LogOut size={13} strokeWidth={1.8}/>
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ marginLeft:220, flex:1, minWidth:0 }}>
        {children}
      </main>
    </div>
  );
}
