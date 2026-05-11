import { SidebarNav } from "./sidebar-nav";
import { CommandPalette } from "@/components/ui/CommandPalette";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg)" }}>
      <aside style={{ position:"fixed", left:0, top:0, zIndex:50, width:250, height:"100vh", display:"flex", flexDirection:"column", background:"var(--su-900)", borderRight:"1px solid rgba(255,255,255,0.06)" }}>

        {/* Logo — Server Component, pas d'event handlers */}
        <div style={{ padding:"20px 18px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,var(--su-500),var(--su-400))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#fff", letterSpacing:"-.01em", flexShrink:0 }}>SU</div>
            <div style={{ lineHeight:1.2 }}>
              <div style={{ fontSize:12, fontWeight:800, color:"rgba(255,255,255,.9)", letterSpacing:".01em" }}>Scale Up Service 4U</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,.3)", marginTop:2 }}>CRM Platform</div>
            </div>
          </div>
        </div>

        {/* Nav — Client Component */}
        <SidebarNav />
      </aside>

      <main style={{ marginLeft:250, flex:1, minWidth:0 }}>
        {children}
      </main>

      {/* Palette de recherche globale Cmd+K / Ctrl+K */}
      <CommandPalette />
    </div>
  );
}
