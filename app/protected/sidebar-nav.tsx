"use client";
import { GlobalSearch } from "./components/global-search";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderOpen, Users, Building2, LogOut, Upload, Sparkles, Plug, UserSearch, FileCheck, BarChart2, CalendarDays, CheckSquare } from "lucide-react";

const NAV = [
  { href:"/protected",               label:"Dashboard",     dot:"#3468B0", bg:"rgba(52,104,176,.18)",  icon:LayoutDashboard },
  { href:"/protected/dossiers",      label:"Dossiers",      dot:"#15A348", bg:"rgba(21,163,72,.18)",   icon:FolderOpen },
  { href:"/protected/mandats",       label:"Mandats",       dot:"#B45309", bg:"rgba(180,83,9,.18)",    icon:FileCheck },
  { href:"/protected/contacts",      label:"Contacts",      dot:"#A8306A", bg:"rgba(168,48,106,.18)",  icon:Users },
  { href:"/protected/organisations", label:"Organisations", dot:"#D97706", bg:"rgba(217,119,6,.18)",   icon:Building2 },
  { href:"/protected/candidats",     label:"Candidats",     dot:"#0891B2", bg:"rgba(8,145,178,.18)",   icon:UserSearch },
  { href:"/protected/taches",        label:"Tâches",        dot:"#7E57C2", bg:"rgba(126,87,194,.18)",  icon:CheckSquare },
  { href:"/protected/agenda",        label:"Agenda",        dot:"#2563EB", bg:"rgba(37,99,235,.18)",   icon:CalendarDays },
  { href:"/protected/statistiques",  label:"Statistiques",  dot:"#0F766E", bg:"rgba(15,118,110,.18)",  icon:BarChart2 },
  { href:"/protected/import",        label:"Import",        dot:"#1E7A4A", bg:"rgba(30,122,74,.18)",   icon:Upload },
  { href:"/protected/connecteurs",    label:"Connecteurs",   dot:"#6D28D9", bg:"rgba(109,40,217,.18)",  icon:Plug },
];

export function SidebarNav() {
  const path = usePathname();

  return (
    <>
      {/* Recherche globale */}
      <div style={{ padding:"0 10px 8px 10px" }}><GlobalSearch/></div>

      {/* Notifications */}
      <NotificationBell/>

      <nav style={{ flex:1, overflowY:"auto", padding:"4px 10px" }}>
        <div style={{ fontSize:9, fontWeight:800, letterSpacing:".14em", color:"rgba(255,255,255,.2)", padding:"0 8px 10px", textTransform:"uppercase" }}>Navigation</div>
        {NAV.map(item => {
          const Icon = item.icon;
          const active = path === item.href || (item.href !== "/protected" && path.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"9px 11px", borderRadius:10, marginBottom:2,
              fontSize:13, fontWeight: active ? 600 : 500,
              color: active ? "#fff" : "rgba(255,255,255,.6)",
              background: active ? item.bg : "transparent",
              border: `1px solid ${active ? item.dot+"50" : "transparent"}`,
              textDecoration:"none", transition:"all .13s",
            }}>
              <div style={{ width:26, height:26, borderRadius:7, background:`${item.dot}22`, border:`1px solid ${item.dot}40`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Icon size={13} style={{ color: active ? "#fff" : item.dot }} strokeWidth={2}/>
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

      <div style={{ padding:"10px", borderTop:"1px solid rgba(255,255,255,.07)" }}>
        <form action="/auth/signout" method="post">
          <button type="submit" style={{ display:"flex", alignItems:"center", gap:9, width:"100%", padding:"9px 11px", borderRadius:10, background:"transparent", border:"none", cursor:"pointer", fontSize:12.5, fontWeight:500, color:"rgba(255,255,255,.3)", fontFamily:"inherit", textAlign:"left" }}>
            <LogOut size={13} strokeWidth={1.8}/>
            Déconnexion
          </button>
        </form>
      </div>
    </>
  );
}
