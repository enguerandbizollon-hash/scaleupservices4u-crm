"use client";
// Onglet Honoraires de la fiche dossier (fusion mandats → dossiers, temps 5).
// Le dossier porte son économie : paramètres de success fee éditables en
// place, calcul automatique traçable (base + source + notes), KPIs de
// facturation et CRUD des jalons (ex-fiche mandat, rapatrié ici).
// Agrégations via lib/crm/fee-calculator (sumMilestonesByStatus,
// filterOverdueMilestones) — pas de réimplémentation à la main.

import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, X, Sparkles, AlertTriangle } from "lucide-react";
import { createFee, updateFee, deleteFee } from "@/actions/fees";
import { updateDealField } from "@/actions/deals";
import {
  computeSuccessFee,
  sumMilestonesByStatus,
  filterOverdueMilestones,
} from "@/lib/crm/fee-calculator";

// ── Constantes ────────────────────────────────────────────────────────────────

const MILESTONE_TYPES: { value: string; label: string }[] = [
  { value: "retainer",    label: "Retainer" },
  { value: "success_fee", label: "Success fee" },
  { value: "fixed",       label: "Forfait" },
  { value: "expense",     label: "Frais" },
];
const MILESTONE_COLORS: Record<string, { bg: string; tx: string }> = {
  retainer:    { bg: "#EFF6FF", tx: "#1D4ED8" },
  success_fee: { bg: "#D1FAE5", tx: "#065F46" },
  fixed:       { bg: "#F0FDF4", tx: "#166534" },
  expense:     { bg: "var(--surface-3)", tx: "var(--text-4)" },
};
const FEE_STATUS_LABELS: Record<string, string> = {
  pending: "À facturer", invoiced: "Facturé", paid: "Encaissé", cancelled: "Annulé",
};
const FEE_STATUS_COLORS: Record<string, { bg: string; tx: string }> = {
  pending:   { bg: "#FEF3C7", tx: "#92400E" },
  invoiced:  { bg: "#DBEAFE", tx: "#1D4ED8" },
  paid:      { bg: "#D1FAE5", tx: "#065F46" },
  cancelled: { bg: "var(--surface-3)", tx: "var(--text-5)" },
};
const CURRENCIES = ["EUR", "CHF", "USD", "GBP"];

// Bases de calcul explicites — clés alignées sur FeeBaseSource (fee-calculator).
const BASE_OPTIONS: { value: string; label: string }[] = [
  { value: "",                       label: "Automatique (selon le type)" },
  { value: "closed_amount",          label: "Montant closing" },
  { value: "asking_price_mid",       label: "Asking price (milieu de fourchette)" },
  { value: "target_ev_mid",          label: "EV cible (milieu de fourchette)" },
  { value: "acquisition_budget_mid", label: "Budget d'acquisition (milieu)" },
  { value: "target_amount",          label: "Montant cible" },
];
const SOURCE_LABELS: Record<string, string> = {
  operation_amount:        "montant d'opération saisi",
  closed_amount:           "montant closing",
  asking_price_mid:        "milieu asking price",
  target_ev_mid:           "milieu EV cible",
  acquisition_budget_mid:  "milieu budget d'acquisition",
  target_amount:           "montant cible",
};

