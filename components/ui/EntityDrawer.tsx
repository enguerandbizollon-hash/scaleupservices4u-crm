"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X, ArrowUpRight, Mail, Phone, Linkedin, Globe, MapPin,
  Building2, FolderOpen, User,
} from "lucide-react";
import {
  getContactSummary, getOrganizationSummary,
  type ContactSummary, type OrganizationSummary,
} from "@/actions/entity-summary";

export type EntityRef =
  | { type: "contact"; id: string }
  | { type: "organization"; id: string }
  | null;

export function EntityDrawer({ entity, onClose }: { entity: EntityRef; onClose: () => void }) {
  const [contact, setContact] = useState<ContactSummary | null>(null);
  const [org, setOrg] = useState<OrganizationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entity) {
      setContact(null);
      setOrg(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      if (entity.type === "contact") {
        const r = await getContactSummary(entity.id);
        if (cancelled) return;
        setContact(r.data);
        setOrg(null);
        setError(r.error);
      } else {
        const r = await getOrganizationSummary(entity.id);
        if (cancelled) return;
        setOrg(r.data);
        setContact(null);
        setError(r.error);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [entity?.type, entity?.id]);

  useEffect(() => {
    if (!entity) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entity, onClose]);

  const open = !!entity;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: open ? "rgba(0,0,0,.45)" : "rgba(0,0,0,0)",
          zIndex: 300,
          pointerEvents: open ? "auto" : "none",
          transition: "background .18s ease",
        }}
        aria-hidden={!open}
      />
      <aside
        style={{
          position: "fixed",
          top: 0, right: 0,
          height: "100vh",
          width: "min(100%, 460px)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border-2)",
          zIndex: 301,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform .22s ease",
          display: "flex",
          flexDirection: "column",
          boxShadow: "rgba(0,0,0,.15) -4px 0 24px",
        }}
        aria-hidden={!open}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid var(--border)",
        }}>
          <div style={{
            fontSize: 11.5, fontWeight: 700, color: "var(--text-5)",
            textTransform: "uppercase", letterSpacing: ".06em",
          }}>
            {entity?.type === "contact" ? "Contact" : entity?.type === "organization" ? "Organisation" : ""}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-4)", padding: 4 }}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {loading && <div style={{ color: "var(--text-5)", fontSize: 13 }}>Chargement.</div>}
          {error && <div style={{ color: "var(--rec-tx)", fontSize: 13 }}>Erreur : {error}</div>}
          {!loading && !error && !contact && !org && entity && (
            <div style={{ color: "var(--text-5)", fontSize: 13 }}>Aucune donnée trouvée.</div>
          )}
          {!loading && !error && contact && <ContactBody contact={contact} />}
          {!loading && !error && org && <OrgBody org={org} />}
        </div>

        {entity && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
            <Link
              href={entity.type === "contact" ? `/protected/contacts/${entity.id}` : `/protected/organisations/${entity.id}`}
              onClick={onClose}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8,
                background: "var(--surface-2)", border: "1px solid var(--border)",
                fontSize: 13, fontWeight: 600, color: "var(--text-2)",
                textDecoration: "none",
              }}
            >
              Ouvrir la fiche complète <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: "Actif", to_qualify: "À qualifier", inactive: "Inactif",
  priority: "Actif", qualified: "Actif", dormant: "Non qualifié", excluded: "Inactif",
};
const STATUS_BG: Record<string, { bg: string; tx: string }> = {
  active:     { bg: "#D1FAE5",          tx: "#065F46" },
  to_qualify: { bg: "var(--surface-3)", tx: "var(--text-4)" },
  inactive:   { bg: "#FEE2E2",          tx: "#991B1B" },
  priority:   { bg: "#D1FAE5",          tx: "#065F46" },
  qualified:  { bg: "#D1FAE5",          tx: "#065F46" },
  dormant:    { bg: "var(--surface-3)", tx: "var(--text-4)" },
  excluded:   { bg: "#FEE2E2",          tx: "#991B1B" },
};
const ORG_TYPE_LABEL: Record<string, string> = {
  client: "Client", prospect_client: "Prospect", investor: "Investisseur",
  buyer: "Repreneur", target: "Cible", law_firm: "Cabinet juridique",
  bank: "Banque", advisor: "Conseil", accounting_firm: "Expert-comptable",
  family_office: "Family Office", corporate: "Corporate",
  consulting_firm: "Cabinet de conseil", other: "Autre",
};
const DEAL_TYPE_LABEL: Record<string, string> = {
  fundraising: "Fundraising", ma_sell: "M&A Sell", ma_buy: "M&A Buy",
  cfo_advisor: "CFO Advisor", recruitment: "Recrutement",
};

