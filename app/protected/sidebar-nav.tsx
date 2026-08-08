"use client";
import { GlobalSearch } from "./components/global-search";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Sunrise, FolderOpen, Users, Building2, LogOut, Upload, Sparkles, Plug, BarChart2, CalendarDays, CheckSquare, Inbox, Radar, Crosshair, Handshake, Target } from "lucide-react";

// Navigation par OPÉRATION (réorg 2026-08-08, audit IA) : la sidebar sépare
// les deux mandats symétriques. Règle : « Acquéreur » = la contrepartie qu'on
// démarche en cession, jamais un type de mandat. Donc « Acquéreurs à
// démarcher » vit SOUS Cession (le réservoir qui la sert), et « Acquisitions »
// est une entrée à part entière (le buy-side, client = repreneur). Un item
// avec `type` cible /dossiers filtré et ne s'allume que pour ce type.
const NAV_GROUPS: Array<{
  title: string | null;
  items: Array<{ href: string; label: string; dot: string; bg: string; icon: typeof Sunrise; type?: string }>;
}> = [
  { title: null, items: [
    { href:"/protected",               label:"Ce matin",             dot:"#B45309", bg:"rgba(180,83,9,.18)",    icon:Sunrise },
  ]},
  { title: "Cession", items: [
    { href:"/protected/dossiers?type=ma_sell", type:"ma_sell", label:"Cessions",             dot:"#15A348", bg:"rgba(21,163,72,.18)",   icon:FolderOpen },
    { href:"/protected/prospection",   label:"Prospection cédants",  dot:"#0F766E", bg:"rgba(15,118,110,.18)",  icon:Crosshair },
    { href:"/protected/signaux",       label:"Signaux",              dot:"#B45309", bg:"rgba(180,83,9,.18)",    icon:Radar },
    { href:"/protected/acquereurs",    label:"Acquéreurs à démarcher", dot:"#6366F1", bg:"rgba(99,102,241,.18)", icon:Handshake },
  ]},
  { title: "Acquisition", items: [
    { href:"/protected/dossiers?type=ma_buy", type:"ma_buy", label:"Acquisitions",          dot:"#2563EB", bg:"rgba(37,99,235,.18)",   icon:Target },
  ]},
  { title: "Annuaire", items: [
    { href:"/protected/organisations", label:"Organisations",        dot:"#D97706", bg:"rgba(217,119,6,.18)",   icon:Building2 },
    { href:"/protected/contacts",      label:"Contacts",             dot:"#A8306A", bg:"rgba(168,48,106,.18)",  icon:Users },
  ]},
  { title: "Exécution", items: [
    { href:"/protected/taches",        label:"Tâches",               dot:"#7E57C2", bg:"rgba(126,87,194,.18)",  icon:CheckSquare },
    { href:"/protected/agenda",        label:"Agenda",               dot:"#2563EB", bg:"rgba(37,99,235,.18)",   icon:CalendarDays },
    { href:"/protected/inbox",         label:"Boîte de tri",         dot:"#E11D48", bg:"rgba(225,29,72,.18)",   icon:Inbox },
  ]},
  { title: "Outillage", items: [
    { href:"/protected/statistiques",  label:"Statistiques",         dot:"#0F766E", bg:"rgba(15,118,110,.18)",  icon:BarChart2 },
    { href:"/protected/import",        label:"Import",               dot:"#1E7A4A", bg:"rgba(30,122,74,.18)",   icon:Upload },
    { href:"/protected/connecteurs",   label:"Connecteurs",          dot:"#6D28D9", bg:"rgba(109,40,217,.18)",  icon:Plug },
  ]},
];

export function SidebarNav({ taskCounts, inboxCount }: { taskCounts?: { overdue: number; today: number }; inboxCount?: number }) {
  const path = usePathname();
  const currentType = useSearchParams().get("type");
  const taskBadge = taskCounts && (taskCounts.overdue > 0 || taskCounts.today > 0);
  const inboxBadge = (inboxCount ?? 0) > 0;

  return (
    <>
      {/* Recherche globale */}
      <div style={{ padding:"0 10px 8px 10px" }}><GlobalSearch/></div>

      {/* Notifications */}
      <NotificationBell/>

      <nav style={{ flex:1, overflowY:"auto", padding:"4px 10px" }}>
        {NAV_GROUPS.map((group, gi) => (
        <div key={group.title ?? "top"}>
        {group.title && (
          <div style={{ fontSize:9, fontWeight:800, letterSpacing:".14em", color:"rgba(255,255,255,.25)", padding:`${gi === 0 ? 0 : 12}px 8px 6px`, textTransform:"uppercase" }}>
            {group.title}
          </div>
        )}
        {group.items.map(item => {
          const Icon = item.icon;
          const base = item.href.split("?")[0];
          // Un item typé (Cessions/Acquisitions) ne s'allume que sur /dossiers
          // ET pour son type ; les autres, par préfixe de chemin classique.
          const active = item.type
            ? path === base && currentType === item.type
            : path === base || (base !== "/protected" && path.startsWith(base));
          const isTaches = item.href === "/protected/taches";
          const isInbox = item.href === "/protected/inbox";
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
              <span style={{ flex:1 }}>{item.label}</span>
              {isInbox && inboxBadge && (
                <span title={`${inboxCount} email${(inboxCount ?? 0) > 1 ? "s" : ""} à trier`} style={{ fontSize:10, fontWeight:800, background:"#E11D48", color:"#fff", borderRadius:4, padding:"1px 6px", letterSpacing:".02em" }}>
                  {inboxCount}
                </span>
              )}
              {isTaches && taskBadge && (
                <span style={{ display:"flex", gap:4 }}>
                  {taskCounts.overdue > 0 && (
                    <span title={`${taskCounts.overdue} tâche${taskCounts.overdue > 1 ? "s" : ""} en retard`} style={{ fontSize:10, fontWeight:800, background:"#DC2626", color:"#fff", borderRadius:4, padding:"1px 6px", letterSpacing:".02em" }}>
                      {taskCounts.overdue}
                    </span>
                  )}
                  {taskCounts.today > 0 && taskCounts.overdue === 0 && (
                    <span title={`${taskCounts.today} tâche${taskCounts.today > 1 ? "s" : ""} aujourd'hui`} style={{ fontSize:10, fontWeight:800, background:"#F59E0B", color:"#fff", borderRadius:4, padding:"1px 6px", letterSpacing:".02em" }}>
                      {taskCounts.today}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
        </div>
        ))}

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
