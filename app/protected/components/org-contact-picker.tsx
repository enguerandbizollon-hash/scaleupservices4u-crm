"use client";

import React, { useState, useEffect } from "react";
import { Search, Building, User, AlertCircle } from "lucide-react";

interface ContactOption {
  contactId: string;
  firstName: string;
  lastName: string;
  email?: string;
  title?: string;
  organizationId?: string;
  organizationName?: string;
  role?: string;
  isPrimary?: boolean;
}

interface OrgContactPickerProps {
  organizationId?: string;
  contactIds?: string[];
  onOrgChange?: (orgId: string) => void;
  onContactsChange?: (contactIds: string[]) => void;
  multiSelect?: boolean;
  label?: string;
  hideOrgSelection?: boolean;
  style?: React.CSSProperties;
}

/**
 * OrganisationContactPicker
 *
 * Deux modes :
 * 1. Sélectionner une org, puis des contacts dans cette org
 * 2. Multi-contact picker avec filtre par org
 *
 * Utilise RPC search_contacts_by_org() pour la recherche
 */
export function OrgContactPicker({
  organizationId,
  contactIds = [],
  onOrgChange,
  onContactsChange,
  multiSelect = false,
  label = "Contact",
  hideOrgSelection = false,
  style
}: OrgContactPickerProps) {
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState(organizationId || "");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(contactIds);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Charger les organisations
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await fetch("/api/organisations");
        if (res.ok) {
          const data = await res.json();
          setOrganizations(data.organisations || []);
        }
      } catch (err) {
        console.error("Error fetching organisations:", err);
      }
    };
    fetchOrgs();
  }, []);

  // Charger les contacts de l'org sélectionnée
  useEffect(() => {
    if (!selectedOrgId || hideOrgSelection) return;

    const fetchContacts = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search/contacts-by-org?org_id=${selectedOrgId}&query=${encodeURIComponent(searchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setContacts(data.contacts || []);
        }
      } catch (err) {
        console.error("Error fetching contacts:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [selectedOrgId, searchQuery, hideOrgSelection]);

  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    setSelectedContactIds([]);
    onOrgChange?.(orgId);
  };

  const handleContactToggle = (contactId: string) => {
    let newIds: string[];
    if (multiSelect) {
      newIds = selectedContactIds.includes(contactId)
        ? selectedContactIds.filter(id => id !== contactId)
        : [...selectedContactIds, contactId];
    } else {
      newIds = selectedContactIds[0] === contactId ? [] : [contactId];
    }
    setSelectedContactIds(newIds);
    onContactsChange?.(newIds);
  };

  const selectedOrgName = organizations.find(o => o.id === selectedOrgId)?.name;
  const displayContacts = contacts.filter(c =>
    !searchQuery || 
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  const inpStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--surface-2)",
    color: "var(--text-1)",
    fontSize: 13.5,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    ...style,
  };

  return (
    <div style={containerStyle}>
      {/* 1. Sélection Organisation */}
      {!hideOrgSelection && (
        <div>
          <label
            style={{
              display: "block",
              fontSize: "11.5px",
              fontWeight: 600,
              color: "var(--text-4)",
              marginBottom: 5,
              textTransform: "uppercase",
            }}
          >
            Organisation
          </label>
          <select
            value={selectedOrgId}
            onChange={e => handleOrgChange(e.target.value)}
            style={inpStyle}
          >
            <option value="">— Sélectionner une organisation</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 2. Sélection Contacts (visible si org sélectionnée) */}
      {(selectedOrgId || hideOrgSelection) && (
        <div>
          <label
            style={{
              display: "block",
              fontSize: "11.5px",
              fontWeight: 600,
              color: "var(--text-4)",
              marginBottom: 5,
              textTransform: "uppercase",
            }}
          >
            {label}
          </label>

          {/* Recherche */}
          <div
            style={{
              position: "relative",
              marginBottom: 8,
            }}
          >
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-4)",
              }}
            />
            <input
              type="text"
              placeholder="Chercher un contact..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                ...inpStyle,
                paddingLeft: 36,
              }}
            />
          </div>

          {/* Liste des contacts */}
          <div
            style={{
              maxHeight: 280,
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface-3)",
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: 16,
                  textAlign: "center",
                  color: "var(--text-4)",
                  fontSize: 13,
                }}
              >
                Chargement...
              </div>
            ) : displayContacts.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  textAlign: "center",
                  color: "var(--text-4)",
                  fontSize: 13,
                }}
              >
                Aucun contact trouvé
              </div>
            ) : (
              displayContacts.map(contact => (
                <div
                  key={contact.contactId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 10,
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    background: selectedContactIds.includes(contact.contactId)
                      ? "var(--su-500)"
                      : "transparent",
                    color: selectedContactIds.includes(contact.contactId)
                      ? "#fff"
                      : "var(--text-1)",
                  }}
                  onClick={() => handleContactToggle(contact.contactId)}
                >
                  <input
                    type={multiSelect ? "checkbox" : "radio"}
                    checked={selectedContactIds.includes(contact.contactId)}
                    onChange={() => {}}
                    style={{
                      cursor: "pointer",
                      accentColor: "var(--su-500)",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: 13,
                      }}
                    >
                      {contact.firstName} {contact.lastName}
                    </div>
                    {contact.email && (
                      <div
                        style={{
                          fontSize: 11,
                          color: selectedContactIds.includes(contact.contactId)
                            ? "rgba(255,255,255,0.7)"
                            : "var(--text-4)",
                        }}
                      >
                        {contact.email}
                      </div>
                    )}
                  </div>
                  {contact.isPrimary && (
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 600,
                        background: selectedContactIds.includes(contact.contactId)
                          ? "rgba(255,255,255,0.2)"
                          : "var(--accent)",
                        color: selectedContactIds.includes(contact.contactId)
                          ? "#fff"
                          : "var(--accent-text)",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      PRIMARY
                    </span>
                  )}
                  {contact.role && (
                    <span
                      style={{
                        fontSize: "10px",
                        color: selectedContactIds.includes(contact.contactId)
                          ? "rgba(255,255,255,0.7)"
                          : "var(--text-4)",
                      }}
                    >
                      {contact.role}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. Affichage des sélections */}
      {selectedContactIds.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 4,
          }}
        >
          {selectedContactIds.map(id => {
            const contact = contacts.find(c => c.contactId === id);
            return (
              <div
                key={id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  background: "var(--su-500)",
                  color: "#fff",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <User size={12} />
                {contact?.firstName} {contact?.lastName}
                <button
                  onClick={() => handleContactToggle(id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
