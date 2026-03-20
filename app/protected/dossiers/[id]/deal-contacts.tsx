"use client";
import { useState, useEffect } from "react";
import { Mail, Phone, Linkedin, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { StatusDropdown } from "../../components/status-dropdown";

type Contact = {
  id: string; first_name: string; last_name: string; full_name: string;
  email: string | null; phone: string | null; title: string | null;
  base_status: string; last_contact_date: string | null; linkedin_url: string | null;
  role_label: string | null;
};
type Group = { org: { id: string; name: string; base_status: string; organization_type: string }; contacts: Contact[] };

function fmtDate(v: string | null) {
  if (!v) return null;
  try { return new Date(v).toLocaleDateString("fr-FR", { day:"numeric", month:"short", year:"numeric" }); }
  catch { return v; }
}

function alertLevel(date: string | null): "red" | "orange" | null {
  if (!date) return null;
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days > 30) return "red";
  if (days > 15) return "orange";
  return null;
}

export function DealContacts({ dealId }: { dealId: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [relinking, setRelinking] = useState(false);
  const [relinked, setRelinked] = useState<number | null>(null);

  async function handleRetroLink() {
    setRelinking(true);
    const res = await fetch(`/api/deals/${dealId}/retrolink`, { method: "POST" });
    const d = await res.json();
    setRelinked(d.linked ?? 0);
    setRelinking(false);
    // Recharger
    const res2 = await fetch(`/api/deals/${dealId}/contacts`);
    const d2 = await res2.json();
    setGroups(d2.groups ?? []);
  }

  useEffect(() => {
    fetch(`/api/deals/${dealId}/contacts`)
      .then(r => r.json())
      .then(d => { setGroups(d.groups ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [dealId]);

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:32, color:"var(--text-4)" }}>
      <Loader2 size={16} className="animate-spin"/> Chargement des contacts…
    </div>
  );

  if (groups.length === 0) return (
    <div className="empty-state" style={{ margin:16 }}>
      <div style={{ fontWeight:600, color:"var(--text-3)" }}>Aucun contact lié à ce dossier</div>
      <div style={{ fontSize:12, color:"var(--text-5)", marginTop:6 }}>Importez des contacts liés aux organisations du dossier</div>
    </div>
  );

  const totalContacts = groups.reduce((acc, g) => acc + g.contacts.length, 0);
  const toFollowUp = groups.reduce((acc, g) => acc + g.contacts.filter(c => alertLevel(c.last_contact_date) !== null).length, 0);

  return (
    <div style={{ padding:"16px 0" }}>
      {/* Bouton liaison rétroactive */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:8 }}>
        <div style={{ fontSize:12.5, color:"var(--text-4)" }}>
          Contacts et organisations liés à ce dossier
        </div>
        <button onClick={handleRetroLink} disabled={relinking}
          className="btn btn-secondary btn-sm"
          style={{ fontSize:11.5, display:"flex", alignItems:"center", gap:5 }}>
          {relinking ? <Loader2 size={12} className="animate-spin"/> : "🔗"}
          {relinking ? "Liaison en cours…" : "Lier les organisations"}
        </button>
        {relinked !== null && (
          <span style={{ fontSize:11.5, color:"var(--fund-tx)", fontWeight:600 }}>
            ✓ {relinked} organisation{relinked > 1 ? "s" : ""} liée{relinked > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Summary bar */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <span className="stat-pill">{totalContacts} contact{totalContacts > 1 ? "s" : ""}</span>
        <span className="stat-pill">{groups.length} organisation{groups.length > 1 ? "s" : ""}</span>
        {toFollowUp > 0 && (
          <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:20, fontSize:11.5, fontWeight:700, background:"var(--sell-bg)", color:"var(--sell-tx)", border:"1px solid var(--sell-mid)" }}>
            <AlertCircle size={12}/> {toFollowUp} à relancer
          </span>
        )}
      </div>

      {/* Groups par organisation */}
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {groups.map(g => (
          <div key={g.org.id} className="card" style={{ overflow:"hidden" }}>
            {/* Org header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:"var(--surface-2)", borderBottom:"1px solid var(--border)" }}>
              <a href={`/protected/organisations/${g.org.id}`}
                style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none", color:"var(--text-1)", fontWeight:700, fontSize:14 }}>
                🏢 {g.org.name}
                <ExternalLink size={11} style={{ opacity:.4 }}/>
              </a>
              <StatusDropdown id={g.org.id} status={g.org.base_status} entity="organisations" size="sm"/>
            </div>

            {/* Contacts */}
            <div>
              {g.contacts.map(c => {
                const alert = alertLevel(c.last_contact_date);
                const fullName = c.full_name || `${c.first_name} ${c.last_name}`.trim();
                return (
                  <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px", borderBottom:"1px solid var(--border)", background: alert === "red" ? "#FFF8F8" : alert === "orange" ? "#FFFCF4" : "var(--surface)" }}>
                    {/* Alert dot */}
                    {alert && (
                      <div style={{ width:7, height:7, borderRadius:"50%", background: alert === "red" ? "var(--rec-dot)" : "var(--sell-dot)", flexShrink:0 }} title={alert === "red" ? "Plus de 30j sans contact" : "Plus de 15j sans contact"}/>
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <span style={{ fontWeight:600, fontSize:13.5, color:"var(--text-1)" }}>{fullName}</span>
                        <StatusDropdown id={c.id} status={c.base_status} entity="contacts" size="sm"/>
                      </div>
                      <div style={{ display:"flex", gap:8, marginTop:3, fontSize:11.5, color:"var(--text-4)", flexWrap:"wrap", alignItems:"center" }}>
                        {c.title && <span>{c.title}</span>}
                        {c.last_contact_date && (
                          <span style={{ color: alert === "red" ? "var(--rec-tx)" : alert === "orange" ? "var(--sell-tx)" : "var(--text-4)", fontWeight: alert ? 600 : 400 }}>
                            📅 {fmtDate(c.last_contact_date)}
                            {alert === "red" && " · +30j sans réponse"}
                            {alert === "orange" && " · +15j sans réponse"}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                      {c.email && <a href={`mailto:${c.email}`} className="btn-icon" style={{ width:28, height:28 }}><Mail size={12}/></a>}
                      {c.phone && <a href={`tel:${c.phone}`} className="btn-icon" style={{ width:28, height:28 }}><Phone size={12}/></a>}
                      {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="btn-icon" style={{ width:28, height:28, color:"#0A66C2" }}><Linkedin size={12}/></a>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
