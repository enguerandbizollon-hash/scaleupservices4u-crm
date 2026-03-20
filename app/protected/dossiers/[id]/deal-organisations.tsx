"use client";
import { useState, useEffect } from "react";
import { ExternalLink, Mail, Phone, Linkedin, Loader2, AlertCircle, Link2 } from "lucide-react";
import { StatusDropdown } from "../../components/status-dropdown";
import { FieldDropdown } from "../../components/field-dropdown";

type Contact = {
  id: string; first_name: string; last_name: string;
  email: string|null; phone: string|null; title: string|null;
  base_status: string; last_contact_date: string|null; linkedin_url: string|null;
};
type Org = {
  id: string; name: string; base_status: string; organization_type: string;
  location: string|null; website: string|null; sector: string|null;
  investment_ticket: string|null; investment_stage: string|null;
};
type Group = { org: Org; contacts: Contact[] };

const ORG_TYPE_LABELS: Record<string,string> = {
  investor:"Investisseur", family_office:"Family Office", bank:"Banque",
  advisor:"Conseil", law_firm:"Cabinet juridique", corporate:"Corporate",
  client:"Client", prospect_client:"Prospect", accounting_firm:"Cabinet compta",
  other:"Autre",
};

function alertLevel(date: string|null): "red"|"orange"|null {
  if (!date) return null;
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days > 30) return "red";
  if (days > 15) return "orange";
  return null;
}

function fmtDate(v: string|null) {
  if (!v) return null;
  try { return new Date(v).toLocaleDateString("fr-FR", { day:"numeric", month:"short" }); }
  catch { return v; }
}

