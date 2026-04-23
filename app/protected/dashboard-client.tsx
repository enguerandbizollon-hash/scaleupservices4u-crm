"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ActionModal from "@/components/actions/ActionModal";
import Link from "next/link";
import { Plus, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

export interface ContactOption {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  org_name?: string | null;
}

const ACT_ICON: Record<string,string> = { email_sent:"✉️", email_received:"📩", call:"📞", meeting:"🤝", follow_up:"🔔", note:"📝", other:"📌", deck_sent:"📊", nda:"📋", task:"☑️" };
const EVT_COLOR: Record<string,string> = { follow_up:"#D97706", meeting:"#3468B0", call:"#7C3AED", deadline:"#DC2626", email:"#059669", task:"#6B7280", other:"#6B7280" };

interface DashboardClientProps {
  kpis: { label:string; val:number; href:string; color:string }[];
  feesKpis?: { pending:number; invoiced:number; paid_ytd:number; projection:number|null; currency:string };
  deals: { id:string; name:string; type:string; stage:string; priority:string; targetDate:string|null; dt:any; stageLabel:string; prioColor:string }[];
  relances: { id:string; firstName:string; lastName:string; days:number; orgName?:string }[];
  tasks: { id:string; title:string; priority:string; dueDate:string|null; dealId:string|null; dealName?:string; overdue:boolean; prioColor:string }[];
  activities: { id:string; title:string; type:string; date:string; dealId:string|null; dealName?:string }[];
  calendarItems: { id:string; title:string; date:string; type:string; dealName?:string|null; contactName?:string|null }[];
  allContacts?: ContactOption[];
}

function fmt(v:string|null){ if(!v)return"—"; return new Date(v).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}); }
function fmtFull(v:string){ return new Date(v).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"}); }

function fmtMoney(n: number, currency: string): string {
  const cur = currency || "EUR";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M ${cur}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} k ${cur}`;
  return `${Math.round(n)} ${cur}`;
}

export function DashboardClient({ kpis, feesKpis, deals, relances, tasks, activities, calendarItems, allContacts }: DashboardClientProps) {
  const router = useRouter();
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionModalDefaultType, setActionModalDefaultType] = useState<string | undefined>(undefined);
  const [calMonth, setCalMonth] = useState(() => { const d=new Date(); return { year:d.getFullYear(), month:d.getMonth() }; });
  const [selectedDate, setSelectedDate] = useState<string|null>(null);

  // Calendrier
  const { year, month } = calMonth;
  const firstDay = new Date(year, month, 1).getDay(); // 0=dim
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const monthLabel = new Date(year, month).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});

  // Indexer les items par date
  const itemsByDate: Record<string,typeof calendarItems> = {};
  for (const item of calendarItems) {
    if (!itemsByDate[item.date]) itemsByDate[item.date] = [];
    itemsByDate[item.date].push(item);
  }

  function prevMonth() { setCalMonth(p => p.month===0 ? {year:p.year-1,month:11} : {year:p.year,month:p.month-1}); }
  function nextMonth() { setCalMonth(p => p.month===11 ? {year:p.year+1,month:0} : {year:p.year,month:p.month+1}); }

  const selectedItems = selectedDate ? (itemsByDate[selectedDate]??[]) : [];

  // Ajuster lundi=0
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  return (
    <div style={{ padding:"24px 20px", background:"var(--bg)", minHeight:"100vh" }}>
      <div style={{ maxWidth:1200, margin:"0 auto" }}>

        {/* KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
          {kpis.map(k => (
            <Link key={k.label} href={k.href} style={{ textDecoration:"none" }}>
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 16px" }}>
                <div style={{ fontSize:26, fontWeight:800, color:k.color, lineHeight:1.1 }}>{k.val}</div>
                <div style={{ fontSize:12.5, color:"var(--text-4)", marginTop:3 }}>{k.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Strip honoraires cabinet (V52) */}
        {feesKpis && (
          <Link href="/protected/statistiques" style={{ textDecoration:"none" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 14px" }}>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--text-5)", textTransform:"uppercase", letterSpacing:".06em" }}>Pipeline fees</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#D97706", marginTop:2 }}>{fmtMoney(feesKpis.pending, feesKpis.currency)}</div>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--text-5)", textTransform:"uppercase", letterSpacing:".06em" }}>Facturé</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#3468B0", marginTop:2 }}>{fmtMoney(feesKpis.invoiced, feesKpis.currency)}</div>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--text-5)", textTransform:"uppercase", letterSpacing:".06em" }}>Encaissé YTD</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#15A348", marginTop:2 }}>{fmtMoney(feesKpis.paid_ytd, feesKpis.currency)}</div>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--text-5)", textTransform:"uppercase", letterSpacing:".06em" }}>Projection fin année</div>
                <div style={{ fontSize:16, fontWeight:700, color:"var(--text-2)", marginTop:2 }}>
                  {feesKpis.projection !== null ? fmtMoney(feesKpis.projection, feesKpis.currency) : "—"}
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Layout 3 colonnes */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1.4fr 1fr", gap:12 }}>

          {/* Colonne 1 : Dossiers + Relances */}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

            {/* Dossiers actifs */}
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 14px", borderBottom:"1px solid var(--border)" }}>
                <span style={{ fontSize:11.5, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em" }}>Dossiers actifs</span>
                <Link href="/protected/dossiers/nouveau" style={{ display:"flex", alignItems:"center", gap:3, fontSize:11.5, color:"var(--text-4)", textDecoration:"none", padding:"3px 8px", border:"1px solid var(--border)", borderRadius:6 }}>
                  <Plus size={10}/> Nouveau
                </Link>
              </div>
              {deals.length === 0 && <div style={{ padding:"20px", textAlign:"center", fontSize:13, color:"var(--text-5)" }}>Aucun dossier actif</div>}
              {deals.map((d,i) => (
                <Link key={d.id} href={`/protected/dossiers/${d.id}`} style={{ display:"flex", alignItems:"center", gap:9, padding:"10px 14px", borderBottom:i<deals.length-1?"1px solid var(--border)":"none", textDecoration:"none" }}>
                  <div style={{ width:5, height:5, borderRadius:3, background:d.prioColor, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.name}</div>
                    <div style={{ fontSize:11, color:"var(--text-5)", marginTop:1 }}>{d.stageLabel}{d.targetDate?` · 🎯 ${fmt(d.targetDate)}`:""}</div>
                  </div>
                  <span style={{ fontSize:10.5, padding:"2px 7px", borderRadius:20, background:d.dt.bg, color:d.dt.tx, fontWeight:600, flexShrink:0 }}>{d.dt.label}</span>
                </Link>
              ))}
            </div>

            {/* Relances */}
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"11px 14px", borderBottom:"1px solid var(--border)" }}>
                {relances.filter(r=>r.days>=30).length > 0 && <AlertTriangle size={12} color="var(--rec-tx)"/>}
                <span style={{ fontSize:11.5, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em" }}>
                  Relances{relances.filter(r=>r.days>=30).length > 0 ? ` (${relances.filter(r=>r.days>=30).length} urgentes)` : ""}
                </span>
              </div>
              {relances.length === 0 && <div style={{ padding:"20px", textAlign:"center", fontSize:13, color:"var(--text-5)" }}>✅ Aucune relance due</div>}
              {relances.slice(0,5).map((c,i) => (
                <Link key={c.id} href={`/protected/contacts/${c.id}`} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", borderBottom:i<Math.min(relances.length,5)-1?"1px solid var(--border)":"none", textDecoration:"none" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)" }}>{c.firstName} {c.lastName}</div>
                    {c.orgName && <div style={{ fontSize:11, color:"var(--text-5)" }}>{c.orgName}</div>}
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:c.days>=30?"var(--rec-tx)":"#B45309", flexShrink:0 }}>{c.days}j</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Colonne 2 : Calendrier */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
            {/* Header calendrier */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 14px", borderBottom:"1px solid var(--border)" }}>
              <button onClick={prevMonth} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-4)", padding:4 }}><ChevronLeft size={14}/></button>
              <span style={{ fontSize:13, fontWeight:700, color:"var(--text-1)", textTransform:"capitalize" }}>{monthLabel}</span>
              <button onClick={nextMonth} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-4)", padding:4 }}><ChevronRight size={14}/></button>
            </div>

            {/* Jours de la semaine */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"6px 10px 2px" }}>
              {["L","M","M","J","V","S","D"].map((d,i) => (
                <div key={i} style={{ textAlign:"center", fontSize:11, fontWeight:600, color:"var(--text-5)", padding:"3px 0" }}>{d}</div>
              ))}
            </div>

            {/* Grille jours */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, padding:"2px 10px 10px" }}>
              {/* Cellules vides */}
              {Array.from({length:startOffset}).map((_,i) => <div key={`e${i}`}/>)}
              {/* Jours */}
              {Array.from({length:daysInMonth}).map((_,i) => {
                const d = i+1;
                const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                const items = itemsByDate[dateStr] ?? [];
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                const hasTasks = items.some(x => x.type === "task");
                const hasEvents = items.some(x => x.type !== "task");
                return (
                  <button key={d} onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    style={{
                      padding:"5px 3px", borderRadius:7, border:`1.5px solid ${isSelected?"#1a56db":isToday?"#3b82f6":"transparent"}`,
                      background: isSelected?"#eff6ff":isToday?"rgba(59,130,246,.08)":"transparent",
                      cursor:"pointer", textAlign:"center", fontFamily:"inherit",
                    }}>
                    <div style={{ fontSize:12.5, fontWeight:isToday?700:400, color:isToday?"#1a56db":"var(--text-2)" }}>{d}</div>
                    {items.length > 0 && (
                      <div style={{ display:"flex", justifyContent:"center", gap:2, marginTop:2, flexWrap:"wrap" }}>
                        {hasTasks && <div style={{ width:5, height:5, borderRadius:3, background:"#6B7280" }}/>}
                        {hasEvents && <div style={{ width:5, height:5, borderRadius:3, background:"#1a56db" }}/>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Légende + bouton créer */}
            <div style={{ padding:"8px 14px", borderTop:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", gap:10, fontSize:11, color:"var(--text-5)" }}>
                <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:7,height:7,borderRadius:4,background:"#6B7280",display:"inline-block" }}/>Tâche</span>
                <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:7,height:7,borderRadius:4,background:"#1a56db",display:"inline-block" }}/>Événement</span>
              </div>
              <button onClick={() => { setActionModalDefaultType("meeting"); setActionModalOpen(true); }} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11.5, padding:"4px 10px", borderRadius:7, background:"#eff6ff", border:"1px solid #bfdbfe", color:"#1a56db", cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                <Plus size={11}/> Créer
              </button>
            </div>

            {/* Détail date sélectionnée */}
            {selectedDate && (
              <div style={{ borderTop:"1px solid var(--border)", padding:"10px 14px", maxHeight:200, overflowY:"auto" }}>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--text-3)", marginBottom:8 }}>
                  {fmtFull(selectedDate)}
                </div>
                {selectedItems.length === 0 ? (
                    <div style={{ fontSize:12.5, color:"var(--text-5)" }}>Rien ce jour — <button onClick={() => { setActionModalDefaultType("meeting"); setActionModalOpen(true); }} style={{ background:"none", border:"none", color:"#1a56db", cursor:"pointer", fontSize:12.5, fontFamily:"inherit" }}>créer un événement</button></div>
                ) : selectedItems.map((item,i) => (
                  <div key={i} onClick={() => { setActionModalDefaultType(item.type); setActionModalOpen(true); }} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:i<selectedItems.length-1?"1px solid var(--border)":"none", cursor:"pointer" }}>
                    <span style={{ fontSize:13 }}>{ACT_ICON[item.type]??"📌"}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12.5, fontWeight:600, color:"var(--text-1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
                      {(item.dealName||item.contactName) && <div style={{ fontSize:11, color:"var(--text-5)" }}>{[item.dealName,item.contactName].filter(Boolean).join(" · ")}</div>}
                    </div>
                    <div style={{ width:8, height:8, borderRadius:4, background:EVT_COLOR[item.type]??"#6B7280", flexShrink:0 }}/>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Colonne 3 : Tâches + Activités récentes */}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

            {/* Tâches */}
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
              <div style={{ padding:"11px 14px", borderBottom:"1px solid var(--border)" }}>
                <span style={{ fontSize:11.5, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em" }}>Tâches à faire</span>
              </div>
              {tasks.length === 0 && <div style={{ padding:"20px", textAlign:"center", fontSize:13, color:"var(--text-5)" }}>✅ Aucune tâche</div>}
              {tasks.map((t,i) => (
                <div key={t.id} onClick={() => { setActionModalDefaultType("task"); setActionModalOpen(true); }} style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 14px", borderBottom:i<tasks.length-1?"1px solid var(--border)":"none", cursor:"pointer" }}>
                  <div style={{ width:6, height:6, borderRadius:3, background:t.prioColor, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.title}</div>
                    {t.dealName && <div style={{ fontSize:11, color:"var(--text-5)" }}>{t.dealName}</div>}
                  </div>
                  {t.dueDate && <span style={{ fontSize:11, color:t.overdue?"var(--rec-tx)":"var(--text-5)", fontWeight:t.overdue?700:400, flexShrink:0 }}>{t.overdue?"⚠ ":""}{fmt(t.dueDate)}</span>}
                </div>
              ))}
            </div>

            {/* Activités récentes */}
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
              <div style={{ padding:"11px 14px", borderBottom:"1px solid var(--border)" }}>
                <span style={{ fontSize:11.5, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".06em" }}>Activités récentes</span>
              </div>
              {activities.length === 0 && <div style={{ padding:"20px", textAlign:"center", fontSize:13, color:"var(--text-5)" }}>Aucune activité récente</div>}
              {activities.map((a,i) => (
                <Link key={a.id} href={a.dealId?`/protected/dossiers/${a.dealId}`:"#"} style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 14px", borderBottom:i<activities.length-1?"1px solid var(--border)":"none", textDecoration:"none" }}>
                  <span style={{ fontSize:14, flexShrink:0 }}>{ACT_ICON[a.type]??"📌"}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.title}</div>
                    {a.dealName && <div style={{ fontSize:11, color:"var(--text-5)" }}>{a.dealName}</div>}
                  </div>
                  <span style={{ fontSize:11, color:"var(--text-5)", flexShrink:0 }}>{fmt(a.date)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ActionModal
        open={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        onSaved={() => { setActionModalOpen(false); router.refresh(); }}
        defaultType={actionModalDefaultType}
      />
    </div>
  );
}