function fmtAmt(n: number | null | undefined, currency = "EUR") {
  if (!n) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M ${currency}`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)}k ${currency}`;
  return `${n} ${currency}`;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeeRow = {
  id: string; name: string; milestone_type: string; amount: number; currency: string;
  status: string; due_date: string | null; invoiced_date?: string | null; paid_date?: string | null;
  notes?: string | null; ticket_amount?: number | null;
};

type DealForFeesTab = {
  id: string;
  deal_type: string;
  currency: string | null;
  estimated_fee_amount?: number | null;
  retainer_monthly?: number | null;
  success_fee_percent?: number | null;
  success_fee_base?: string | null;
  operation_amount?: number | null;
  closed_amount?: number | null;
  target_amount?: number | null;
  asking_price_min?: number | null;
  asking_price_max?: number | null;
  target_ev_min?: number | null;
  target_ev_max?: number | null;
  acquisition_budget_min?: number | null;
  acquisition_budget_max?: number | null;
};

// ── Composant ─────────────────────────────────────────────────────────────────

export function FeesTab({ deal, initialFees }: { deal: DealForFeesTab; initialFees: FeeRow[] }) {
  const cur = deal.currency ?? "EUR";
  const [fees, setFees] = useState<FeeRow[]>(
    [...initialFees].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
  );

  // Paramètres honoraires — état local (string pour les inputs), save au blur.
  const [params, setParams] = useState({
    estimated_fee_amount: deal.estimated_fee_amount != null ? String(deal.estimated_fee_amount) : "",
    retainer_monthly:     deal.retainer_monthly     != null ? String(deal.retainer_monthly)     : "",
    success_fee_percent:  deal.success_fee_percent  != null ? String(deal.success_fee_percent)  : "",
    success_fee_base:     deal.success_fee_base     ?? "",
    operation_amount:     deal.operation_amount     != null ? String(deal.operation_amount)     : "",
  });
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  async function saveParam(field: keyof typeof params, value: string) {
    const res = await updateDealField(deal.id, field, value === "" ? null : value);
    if (!res.success) { alert(res.error); return; }
    setSavedFlash(field);
    setTimeout(() => setSavedFlash(f => (f === field ? null : f)), 1200);
  }
  const setP = (k: keyof typeof params) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setParams(p => ({ ...p, [k]: e.target.value }));

  // Calcul auto live sur les valeurs en cours de saisie + chiffres du dossier.
  const autoFee = useMemo(() => computeSuccessFee({
    deal_type: deal.deal_type,
    currency: cur,
    success_fee_percent: params.success_fee_percent ? Number(params.success_fee_percent) : null,
    success_fee_base: params.success_fee_base || null,
    operation_amount: params.operation_amount ? Number(params.operation_amount) : null,
    closed_amount: deal.closed_amount,
    asking_price_min: deal.asking_price_min,
    asking_price_max: deal.asking_price_max,
    target_ev_min: deal.target_ev_min,
    target_ev_max: deal.target_ev_max,
    acquisition_budget_min: deal.acquisition_budget_min,
    acquisition_budget_max: deal.acquisition_budget_max,
    target_amount: deal.target_amount,
  }), [deal, cur, params.success_fee_percent, params.success_fee_base, params.operation_amount]);

  // KPIs jalons — briques fee-calculator, cancelled exclu.
  const totals = useMemo(() => sumMilestonesByStatus(fees), [fees]);
  const overdue = useMemo(() => filterOverdueMilestones(fees, 0), [fees]);
  const estimated = params.estimated_fee_amount ? Number(params.estimated_fee_amount) : null;
  const collectRatio = estimated && estimated > 0 ? Math.min(1, totals.paid / estimated) : null;

  // ── CRUD jalons ─────────────────────────────────────────────────────────
  const [modal, setModal] = useState<"add_fee" | "edit_fee" | null>(null);
  const [editingFee, setEditingFee] = useState<FeeRow | null>(null);
  const [feeForm, setFeeForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFeeForm(p => ({ ...p, [k]: e.target.value }));

  function openAddFee() {
    setEditingFee(null);
    setFeeForm({ currency: cur, milestone_type: "fixed" });
    setModal("add_fee");
  }
  function openEditFee(fee: FeeRow) {
    setEditingFee(fee);
    setFeeForm({
      name: fee.name, milestone_type: fee.milestone_type,
      amount: String(fee.amount), currency: fee.currency,
      due_date: fee.due_date ?? "", notes: fee.notes ?? "",
      ticket_amount: fee.ticket_amount != null ? String(fee.ticket_amount) : "",
    });
    setModal("edit_fee");
  }
  function closeModal() { setModal(null); setEditingFee(null); setFeeForm({}); }

  async function saveFee() {
    if (!feeForm.name?.trim() || !feeForm.amount) return;
    setLoading(true);
    try {
      const ticketAmt = feeForm.ticket_amount ? Number(feeForm.ticket_amount) : null;
      if (editingFee) {
        const r = await updateFee(editingFee.id, {
          name: feeForm.name, milestone_type: feeForm.milestone_type,
          amount: Number(feeForm.amount), currency: feeForm.currency,
          due_date: feeForm.due_date || null, notes: feeForm.notes || null,
          ticket_amount: ticketAmt,
        });
        if (!r.success) throw new Error(r.error);
        setFees(p => p.map(f => f.id === editingFee.id
          ? { ...f, ...feeForm, amount: Number(feeForm.amount), ticket_amount: ticketAmt }
          : f));
      } else {
        const r = await createFee({
          deal_id: deal.id, name: feeForm.name,
          milestone_type: feeForm.milestone_type, amount: Number(feeForm.amount),
          currency: feeForm.currency, due_date: feeForm.due_date || null,
          notes: feeForm.notes || null, ticket_amount: ticketAmt,
        });
        if (!r.success) throw new Error(r.error);
        setFees(p => [...p, {
          id: r.id, name: feeForm.name, milestone_type: feeForm.milestone_type,
          amount: Number(feeForm.amount), currency: feeForm.currency,
          status: "pending", due_date: feeForm.due_date || null,
          notes: feeForm.notes || null, ticket_amount: ticketAmt,
        }]);
      }
      closeModal();
    } catch (e) { alert(e instanceof Error ? e.message : "Erreur"); } finally { setLoading(false); }
  }

  async function handleDeleteFee(id: string) {
    if (!confirm("Supprimer ce jalon ?")) return;
    const r = await deleteFee(id);
    if (!r.success) { alert(r.error); return; }
    setFees(p => p.filter(f => f.id !== id));
  }

  async function handleFeeStatus(id: string, status: string) {
    const r = await updateFee(id, { status });
    if (!r.success) { alert(r.error); return; }
    setFees(p => p.map(f => f.id === id ? { ...f, status } : f));
  }

  // ── Styles ──────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 11px", border: "1px solid var(--border)",
    borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none",
    background: "var(--surface-2)", color: "var(--text-1)", boxSizing: "border-box",
  };
  const sel: React.CSSProperties = { ...inp };
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase",
    letterSpacing: ".05em", display: "block", marginBottom: 5,
  };
  const cardStyle: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 10,
  };

  return (
    <div>
      {/* ── Paramètres honoraires ── */}
      <div style={{ ...cardStyle, padding: "18px 20px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 14 }}>
          Paramètres honoraires
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <div>
            <label style={lbl}>Success fee %{savedFlash === "success_fee_percent" ? " ✓" : ""}</label>
            <input style={inp} type="number" step="0.1" placeholder="ex : 3"
              value={params.success_fee_percent} onChange={setP("success_fee_percent")}
              onBlur={e => saveParam("success_fee_percent", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Base de calcul{savedFlash === "success_fee_base" ? " ✓" : ""}</label>
            <select style={sel} value={params.success_fee_base}
              onChange={e => { setParams(p => ({ ...p, success_fee_base: e.target.value })); saveParam("success_fee_base", e.target.value); }}>
              {BASE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Montant opération{savedFlash === "operation_amount" ? " ✓" : ""}</label>
            <input style={inp} type="number" placeholder="Override manuel"
              value={params.operation_amount} onChange={setP("operation_amount")}
              onBlur={e => saveParam("operation_amount", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Retainer / mois{savedFlash === "retainer_monthly" ? " ✓" : ""}</label>
            <input style={inp} type="number" placeholder="0"
              value={params.retainer_monthly} onChange={setP("retainer_monthly")}
              onBlur={e => saveParam("retainer_monthly", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Honoraires estimés{savedFlash === "estimated_fee_amount" ? " ✓" : ""}</label>
            <input style={inp} type="number" placeholder="Total estimé du dossier"
              value={params.estimated_fee_amount} onChange={setP("estimated_fee_amount")}
              onBlur={e => saveParam("estimated_fee_amount", e.target.value)} />
          </div>
        </div>

        {/* Calcul automatique traçable */}
        {autoFee.estimated != null && autoFee.estimated > 0 && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Sparkles size={13} color="#065F46" />
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>
              Success fee calculé : <strong>{fmtAmt(autoFee.estimated, autoFee.currency)}</strong>
              {autoFee.percent != null && autoFee.base != null && (
                <span style={{ color: "var(--text-4)" }}>
                  {" "}({autoFee.percent}% × {fmtAmt(autoFee.base, autoFee.currency)}
                  {autoFee.source ? `, ${SOURCE_LABELS[autoFee.source] ?? autoFee.source}` : ""})
                </span>
              )}
            </span>
            <button type="button"
              onClick={() => {
                const rounded = String(Math.round(autoFee.estimated ?? 0));
                setParams(p => ({ ...p, estimated_fee_amount: rounded }));
                saveParam("estimated_fee_amount", rounded);
              }}
              style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              Utiliser comme estimé
            </button>
          </div>
        )}
        {autoFee.notes.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text-5)", lineHeight: 1.6 }}>
            {autoFee.notes.map((n, i) => <div key={i}>· {n}</div>)}
          </div>
        )}
      </div>

      {/* ── KPIs facturation ── */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${overdue.length > 0 ? 5 : 4}, 1fr)`, gap: 10, marginBottom: 10 }}>
        {[
          { label: "Estimé",   val: fmtAmt(estimated, cur),          bg: "var(--surface)", tx: "var(--text-1)" },
          { label: "Pipeline", val: fmtAmt(totals.pending, cur),     bg: "#FFFBEB", tx: "#92400E" },
          { label: "Facturé",  val: fmtAmt(totals.invoiced, cur),    bg: "#EFF6FF", tx: "#1D4ED8" },
          { label: "Encaissé", val: fmtAmt(totals.paid, cur),        bg: "#ECFDF5", tx: "#065F46", ratio: collectRatio },
          ...(overdue.length > 0 ? [{ label: `En retard (${overdue.length})`, val: fmtAmt(overdue.reduce((s, f) => s + (f.amount ?? 0), 0), cur), bg: "#FEF2F2", tx: "#991B1B" }] : []),
        ].map((k: { label: string; val: string; bg: string; tx: string; ratio?: number | null }) => (
          <div key={k.label} style={{ background: k.bg, border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.tx }}>{k.val}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-4)", marginTop: 3 }}>{k.label}</div>
            {k.ratio != null && (
              <div style={{ marginTop: 7, height: 3, borderRadius: 2, background: "rgba(6,95,70,.15)" }}>
                <div style={{ width: `${Math.round(k.ratio * 100)}%`, height: "100%", borderRadius: 2, background: "#065F46" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Jalons de facturation ── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Jalons de facturation
          </span>
          <button onClick={openAddFee}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface-2)", color: "var(--text-3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            <Plus size={11} /> Ajouter
          </button>
        </div>

        {fees.length === 0 ? (
          <div style={{ padding: "28px", textAlign: "center", fontSize: 13, color: "var(--text-5)" }}>
            Aucun jalon. Ajoutez retainer, success fee ou forfaits pour suivre la facturation du mandat.
          </div>
        ) : (
          fees.map((fee, i) => {
            const mt = MILESTONE_COLORS[fee.milestone_type] ?? MILESTONE_COLORS.fixed;
            const fs = FEE_STATUS_COLORS[fee.status]        ?? FEE_STATUS_COLORS.pending;
            const isOverdue = fee.status === "pending" && fee.due_date && fee.due_date < new Date().toISOString().split("T")[0];
            const isLast = i === fees.length - 1;
            return (
              <div key={fee.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                borderBottom: isLast ? "none" : "1px solid var(--border)",
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: mt.bg, color: mt.tx, flexShrink: 0 }}>
                  {MILESTONE_TYPES.find(t => t.value === fee.milestone_type)?.label ?? fee.milestone_type}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)" }}>{fee.name}</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
                    {fee.ticket_amount != null && (
                      <span style={{ fontSize: 11.5, color: "var(--text-4)" }}>
                        Base : {fmtAmt(fee.ticket_amount, fee.currency)}
                      </span>
                    )}
                    {fee.due_date && (
                      <span style={{ fontSize: 11.5, color: isOverdue ? "#991B1B" : "var(--text-5)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        {isOverdue && <AlertTriangle size={10} />}
                        Échéance : {fmtDate(fee.due_date)}
                      </span>
                    )}
                    {fee.status === "paid" && fee.paid_date && (
                      <span style={{ fontSize: 11.5, color: "var(--text-5)" }}>Encaissé le {fmtDate(fee.paid_date)}</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", flexShrink: 0 }}>
                  {fmtAmt(fee.amount, fee.currency)}
                </div>

                {/* Statut + actions rapides */}
                <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                  <select
                    value={fee.status}
                    onChange={e => handleFeeStatus(fee.id, e.target.value)}
                    style={{ fontSize: 11.5, padding: "3px 7px", borderRadius: 20, border: `1px solid ${fs.bg}`, background: fs.bg, color: fs.tx, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                    {Object.entries(FEE_STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <button onClick={() => openEditFee(fee)} style={{ width: 26, height: 26, borderRadius: 7, background: "none", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-4)" }}>
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => handleDeleteFee(fee.id)} style={{ width: 26, height: 26, borderRadius: 7, background: "none", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--rec-tx)" }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Modal jalon ── */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>
                {modal === "edit_fee" ? "Modifier le jalon" : "Ajouter un jalon"}
              </span>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-4)" }}><X size={16} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={lbl}>Nom *</label>
                <input style={inp} placeholder="ex : Signing, Success fee closing…" value={feeForm.name ?? ""} onChange={setF("name")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Type</label>
                  <select style={sel} value={feeForm.milestone_type ?? "fixed"} onChange={setF("milestone_type")}>
                    {MILESTONE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Devise</label>
                  <select style={sel} value={feeForm.currency ?? "EUR"} onChange={setF("currency")}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {/* Base d'opération (auto-calcul du fee via le % du dossier) */}
              {feeForm.milestone_type === "success_fee" && (
                <div>
                  <label style={lbl}>
                    Montant d&apos;opération
                    {params.success_fee_percent ? ` — base calcul (×${params.success_fee_percent}%)` : ""}
                  </label>
                  <input
                    style={inp} type="number" placeholder="Montant de la tranche"
                    value={feeForm.ticket_amount ?? ""}
                    onChange={e => {
                      const ticket = e.target.value;
                      const pct = params.success_fee_percent ? Number(params.success_fee_percent) : null;
                      const autoAmt = ticket && pct
                        ? String(Math.round(Number(ticket) * pct / 100))
                        : feeForm.amount;
                      setFeeForm(p => ({ ...p, ticket_amount: ticket, amount: autoAmt }));
                    }}
                  />
                  {feeForm.ticket_amount && params.success_fee_percent && (
                    <div style={{ fontSize: 11.5, color: "var(--text-4)", marginTop: 4 }}>
                      {Number(feeForm.ticket_amount).toLocaleString("fr-FR")} × {params.success_fee_percent}% = <strong>{Math.round(Number(feeForm.ticket_amount) * Number(params.success_fee_percent) / 100).toLocaleString("fr-FR")} {feeForm.currency ?? cur}</strong>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Montant *</label>
                  <input style={inp} type="number" placeholder="0" value={feeForm.amount ?? ""} onChange={setF("amount")} />
                </div>
                <div>
                  <label style={lbl}>Échéance</label>
                  <input style={inp} type="date" value={feeForm.due_date ?? ""} onChange={setF("due_date")} />
                </div>
              </div>
              <div>
                <label style={lbl}>Notes</label>
                <textarea style={{ ...inp, resize: "vertical", minHeight: 60 }} value={feeForm.notes ?? ""} onChange={setF("notes")} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={closeModal} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
                Annuler
              </button>
              <button onClick={saveFee} disabled={loading} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--text-1)", color: "var(--bg)", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
                {loading ? "…" : modal === "edit_fee" ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
