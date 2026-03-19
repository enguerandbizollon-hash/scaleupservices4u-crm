import Link from "next/link";
import { LayoutDashboard, FolderOpen, Users, Building2, CalendarDays, Sparkles, LogOut, Upload, Plug } from "lucide-react";

const NAV = [
  { href:"/protected",               label:"Dashboard",     dot:"#3468B0", bg:"#E8F0FB", tx:"#1D3D72",  icon:LayoutDashboard },
  { href:"/protected/dossiers",      label:"Dossiers",      dot:"#15A348", bg:"#EAF8F0", tx:"#1A6B3E",  icon:FolderOpen },
  { href:"/protected/contacts",      label:"Contacts",      dot:"#A8306A", bg:"#FFF0FA", tx:"#8B1E6A",  icon:Users },
  { href:"/protected/organisations", label:"Organisations", dot:"#D97706", bg:"#FFF5E8", tx:"#8B4A0A",  icon:Building2 },
  { href:"/protected/agenda",        label:"Agenda",        dot:"#6D28D9", bg:"#F0EDFF", tx:"#4C2BAA",  icon:CalendarDays },
  { href:"/protected/import",        label:"Import",        dot:"#1E7A4A", bg:"#E8FAF0", tx:"#1E7A4A",  icon:Upload },
  { href:"/protected/connecteurs",   label:"Connecteurs",   dot:"#DC2626", bg:"#FFF0F0", tx:"#991B1B",  icon:Plug },
];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg)" }}>
      <aside style={{ position:"fixed", left:0, top:0, zIndex:50, width:250, height:"100vh", display:"flex", flexDirection:"column", background:"var(--su-900)", borderRight:"1px solid rgba(255,255,255,0.06)" }}>

        {/* Logo */}
        <div style={{ padding:"20px 18px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,var(--su-500),var(--su-400))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#fff", letterSpacing:"-.01em", flexShrink:0 }}>SU</div>
            <div style={{ lineHeight:1.2 }}>
              <div style={{ fontSize:12, fontWeight:800, color:"rgba(255,255,255,.9)", letterSpacing:".01em" }}>Scale Up Service 4U</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,.3)", marginTop:2 }}>CRM Platform</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:"auto", padding:"14px 10px" }}>
          <div style={{ fontSize:9, fontWeight:800, letterSpacing:".14em", color:"rgba(255,255,255,.2)", padding:"0 8px 10px", textTransform:"uppercase" }}>Navigation</div>
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 11px", borderRadius:10, marginBottom:2, fontSize:13, fontWeight:500, color:"rgba(255,255,255,.65)", background:"transparent", border:"1px solid transparent", textDecoration:"none", transition:"all .13s" }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background=`${item.bg}20`;el.style.borderColor=`${item.dot}40`;el.style.color="#fff"}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background="transparent";el.style.borderColor="transparent";el.style.color="rgba(255,255,255,.65)"}}>
                <div style={{ width:26, height:26, borderRadius:7, background:`${item.bg}22`, border:`1px solid ${item.dot}40`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Icon size={13} style={{ color:item.dot }} strokeWidth={2}/>
                </div>
                {item.label}
              </Link>
            );
          })}
          {/* IA special */}
          <Link href="/protected/ia" style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 11px", borderRadius:10, marginTop:8, fontSize:13, fontWeight:600, color:"rgba(255,255,255,.9)", background:"linear-gradient(135deg,rgba(52,104,176,.3),rgba(90,140,208,.2))", border:"1px solid rgba(90,140,208,.3)", textDecoration:"none" }}>
            <div style={{ width:26, height:26, borderRadius:7, background:"rgba(90,140,208,.25)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Sparkles size={13} style={{ color:"#90C0F0" }} strokeWidth={2}/>
            </div>
            <span style={{ flex:1 }}>Assistant IA</span>
            <span style={{ fontSize:9, fontWeight:800, background:"var(--su-500)", color:"#fff", borderRadius:4, padding:"2px 6px", letterSpacing:".04em" }}>IA</span>
          </Link>
        </nav>

        {/* Footer */}
        <div style={{ padding:"10px", borderTop:"1px solid rgba(255,255,255,.07)" }}>
          <form action="/auth/signout" method="post">
            <button type="submit" style={{ display:"flex", alignItems:"center", gap:9, width:"100%", padding:"9px 11px", borderRadius:10, background:"transparent", border:"none", cursor:"pointer", fontSize:12.5, fontWeight:500, color:"rgba(255,255,255,.3)", fontFamily:"inherit", textAlign:"left", transition:"color .12s" }}>
              <LogOut size={13} strokeWidth={1.8}/>
              Déconnexion
            </button>
          </form>
        </div>
      </aside>
      <main style={{ marginLeft:250, flex:1, minWidth:0 }}>{children}</main>
    </div>
  );
}
