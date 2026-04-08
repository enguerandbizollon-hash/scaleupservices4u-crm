"use client";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Linkedin, MapPin, ChevronRight, Building2 } from "lucide-react";
import { StatusDropdown } from "../../components/status-dropdown";
import { EnrichButton } from "../../components/enrich-button";
import ActionTimeline from "@/components/actions/ActionTimeline";
import { ContactOrgAssignmentWarning } from "../../components/contact-org-assignment-warning";
import { TagInput } from "@/components/tags/TagInput";
import { GEO_LABELS } from "@/lib/crm/matching-maps";

const STATUS_COLORS: Record<string,{bg:string,tx:string}> = {
  active:     {bg:"var(--fund-bg)", tx:"var(--fund-tx)"},
  priority:   {bg:"var(--rec-bg)",  tx:"var(--rec-tx)"},
  qualified:  {bg:"var(--sell-bg)", tx:"var(--sell-tx)"},
  to_qualify: {bg:"var(--surface-3)",tx:"var(--text-4)"},
  dormant:    {bg:"var(--surface-3)",tx:"var(--text-4)"},
  inactive:   {bg:"var(--surface-3)",tx:"var(--text-5)"},
  excluded:   {bg:"var(--rec-bg)",   tx:"var(--rec-tx)"},
};
const STATUS_LABELS: Record<string,string> = {
  active:"Actif", priority:"Prioritaire", qualified:"Qualifié",
  to_qualify:"À qualifier", dormant:"Dormant", inactive:"Inactif", excluded:"Exclu",
};
const TYPE_LABELS: Record<string,string> = {
  investor:"Investisseur", family_office:"Family Office", corporate:"Corporate",
  bank:"Banque", advisor:"Conseil", other:"Autre",
};
function daysSince(d: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day:"2-digit", month:"short", year:"numeric" }).format(new Date(d));
}

export function ContactDetail({ contact, orgs }: { contact: any; orgs: any[] }) {
  const sc = STATUS_COLORS[contact.base_status] ?? STATUS_COLORS.to_qualify;
  const days = daysSince(contact.last_contact_date);
  const initials = `${contact.first_name?.[0] ?? ""}${contact.last_name?.[0] ?? ""}`.toUpperCase();
  const needsOrgAssignment = !contact.primary_organization_id;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 24px" }}>
      <Link href="/protected/contacts" style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12.5, color:"var(--text-4)", textDecoration:"none", marginBottom:20 }}>
        <ArrowLeft size={13}/> Contacts
      </Link>

      {/* Header */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, padding:"24px 28px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
          {/* Avatar */}
          <div style={{ width:52, height:52, borderRadius:14, background:"var(--surface-3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, color:"var(--text-2)", flexShrink:0 }}>
            {initials}
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
              <span style={{ fontSize:11.5, fontWeight:600, padding:"3px 10px", borderRadius:20, background:sc.bg, color:sc.tx }}>
                {STATUS_LABELS[contact.base_status] ?? contact.base_status}
              </span>
              {days !== null && days > 15 && (
                <span style={{ fontSize:11.5, fontWeight:600, padding:"3px 10px", borderRadius:20, background: days > 30 ? "var(--rec-bg)" : "#FEF3C7", color: days > 30 ? "var(--rec-tx)" : "#92400E" }}>
                  ⚠ {days}j sans contact
                </span>
              )}
            </div>

            <h1 style={{ fontSize:22, fontWeight:700, color:"var(--text-1)", margin:"0 0 6px" }}>
              {contact.first_name} {contact.last_name}
            </h1>

            <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 14px", fontSize:13, color:"var(--text-4)" }}>
              {contact.title && <span>{contact.title}</span>}
              {contact.sector && <span>{contact.sector}</span>}
              {contact.country && <span style={{ display:"flex", alignItems:"center", gap:4 }}><MapPin size={11}/>{GEO_LABELS[contact.country] ?? contact.country}</span>}
            </div>

            {contact.last_contact_date && (
              <div style={{ fontSize:12.5, color:"var(--text-5)", marginTop:6 }}>
                Dernier contact : {fmtDate(contact.last_contact_date)}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end", flexShrink:0 }}>
            <div style={{ display:"flex", gap:8 }}>
              <StatusDropdown id={contact.id} status={contact.base_status} entity="contacts" size="sm"/>
              <EnrichButton id={contact.id} type="contact" size="sm"/>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {contact.email && (
                <a href={`mailto:${contact.email}`}
                  style={{ padding:"6px 12px", borderRadius:8, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", gap:5, fontSize:12.5, color:"var(--text-2)", textDecoration:"none" }}>
                  <Mail size={12}/> {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`}
                  style={{ padding:"6px 12px", borderRadius:8, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", gap:5, fontSize:12.5, color:"var(--text-2)", textDecoration:"none" }}>
                  <Phone size={12}/> {contact.phone}
                </a>
              )}
              {contact.linkedin_url && (
                <a href={contact.linkedin_url} target="_blank" rel="noreferrer"
                  style={{ width:30, height:30, borderRadius:8, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-3)", textDecoration:"none" }}>
                  <Linkedin size={13}/>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"14px 20px", marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"var(--text-5)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>Tags</div>
        <TagInput objectType="contact" objectId={contact.id} />
      </div>

      {/* Alerte assignation organisation primaire */}
      {needsOrgAssignment && (
        <ContactOrgAssignmentWarning
          showAlert={needsOrgAssignment}
          contactName={`${contact.first_name} ${contact.last_name}`}
        />
      )}

      {/* Organisations liées */}
      {orgs.length > 0 && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, marginBottom:14, overflow:"hidden" }}>
          <div style={{ padding:"12px 20px", borderBottom:"1px solid var(--border)", fontSize:12, fontWeight:600, color:"var(--text-4)", textTransform:"uppercase", letterSpacing:".06em" }}>
            Organisation{orgs.length > 1 ? "s" : ""}
          </div>
          {orgs.map((o, i) => (
            <Link key={o.id} href={`/protected/organisations/${o.id}`} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px",
              borderBottom: i < orgs.length-1 ? "1px solid var(--border)" : "none",
              textDecoration:"none", transition:"background .1s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:"var(--surface-3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Building2 size={13} color="var(--text-4)"/>
                </div>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text-1)" }}>{o.name}</div>
                  <div style={{ fontSize:12, color:"var(--text-4)" }}>
                    {TYPE_LABELS[o.organization_type] ?? o.organization_type}
                    {o.location ? ` · ${o.location}` : ""}
                    {o.role_label ? ` · ${o.role_label}` : ""}
                  </div>
                </div>
              </div>
              <ChevronRight size={14} color="var(--text-5)"/>
            </Link>
          ))}
        </div>
      )}

      {/* Activités (ActionTimeline) */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"4px 20px 20px" }}>
        <ActionTimeline filters={{ contact_id: contact.id }} />
      </div>
    </div>
  );
}