function ContactBody({ contact }: { contact: ContactSummary }) {
  const sc = STATUS_BG[contact.base_status] ?? STATUS_BG.to_qualify;
  const initials = `${contact.first_name?.[0] ?? ""}${contact.last_name?.[0] ?? ""}`.toUpperCase();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "var(--surface-3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 700, color: "var(--text-2)", flexShrink: 0,
        }}>
          {initials || "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>
            {contact.first_name} {contact.last_name}
          </div>
          {contact.title && <div style={{ fontSize: 12.5, color: "var(--text-4)" }}>{contact.title}</div>}
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.tx }}>
              {STATUS_LABEL[contact.base_status] ?? contact.base_status}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
        {contact.email && (
          <a href={`mailto:${contact.email}`} style={infoRowStyle}>
            <Mail size={13} color="var(--text-4)" /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{contact.email}</span>
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`} style={infoRowStyle}>
            <Phone size={13} color="var(--text-4)" /><span>{contact.phone}</span>
          </a>
        )}
        {contact.linkedin_url && (
          <a href={contact.linkedin_url} target="_blank" rel="noreferrer" style={infoRowStyle}>
            <Linkedin size={13} color="var(--text-4)" /><span>LinkedIn</span>
          </a>
        )}
        {!contact.email && !contact.phone && !contact.linkedin_url && (
          <div style={{ fontSize: 12, color: "var(--text-5)", fontStyle: "italic" }}>Aucune coordonnée</div>
        )}
      </div>

      {contact.organizations.length > 0 && (
        <Section title={contact.organizations.length > 1 ? "Organisations" : "Organisation"}>
          {contact.organizations.map(o => (
            <Link key={o.id} href={`/protected/organisations/${o.id}`} style={linkRowStyle}>
              <Building2 size={13} color="var(--text-4)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
                {o.role_label && <div style={{ fontSize: 11.5, color: "var(--text-5)" }}>{o.role_label}</div>}
              </div>
            </Link>
          ))}
        </Section>
      )}
    </div>
  );
}

function OrgBody({ org }: { org: OrganizationSummary }) {
  const sc = STATUS_BG[org.base_status] ?? STATUS_BG.to_qualify;
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "var(--surface-3)", color: "var(--text-3)" }}>
            {ORG_TYPE_LABEL[org.organization_type] ?? org.organization_type}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.tx }}>
            {STATUS_LABEL[org.base_status] ?? org.base_status}
          </span>
          {org.is_client && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#DBEAFE", color: "#1E40AF" }}>Client actif</span>
          )}
          {org.investment_ticket && (
            <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: "var(--surface-2)", color: "var(--text-3)", border: "1px solid var(--border)" }}>
              {org.investment_ticket}
            </span>
          )}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>{org.name}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12.5, color: "var(--text-4)" }}>
          {org.sector && <span>{org.sector}</span>}
          {org.location && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <MapPin size={11} />{org.location}
            </span>
          )}
          {org.website && (
            <a
              href={org.website.startsWith("http") ? org.website : `https://${org.website}`}
              target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--text-3)", textDecoration: "none" }}
            >
              <Globe size={11} />{org.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </div>

      {org.contacts.length > 0 && (
        <Section title={`Contacts (${org.contacts.length})`}>
          {org.contacts.map(c => (
            <Link key={c.id} href={`/protected/contacts/${c.id}`} style={linkRowStyle}>
              <User size={13} color="var(--text-4)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.first_name} {c.last_name}
                </div>
                {(c.title || c.role_label) && (
                  <div style={{ fontSize: 11.5, color: "var(--text-5)" }}>
                    {c.title}{c.title && c.role_label ? " · " : ""}{c.role_label}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </Section>
      )}

      {org.deals.length > 0 && (
        <Section title={`Dossiers (${org.deals.length})`}>
          {org.deals.map(d => (
            <Link key={d.id} href={`/protected/dossiers/${d.id}`} style={linkRowStyle}>
              <FolderOpen size={13} color="var(--text-4)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-5)" }}>
                  {DEAL_TYPE_LABEL[d.deal_type] ?? d.deal_type}{d.deal_stage ? ` · ${d.deal_stage}` : ""}
                </div>
              </div>
            </Link>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "var(--text-5)",
        textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8,
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </div>
  );
}

const infoRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "8px 12px", borderRadius: 8,
  background: "var(--surface-2)", border: "1px solid var(--border)",
  fontSize: 12.5, color: "var(--text-2)", textDecoration: "none",
};
const linkRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "8px 10px", borderRadius: 8,
  background: "var(--surface-2)", border: "1px solid var(--border)",
  textDecoration: "none",
};
