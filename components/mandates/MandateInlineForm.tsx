"use client";

import React, { useState, useEffect } from "react";
import { createMandateAndLink, type MandateInput } from "@/actions/mandates";

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  dealId: string;
  dealName: string;
  clientOrgs: { id: string; name: string }[];
  defaultClientOrgId?: string;
  defaultType?: string;
  onClose: () => void;
  onCreated: (mandateId: string) => void;
}

const MANDATE_TYPES = [
  { value: "fundraising", label: "Fundraising" },
  { value: "ma_sell",     label: "M&A Sell-side" },
  { value: "ma_buy",      label: "M&A Buy-side" },
  { value: "cfo_advisor", label: "CFO Advisor" },
  { value: "recruitment", label: "Recrutement" },
];

const STATUSES = [
  { value: "draft",   label: "Brouillon" },
  { value: "active",  label: "Actif" },
  { value: "on_hold", label: "En pause" },
];

const PRIORITIES = [
  { value: "low",    label: "Basse" },
  { value: "medium", label: "Moyenne" },
  { value: "high",   label: "Haute" },
];

const CURRENCIES = ["EUR", "CHF", "USD", "GBP"];

// ── Component ────────────────────────────────────────────────────────────────

export function MandateInlineForm({
  open,
  dealId,
  dealName,
  clientOrgs,
  defaultClientOrgId,
  defaultType,
  onClose,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState(defaultType || "fundraising");
  const [status, setStatus] = useState("draft");
  const [priority, setPriority] = useState("medium");
  const [clientOrgId, setClientOrgId] = useState(defaultClientOrgId ?? clientOrgs[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [targetCloseDate, setTargetCloseDate] = useState("");
  const [estimatedFee, setEstimatedFee] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset form when opening
  useEffect(() => {
    if (!open) return;
    setName(dealName ? `Mandat — ${dealName}` : "");
    setType(defaultType || "fundraising");
    setStatus("draft");
    setPriority("medium");
    setClientOrgId(defaultClientOrgId ?? clientOrgs[0]?.id ?? "");
    setStartDate("");
    setTargetCloseDate("");
    setEstimatedFee("");
    setCurrency("EUR");
    setDescription("");
    setError("");
  }, [open, dealName, defaultType, defaultClientOrgId, clientOrgs]);

  async function handleSubmit() {
    if (!name.trim()) { setError("Nom requis"); return; }
    if (!clientOrgId) { setError("Client obligatoire"); return; }
    setSaving(true);
    setError("");

    const input: MandateInput = {
      name: name.trim(),
      type,
      client_organization_id: clientOrgId,
      status,
      priority,
      start_date: startDate || null,
      target_close_date: targetCloseDate || null,
      currency,
      estimated_fee_amount: estimatedFee ? Number(estimatedFee) : null,
      description: description.trim() || null,
    };

    const result = await createMandateAndLink(dealId, input);
    setSaving(false);
    if (result.success) {
      onCreated(result.id);
      onClose();
    } else {
      setError(result.error);
    }
  }

  if (!open) return null;

  // ── Styles ──────────────────────────────────────────────────────────────
  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 400,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  };
  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 16,
    padding: 24, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
  };
  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 12px", border: "1px solid var(--border)",
    borderRadius: 8, background: "var(--surface-2)", color: "var(--text-1)",
    fontSize: 13.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-4)",
    marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em",
  };
  const mb14: React.CSSProperties = { marginBottom: 14 };
  const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 };
  const btnPrimary: React.CSSProperties = {
    padding: "9px 22px", borderRadius: 8, border: "none", fontWeight: 700,
    fontSize: 13.5, cursor: "pointer", background: "var(--su-500)", color: "#fff",
  };
  const btnSecondary: React.CSSProperties = {
    padding: "9px 22px", borderRadius: 8, border: "1px solid var(--border)",
    fontWeight: 600, fontSize: 13.5, cursor: "pointer", background: "transparent",
    color: "var(--text-3)",
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>
            Créer un mandat
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-4)", fontSize: 18 }}>
            ✕
          </button>
        </div>

        <div style={mb14}>
          <label style={lbl}>Nom du mandat *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="ex : Mandat levée série A ACME" style={inp} autoFocus />
        </div>

        <div style={row}>
          <div>
            <label style={lbl}>Type *</label>
            <select value={type} onChange={e => setType(e.target.value)} style={inp}>
              {MANDATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Statut</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div style={mb14}>
          <label style={lbl}>Organisation cliente *</label>
          {clientOrgs.length > 0 ? (
            <select value={clientOrgId} onChange={e => setClientOrgId(e.target.value)} style={inp}>
              <option value="">— Sélectionner —</option>
              {clientOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          ) : (
            <div style={{ ...inp, color: "var(--text-5)", display: "flex", alignItems: "center" }}>
              Aucune organisation liée au dossier — ajouter une organisation cliente avant de créer le mandat
            </div>
          )}
        </div>

        <div style={row}>
          <div>
            <label style={lbl}>Priorité</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} style={inp}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Devise</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={inp}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={row}>
          <div>
            <label style={lbl}>Date de début</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Closing cible</label>
            <input type="date" value={targetCloseDate} onChange={e => setTargetCloseDate(e.target.value)} style={inp} />
          </div>
        </div>

        <div style={mb14}>
          <label style={lbl}>Fee estimé</label>
          <input type="number" value={estimatedFee} onChange={e => setEstimatedFee(e.target.value)}
            placeholder="0" style={inp} />
        </div>

        <div style={mb14}>
          <label style={lbl}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={3} placeholder="Notes sur le mandat..." style={{ ...inp, resize: "vertical" }} />
        </div>

        {error && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>Annuler</button>
          <button type="button" onClick={handleSubmit} disabled={saving || clientOrgs.length === 0}
            style={{ ...btnPrimary, opacity: (saving || clientOrgs.length === 0) ? 0.6 : 1 }}>
            {saving ? "Création..." : "Créer le mandat"}
          </button>
        </div>
      </div>
    </div>
  );
}