export function DealOrganisations({ dealId }: { dealId: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [relinking, setRelinking] = useState(false);
  const [relinked, setRelinked] = useState<number|null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    const res = await fetch(`/api/deals/${dealId}/contacts`);
    const d = await res.json();
    setGroups(d.groups ?? []);
    setLoading(false);
    // Auto-expand toutes les orgs au premier chargement
    if (d.groups?.length) {
      setExpanded(new Set((d.groups as Group[]).map(g => g.org.id)));
    }
  }

  useEffect(() => { load(); }, [dealId]);

  async function handleRetroLink() {
    setRelinking(true);
    const res = await fetch(`/api/deals/${dealId}/retrolink`, { method: "POST" });
    const d = await res.json();
    setRelinked(d.linked ?? 0);
    setRelinking(false);
    setLoading(true);
    await load();
  }

  function toggleOrg(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:32, color:"var(--text-4)" }}>
      <Loader2 size={16} className="animate-spin"/> Chargement…
    </div>
  );

  const totalContacts = groups.reduce((a, g) => a + g.contacts.length, 0);
  const toRelance = groups.reduce((a, g) => a + g.contacts.filter(c => alertLevel(c.last_contact_date)).length, 0);
  const isInvestor = (type: string) => ["investor","family_office","bank","corporate"].includes(type);

  return (
    <div style={{ padding:"16px 0" }}>

      {/* Header toolbar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, gap:8, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <span className="stat-pill">{groups.length} organisation{groups.length > 1 ? "s" : ""}</span>
          <span className="stat-pill">{totalContacts} contact{totalContacts > 1 ? "s" : ""}</span>
          {toRelance > 0 && (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 10px", borderRadius:20, fontSize:11.5, fontWeight:700, background:"var(--sell-bg)", color:"var(--sell-tx)", border:"1px solid var(--sell-mid)" }}>
              <AlertCircle size={11}/> {toRelance} à relancer
            </span>
          )}
        </div>
        <button onClick={handleRetroLink} disabled={relinking} className="btn btn-secondary"
          style={{ fontSize:11.5, display:"flex", alignItems:"center", gap:5 }}>
          {relinking ? <Loader2 size={12} className="animate-spin"/> : <Link2 size={12}/>}
          {relinking ? "Liaison…" : "Synchroniser les liens"}
        </button>
        {relinked !== null && (
          <span style={{ fontSize:11, color:"var(--fund-tx)", fontWeight:600 }}>✓ {relinked} org{relinked > 1 ? "s" : ""} liée{relinked > 1 ? "s" : ""}</span>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontWeight:600, color:"var(--text-3)", marginBottom:8 }}>Aucune organisation liée</div>
          <div style={{ fontSize:12, color:"var(--text-5)", marginBottom:14 }}>Importez des organisations avec le nom de ce dossier, ou cliquez sur "Synchroniser les liens"</div>
          <button onClick={handleRetroLink} className="btn btn-primary" style={{ fontSize:12 }}>
            <Link2 size={12}/> Synchroniser maintenant
          </button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {groups.map(g => {
            const open = expanded.has(g.org.id);
            const inv  = isInvestor(g.org.organization_type);
            return (
              <div key={g.org.id} className="card" style={{ overflow:"hidden" }}>

                {/* ── En-tête organisation (cliquable) ── */}
                <div
                  onClick={() => toggleOrg(g.org.id)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px",
                    background:"var(--surface-2)", borderBottom: open ? "1px solid var(--border)" : "none",
                    cursor:"pointer", userSelect:"none" }}>

                  {/* Toggle arrow */}
                  <span style={{ fontSize:11, color:"var(--text-4)", transition:"transform .15s", transform: open ? "rotate(90deg)" : "" }}>▶</span>

                  {/* Nom + type */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <a href={`/protected/organisations/${g.org.id}`}
                        onClick={e => e.stopPropagation()}
                        style={{ fontWeight:700, fontSize:14, color:"var(--text-1)", textDecoration:"none", display:"flex", alignItems:"center", gap:4 }}>
                        {g.org.name}
                        <ExternalLink size={11} style={{ opacity:.35 }}/>
                      </a>
                      <span style={{ fontSize:10.5, color:"var(--text-4)", background:"var(--surface-3)", borderRadius:5, padding:"1px 7px" }}>
                        {ORG_TYPE_LABELS[g.org.organization_type] ?? g.org.organization_type}
                      </span>
                    </div>
                    <div style={{ display:"flex", gap:8, marginTop:3, fontSize:11, color:"var(--text-5)", flexWrap:"wrap" }}>
                      {g.org.location && <span>📍 {g.org.location}</span>}
                      {inv && g.org.investment_ticket && <span>💰 {g.org.investment_ticket}</span>}
                      {inv && g.org.investment_stage  && <span>📊 {g.org.investment_stage}</span>}
                    </div>
                  </div>

                  {/* Statut dropdown + nb contacts */}
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize:11, color:"var(--text-4)" }}>{g.contacts.length} contact{g.contacts.length > 1 ? "s" : ""}</span>
                    <StatusDropdown id={g.org.id} status={g.org.base_status} entity="organisations" size="sm"/>
                  </div>
                </div>

                {/* ── Contacts (aperçu) ── */}
                {open && (
                  <div>
                    {g.contacts.map((c, ci) => {
                      const alert  = alertLevel(c.last_contact_date);
                      const name   = `${c.first_name} ${c.last_name}`.trim();
                      return (
                        <div key={c.id} style={{
                          display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
                          borderBottom: ci < g.contacts.length-1 ? "1px solid var(--border)" : "none",
                          background: alert === "red" ? "#FFF8F8" : alert === "orange" ? "#FFFCF5" : "var(--surface)",
                        }}>
                          {/* Alert indicator */}
                          {alert && <div style={{ width:6, height:6, borderRadius:"50%", flexShrink:0,
                            background: alert === "red" ? "var(--rec-dot)" : "var(--sell-dot)"
                          }} title={alert === "red" ? "> 30j sans contact" : "> 15j sans contact"}/>}

                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                              <span style={{ fontWeight:600, fontSize:13, color:"var(--text-1)" }}>{name}</span>
                              {c.title && <span style={{ fontSize:11.5, color:"var(--text-4)" }}>{c.title}</span>}
                              <StatusDropdown id={c.id} status={c.base_status} entity="contacts" size="sm"/>
                            </div>
                            {c.last_contact_date && (
                              <div style={{ fontSize:11, marginTop:2,
                                color: alert === "red" ? "var(--rec-tx)" : alert === "orange" ? "var(--sell-tx)" : "var(--text-5)",
                                fontWeight: alert ? 600 : 400 }}>
                                📅 {fmtDate(c.last_contact_date)}
                                {alert === "red" && " · +30j sans réponse"}
                                {alert === "orange" && " · +15j sans réponse"}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                            {c.email && <a href={`mailto:${c.email}`} className="btn-icon" style={{ width:26, height:26 }}><Mail size={11}/></a>}
                            {c.phone && <a href={`tel:${c.phone}`} className="btn-icon" style={{ width:26, height:26 }}><Phone size={11}/></a>}
                            {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="btn-icon" style={{ width:26, height:26, color:"#0A66C2" }}><Linkedin size={11}/></a>}
                          </div>
                        </div>
                      );
                    })}

                    {g.contacts.length === 0 && (
                      <div style={{ padding:"12px 16px", fontSize:12, color:"var(--text-5)", fontStyle:"italic" }}>
                        Aucun contact pour cette organisation
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
