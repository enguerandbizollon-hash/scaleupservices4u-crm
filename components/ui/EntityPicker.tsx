"use client";

import { useEffect, useState } from "react";
import { Search, Plus, User, Building2 } from "lucide-react";
import { getAllContactsSimple, createContact } from "@/actions/contacts";
import { getAllOrganisationsSimple, createOrganisationMinimal } from "@/actions/organisations";

export type PickerEntityType = "contact" | "organization";

type Item = { id: string; label: string; subtitle?: string };

const ORG_TYPE_OPTIONS = [
  { value: "other", label: "Type d'organisation" },
  { value: "client", label: "Client" },
  { value: "prospect_client", label: "Prospect" },
  { value: "investor", label: "Investisseur" },
  { value: "family_office", label: "Family Office" },
  { value: "corporate", label: "Corporate" },
  { value: "buyer", label: "Repreneur" },
  { value: "target", label: "Cible M&A" },
  { value: "bank", label: "Banque" },
  { value: "advisor", label: "Conseil" },
  { value: "law_firm", label: "Cabinet juridique" },
  { value: "accounting_firm", label: "Expert-comptable" },
  { value: "consulting_firm", label: "Cabinet de conseil" },
];

export function EntityPicker({
  entityType,
  onPicked,
  placeholder,
  excludeIds = [],
  autoFocus = true,
  disableCreate = false,
}: {
  entityType: PickerEntityType;
  onPicked: (id: string, label: string) => void | Promise<void>;
  placeholder?: string;
  excludeIds?: string[];
  autoFocus?: boolean;
  disableCreate?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState("other");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      if (entityType === "contact") {
        const list = await getAllContactsSimple();
        if (cancelled) return;
        setItems(
          list.map((c) => ({
            id: c.id,
            label: `${c.first_name} ${c.last_name}`,
            subtitle: c.email ?? undefined,
          }))
        );
      } else {
        const list = await getAllOrganisationsSimple();
        if (cancelled) return;
        setItems(list.map((o) => ({ id: o.id, label: o.name })));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entityType]);

  function openCreate() {
    if (entityType === "contact") {
      const parts = query.trim().split(/\s+/);
      setFirstName(parts[0] ?? "");
      setLastName(parts.slice(1).join(" "));
      setEmail("");
    } else {
      setName(query.trim());
      setOrgType("other");
    }
    setError(null);
    setCreateOpen(true);
  }

  function cancelCreate() {
    setCreateOpen(false);
    setError(null);
    setFirstName(""); setLastName(""); setEmail("");
    setName(""); setOrgType("other");
  }

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      if (entityType === "contact") {
        const fn = firstName.trim();
        const ln = lastName.trim();
        if (!fn || !ln) {
          setError("Prénom et nom requis.");
          setCreating(false);
          return;
        }
        const res = await createContact({
          first_name: fn,
          last_name: ln,
          email: email.trim() || null,
        });
        if (!res.success) {
          setError(res.error);
          setCreating(false);
          return;
        }
        await onPicked(res.id, `${fn} ${ln}`);
        cancelCreate();
        setQuery("");
      } else {
        const n = name.trim();
        if (!n) {
          setError("Nom requis.");
          setCreating(false);
          return;
        }
        const res = await createOrganisationMinimal({ name: n, organization_type: orgType });
        if (!res.success) {
          setError(res.error);
          setCreating(false);
          return;
        }
        await onPicked(res.id, n);
        cancelCreate();
        setQuery("");
      }
    } finally {
      setCreating(false);
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = items
    .filter((i) => !excludeIds.includes(i.id))
    .filter((i) => (q.length >= 1 ? i.label.toLowerCase().includes(q) : true))
    .slice(0, 8);

  const canCreate = !disableCreate && query.trim().length >= 2;
  const showCreatePrompt = canCreate && filtered.length === 0;

  if (createOpen) {
    return (
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          {entityType === "contact" ? "Nouveau contact" : "Nouvelle organisation"}
        </div>
        {entityType === "contact" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Prénom"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
              />
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Nom"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <input
              style={inputStyle}
              placeholder="Email (optionnel)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              style={inputStyle}
              placeholder="Nom de l'organisation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <select style={inputStyle} value={orgType} onChange={(e) => setOrgType(e.target.value)}>
              {ORG_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
        {error && <div style={{ fontSize: 12, color: "var(--rec-tx)", marginTop: 8 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            style={primaryBtnStyle(creating)}
          >
            {creating ? "Création..." : "Créer"}
          </button>
          <button
            type="button"
            onClick={cancelCreate}
            disabled={creating}
            style={secondaryBtnStyle}
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: "relative" }}>
        <Search
          size={13}
          color="var(--text-5)"
          style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? (entityType === "contact" ? "Rechercher ou créer un contact" : "Rechercher ou créer une organisation")}
          style={{ ...inputStyle, paddingLeft: 32 }}
          autoFocus={autoFocus}
        />
      </div>

      {loading ? (
        <div style={{ padding: 12, color: "var(--text-5)", fontSize: 12.5 }}>Chargement...</div>
      ) : (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto" }}>
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onPicked(item.id, item.label)}
              style={resultRowStyle}
            >
              {entityType === "contact" ? (
                <User size={13} color="var(--text-4)" />
              ) : (
                <Building2 size={13} color="var(--text-4)" />
              )}
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{item.label}</div>
                {item.subtitle && (
                  <div style={{ fontSize: 11.5, color: "var(--text-5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.subtitle}
                  </div>
                )}
              </div>
            </button>
          ))}
          {showCreatePrompt && (
            <button type="button" onClick={openCreate} style={createPromptStyle}>
              <Plus size={13} />
              <span>
                Créer "<strong>{query.trim()}</strong>"
              </span>
            </button>
          )}
          {filtered.length === 0 && !canCreate && q.length === 0 && items.length === 0 && (
            <div style={{ padding: 12, color: "var(--text-5)", fontSize: 12.5, fontStyle: "italic" }}>
              Aucune entrée. Tape au moins 2 caractères pour créer.
            </div>
          )}
          {filtered.length === 0 && !canCreate && q.length === 0 && items.length > 0 && (
            <div style={{ padding: 12, color: "var(--text-5)", fontSize: 12.5 }}>
              Tape pour rechercher parmi {items.length} entrée{items.length > 1 ? "s" : ""}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface-2)",
  color: "var(--text-1)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-4)",
  textTransform: "uppercase",
  letterSpacing: ".05em",
  marginBottom: 10,
};

const resultRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "8px 11px",
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  cursor: "pointer",
  fontFamily: "inherit",
};

const createPromptStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px dashed var(--accent, #1a56db)",
  background: "var(--surface)",
  cursor: "pointer",
  fontFamily: "inherit",
  color: "var(--accent, #1a56db)",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "left",
};

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "var(--accent, #1a56db)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
  };
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-3)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
