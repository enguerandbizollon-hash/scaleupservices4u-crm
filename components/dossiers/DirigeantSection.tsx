"use client";
import { useState } from "react";
import { User, Mail, Phone, Pencil, Check, X, Plus, ExternalLink } from "lucide-react";
import { updateDealDirigeant } from "@/actions/deals";
import { createContact, getAllContactsSimple } from "@/actions/contacts";
import Link from "next/link";

interface DirigeantData {
  dirigeant_id: string | null;
  dirigeant_nom: string | null;
  dirigeant_email: string | null;
  dirigeant_telephone: string | null;
  dirigeant_titre: string | null;
}

interface DirigeantSectionProps {
  dealId: string;
  initial: DirigeantData;
  organizationId?: string;
}

type ContactOption = { id: string; first_name: string; last_name: string; email: string | null };

const inp: React.CSSProperties = {
  width: "100%", padding: "7px 10px", border: "1px solid var(--border)",
  borderRadius: 8, background: "var(--surface-2)", color: "var(--text-1)",
  fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-4)",
  marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em",
};

export function DirigeantSection({ dealId, initial, organizationId }: DirigeantSectionProps) {
  const [data, setData] = useState<DirigeantData>(initial);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create contact form
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTitle, setNewTitle] = useState("");

  async function loadContacts() {
    const list = await getAllContactsSimple();
    setContacts(list);
  }

  function startEdit() {
    setEditing(true);
    loadContacts();
  }

  async function selectContact(c: ContactOption) {
    setSaving(true);
    const newData: DirigeantData = {
      dirigeant_id: c.id,
      dirigeant_nom: `${c.first_name} ${c.last_name}`,
      dirigeant_email: c.email,
      dirigeant_telephone: null,
      dirigeant_titre: null,
    };
    await updateDealDirigeant(dealId, newData);
    setData(newData);
    setEditing(false);
    setSearch("");
    setSaving(false);
  }

  async function handleCreateAndSelect() {
    if (!newFirst.trim() || !newLast.trim()) return;
    setSaving(true);
    const res = await createContact({
      first_name: newFirst.trim(),
      last_name: newLast.trim(),
      email: newEmail.trim() || null,
      phone: newPhone.trim() || null,
      title: newTitle.trim() || null,
    });
    if (res.success) {
      const newData: DirigeantData = {
        dirigeant_id: res.id,
        dirigeant_nom: `${newFirst.trim()} ${newLast.trim()}`,
        dirigeant_email: newEmail.trim() || null,
        dirigeant_telephone: newPhone.trim() || null,
        dirigeant_titre: newTitle.trim() || null,
      };
      await updateDealDirigeant(dealId, newData);
      setData(newData);
      setShowCreate(false);
      setEditing(false);
    }
    setSaving(false);
  }

  async function handleSaveManual() {
    setSaving(true);
    await updateDealDirigeant(dealId, data);
    setEditing(false);
    setSaving(false);
  }

  async function removeDirigeant() {
    setSaving(true);
    const empty: DirigeantData = { dirigeant_id: null, dirigeant_nom: null, dirigeant_email: null, dirigeant_telephone: null, dirigeant_titre: null };
    await updateDealDirigeant(dealId, empty);
    setData(empty);
    setSaving(false);
  }

  const filtered = search.trim().length >= 2
    ? contacts.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) || (c.email ?? "").toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];

  const noResults = search.trim().length >= 2 && filtered.length === 0;

  // Display mode
  if (!editing && !showCreate) {
    if (!data.dirigeant_nom) {
      return (
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <User size={14} color="var(--text-5)" />
            <span style={{ fontSize: 13, color: "var(--text-5)" }}>Aucun dirigeant renseigne</span>
          </div>
          <button onClick={startEdit} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface-2)", color: "var(--text-3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            <Plus size={11} /> Ajouter
          </button>
        </div>
      );
    }

    return (
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--text-3)", flexShrink: 0 }}>
              {(data.dirigeant_nom ?? "").split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>{data.dirigeant_nom}</span>
                {data.dirigeant_titre && <span style={{ fontSize: 12, color: "var(--text-4)" }}>{data.dirigeant_titre}</span>}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                {data.dirigeant_email && (
                  <a href={`mailto:${data.dirigeant_email}`} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "var(--text-3)", textDecoration: "none" }}>
                    <Mail size={11} /> {data.dirigeant_email}
                  </a>
                )}
                {data.dirigeant_telephone && (
                  <a href={`tel:${data.dirigeant_telephone}`} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "var(--text-3)", textDecoration: "none" }}>
                    <Phone size={11} /> {data.dirigeant_telephone}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {data.dirigeant_id && (
              <Link href={`/protected/contacts/${data.dirigeant_id}`} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-4)" }} title="Voir la fiche contact">
                <ExternalLink size={11} />
              </Link>
            )}
            <button onClick={startEdit} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-4)" }} title="Modifier">
              <Pencil size={11} />
            </button>
            <button onClick={removeDirigeant} disabled={saving} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-5)" }} title="Retirer">
              <X size={11} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create mode
  if (showCreate) {
    return (
      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", marginBottom: 10 }}>Creer un nouveau contact</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div><label style={lbl}>Prenom *</label><input value={newFirst} onChange={e => setNewFirst(e.target.value)} style={inp} placeholder="Jean" /></div>
          <div><label style={lbl}>Nom *</label><input value={newLast} onChange={e => setNewLast(e.target.value)} style={inp} placeholder="Dupont" /></div>
          <div><label style={lbl}>Email</label><input value={newEmail} onChange={e => setNewEmail(e.target.value)} style={inp} placeholder="jean@example.com" type="email" /></div>
          <div><label style={lbl}>Telephone</label><input value={newPhone} onChange={e => setNewPhone(e.target.value)} style={inp} placeholder="+33 6 ..." type="tel" /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Titre / Poste</label><input value={newTitle} onChange={e => setNewTitle(e.target.value)} style={inp} placeholder="CEO, DG, Fondateur..." /></div>
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button onClick={() => { setShowCreate(false); setEditing(true); }} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", fontSize: 12.5, color: "var(--text-3)", fontFamily: "inherit" }}>Annuler</button>
          <button onClick={handleCreateAndSelect} disabled={saving || !newFirst.trim() || !newLast.trim()} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "var(--su-500)", color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
            {saving ? "..." : "Creer et selectionner"}
          </button>
        </div>
      </div>
    );
  }

  // Edit/search mode
  return (
    <div style={{ padding: "12px 16px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input autoFocus placeholder="Rechercher un contact..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 1 }} />
        <button onClick={() => setEditing(false)} style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface-2)", cursor: "pointer", color: "var(--text-4)", fontFamily: "inherit", fontSize: 12 }}>✕</button>
      </div>

      {filtered.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, maxHeight: 180, overflowY: "auto", marginBottom: 8, background: "var(--surface)" }}>
          {filtered.map(c => (
            <button key={c.id} type="button" onClick={() => selectContact(c)} disabled={saving}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderBottom: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--text-1)", fontFamily: "inherit" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              {c.first_name} {c.last_name}{c.email ? ` — ${c.email}` : ""}
            </button>
          ))}
        </div>
      )}

      {noResults && (
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-3)", marginBottom: 8 }}>
          <div style={{ fontSize: 12.5, color: "var(--text-5)", marginBottom: 6 }}>Aucun contact pour &quot;{search}&quot;</div>
          <button onClick={() => { setShowCreate(true); setNewFirst(search.split(" ")[0] ?? ""); setNewLast(search.split(" ").slice(1).join(" ") ?? ""); }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface-2)", color: "var(--su-500)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
            <Plus size={11} /> Creer &quot;{search}&quot;
          </button>
        </div>
      )}

      {/* Manual edit fields */}
      {data.dirigeant_nom && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-5)", marginBottom: 6 }}>Ou modifier manuellement :</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
            <input value={data.dirigeant_nom ?? ""} onChange={e => setData(d => ({ ...d, dirigeant_nom: e.target.value }))} style={inp} placeholder="Nom complet" />
            <input value={data.dirigeant_titre ?? ""} onChange={e => setData(d => ({ ...d, dirigeant_titre: e.target.value }))} style={inp} placeholder="Titre" />
            <input value={data.dirigeant_email ?? ""} onChange={e => setData(d => ({ ...d, dirigeant_email: e.target.value }))} style={inp} placeholder="Email" />
            <input value={data.dirigeant_telephone ?? ""} onChange={e => setData(d => ({ ...d, dirigeant_telephone: e.target.value }))} style={inp} placeholder="Telephone" />
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setEditing(false)} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", fontSize: 12, color: "var(--text-3)", fontFamily: "inherit" }}>Annuler</button>
            <button onClick={handleSaveManual} disabled={saving} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "var(--su-500)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
              <Check size={11} /> Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
