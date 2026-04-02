"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { updateMandate, deleteMandate } from "@/actions/mandates";
import { createFee, updateFee, deleteFee } from "@/actions/fees";
import { TagInput } from "@/components/tags/TagInput";
import { useRouter } from "next/navigation";

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  fundraising: "Fundraising", ma_sell: "M&A Sell", ma_buy: "M&A Buy",
  cfo_advisor: "CFO Advisory", recruitment: "Recrutement",
};
const TYPE_COLORS: Record<string, { bg: string; tx: string; border: string }> = {
  fundraising: { bg: "var(--fund-bg)", tx: "var(--fund-tx)", border: "var(--fund-mid)" },
  ma_sell:     { bg: "var(--sell-bg)", tx: "var(--sell-tx)", border: "var(--sell-mid)" },
  ma_buy:      { bg: "var(--buy-bg)",  tx: "var(--buy-tx)",  border: "var(--buy-mid)"  },
  cfo_advisor: { bg: "var(--cfo-bg)",  tx: "var(--cfo-tx)",  border: "var(--cfo-mid)"  },
  recruitment: { bg: "var(--rec-bg)",  tx: "var(--rec-tx)",  border: "var(--rec-mid)"  },
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", active: "Actif", on_hold: "En pause",
  won: "Gagné", lost: "Perdu", closed: "Clôturé",
};
const STATUS_COLORS: Record<string, { bg: string; tx: string }> = {
  draft:   { bg: "var(--surface-3)", tx: "var(--text-5)" },
  active:  { bg: "#D1FAE5",          tx: "#065F46"        },
  on_hold: { bg: "#FEF3C7",          tx: "#92400E"        },
  won:     { bg: "#DBEAFE",          tx: "#1D4ED8"        },
  lost:    { bg: "#FEE2E2",          tx: "#991B1B"        },
  closed:  { bg: "var(--surface-3)", tx: "var(--text-4)"  },
};
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

function fmtAmt(n: number | null, currency = "EUR") {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M ${currency}`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k ${currency}`;
  return `${n} ${currency}`;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

type FeeRow = {
  id: string; name: string; milestone_type: string; amount: number; currency: string;
  status: string; due_date: string | null; invoiced_date?: string | null; paid_date?: string | null;
  notes?: string | null; ticket_amount?: number | null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function MandateDetail({ mandate, initialFees, deals }: {
  mandate: any;
  initialFees: FeeRow[];
  deals: any[];
}) {
  const router = useRouter();
  const [fees, setFees] = useState<FeeRow[]>(initialFees);
  const [modal, setModal] = useState<"add_fee" | "edit_fee" | null>(null);
  const [editingFee, setEditingFee] = useState<FeeRow | null>(null);
  const [feeForm, setFeeForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);

  const tc = TYPE_COLORS[mandate.type] ?? TYPE_COLORS.fundraising;
  const sc = STATUS_COLORS[mandate.status] ?? STATUS_COLORS.draft;

  const totalEstimated = mandate.estimated_fee_amount ?? 0;
  const totalPaid      = fees.filter(f => f.status === "paid").reduce((s, f) => s + (f.amount ?? 0), 0);
  const totalPending   = fees.filter(f => f.status === "pending").reduce((s, f) => s + (f.amount ?? 0), 0);
  const totalInvoiced  = fees.filter(f => f.status === "invoiced").reduce((s, f) => s + (f.amount ?? 0), 0);

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFeeForm(p => ({ ...p, [k]: e.target.value }));

  function openAddFee() {
    setEditingFee(null);
    setFeeForm({ currency: mandate.currency ?? "EUR", milestone_type: "fixed" });
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
          mandate_id: mandate.id, name: feeForm.name,
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
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  }

  async function handleDeleteFee(id: string) {
    if (!confirm("Supprimer ce jalon ?")) return;
    const r = await deleteFee(id);
    if (!r.success) { alert(r.error); return; }
    setFees(p => p.filter(f => f.id !== id));
  }

  async function handleFeeStatus(id: string, status: string) {
    setLoading(true);
    const r = await updateFee(id, { status });
    if (!r.success) { alert(r.error); setLoading(false); return; }
    setFees(p => p.map(f => f.id === id ? { ...f, status } : f));
    setLoading(false);
  }

  async function handleMandateStatus(status: string) {
    setStatusChanging(true);
    await updateMandate(mandate.id, { status });
    router.refresh();
    setStatusChanging(false);
  }

  async function handleDelete() {
    if (!confirm(`Supprimer le mandat "${mandate.name}" ? Cette action est irréversible.`)) return;
    await deleteMandate(mandate.id);
    router.push("/protected/mandats");
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 11px", border: "1px solid var(--border)",
    borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none",
    background: "var(--surface)", color: "var(--text-1)", boxSizing: "border-box",
  };
  const sel: React.CSSProperties = { ...inp };
  const cardStyle: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 10,
  };

  return (
    <div style={{ padding: "24px 20px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Breadcrumb */}
        <Link href="/protected/mandats" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-4)", textDecoration: "none", marginBottom: 16 }}>
          <ArrowLeft size={13} /> Mandats
        </Link>

        {/* Header */}
        <div style={{ ...cardStyle, padding: "22px 24px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 7, background: tc.bg, color: tc.tx, border: `1px solid ${tc.border}` }}>
                  {TYPE_LABELS[mandate.type] ?? mandate.type}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: sc.bg, color: sc.tx }}>
                  {STATUS_LABELS[mandate.status] ?? mandate.status}
                </span>
              </div>
              <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>{mandate.name}</h1>
              {mandate.client_name && (
                <Link href={`/protected/organisations/${mandate.client_id}`} style={{ fontSize: 13.5, color: "var(--text-3)", textDecoration: "none" }}>
                  🏢 {mandate.client_name}
                </Link>
              )}
              {mandate.description && (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-4)", lineHeight: 1.5 }}>{mandate.description}</p>
              )}
              <div style={{ marginTop: 12 }}>
                <TagInput objectType="mandate" objectId={mandate.id} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
              <Link href={`/protected/mandats/${mandate.id}/modifier`} style={{
                padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--surface-2)", color: "var(--text-3)", fontSize: 12.5, textDecoration: "none",
              }}>
                Modifier
              </Link>
              <button
                onClick={handleDelete}
                style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-5)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
              >
                Supprimer
              </button>
            </div>
          </div>

          {/* Infos clés */}
          {(() => {
            const opLabel: Record<string, string> = {
              fundraising: "Montant à lever",
              ma_sell:     "Valorisation cible (EV)",
              ma_buy:      "Budget d'acquisition",
              recruitment: "Salaire annuel (base)",
              cfo_advisor: "Budget mission",
            };
            const feeBaseLabel: Record<string, string> = {
              ev: "sur EV", revenue: "sur CA", raise_amount: "sur levée", salary: "sur salaire",
            };
            const infos = [
              { label: "Début",        val: fmtDate(mandate.start_date) },
              { label: "Objectif",     val: fmtDate(mandate.target_close_date) },
              { label: opLabel[mandate.type] ?? "Montant opération", val: fmtAmt(mandate.operation_amount, mandate.currency) },
              { label: "Success fee",  val: mandate.success_fee_percent
                  ? `${mandate.success_fee_percent}% ${feeBaseLabel[mandate.success_fee_base] ?? ""}`
                  : "—" },
              { label: "Retainer/mois",val: fmtAmt(mandate.retainer_monthly, mandate.currency) },
            ];
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                {infos.map(({ label, val }) => (
                  <div key={label}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-2)" }}>{val}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* KPIs honoraires */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Estimé",    val: fmtAmt(totalEstimated, mandate.currency), bg: "var(--surface)",  tx: "var(--text-1)" },
            { label: "Pipeline",  val: fmtAmt(totalPending,   mandate.currency), bg: "#FFFBEB", tx: "#92400E" },
            { label: "Facturé",   val: fmtAmt(totalInvoiced,  mandate.currency), bg: "#EFF6FF", tx: "#1D4ED8" },
            { label: "Encaissé",  val: fmtAmt(totalPaid,      mandate.currency), bg: "#ECFDF5", tx: "#065F46" },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.tx }}>{k.val}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-4)", marginTop: 3 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Jalons de facturation */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Jalons de facturation
            </span>
            <button
              onClick={openAddFee}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface-2)", color: "var(--text-3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              <Plus size={11} /> Ajouter
            </button>
          </div>

          {fees.length === 0 ? (
            <div style={{ padding: "28px", textAlign: "center", fontSize: 13, color: "var(--text-5)" }}>
              Aucun jalon. Ajoutez des jalons pour suivre les honoraires.
            </div>
          ) : (
            fees.map((fee, i) => {
              const mt = MILESTONE_COLORS[fee.milestone_type] ?? MILESTONE_COLORS.fixed;
              const fs = FEE_STATUS_COLORS[fee.status]        ?? FEE_STATUS_COLORS.pending;
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
                          Ticket : {fmtAmt(fee.ticket_amount, fee.currency)}
                        </span>
                      )}
                      {fee.due_date && (
                        <span style={{ fontSize: 11.5, color: "var(--text-5)" }}>Échéance : {fmtDate(fee.due_date)}</span>
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
                      style={{ fontSize: 11.5, padding: "3px 7px", borderRadius: 20, border: `1px solid ${fs.bg}`, background: fs.bg, color: fs.tx, cursor: "pointer", fontFamily: "inherit", outline: "none" }}
                    >
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

        {/* Dossiers liés */}
        {deals.length > 0 && (
          <div style={cardStyle}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Dossiers liés
            </div>
            {deals.map((d, i) => (
              <Link key={d.id} href={`/protected/dossiers/${d.id}`} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                borderBottom: i < deals.length - 1 ? "1px solid var(--border)" : "none",
                textDecoration: "none",
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "var(--surface-2)", color: "var(--text-3)" }}>
                  {TYPE_LABELS[d.deal_type] ?? d.deal_type}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)", flex: 1 }}>{d.name}</span>
                <span style={{ fontSize: 12, color: "var(--text-5)" }}>{d.deal_stage}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Changer statut mandat */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {Object.entries(STATUS_LABELS).filter(([v]) => v !== mandate.status).map(([value, label]) => {
            const sc2 = STATUS_COLORS[value] ?? STATUS_COLORS.draft;
            return (
              <button
                key={value}
                onClick={() => handleMandateStatus(value)}
                disabled={statusChanging}
                style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${sc2.bg}`, background: sc2.bg, color: sc2.tx, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: statusChanging ? 0.6 : 1 }}
              >
                → {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal jalon */}
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
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 5 }}>Nom *</label>
                <input style={inp} placeholder="ex: Signing mandat, Success Fee closing…" value={feeForm.name ?? ""} onChange={setF("name")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 5 }}>Type</label>
                  <select style={sel} value={feeForm.milestone_type ?? "fixed"} onChange={setF("milestone_type")}>
                    {MILESTONE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 5 }}>Devise</label>
                  <select style={sel} value={feeForm.currency ?? "EUR"} onChange={setF("currency")}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {/* Ticket investisseur (auto-calcul fee) */}
              {feeForm.milestone_type === "success_fee" && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 5 }}>
                    Ticket investisseur
                    {mandate.success_fee_percent ? ` — base calcul (×${mandate.success_fee_percent}%)` : ""}
                  </label>
                  <input
                    style={inp} type="number" placeholder="Montant de la tranche"
                    value={feeForm.ticket_amount ?? ""}
                    onChange={e => {
                      const ticket = e.target.value;
                      const autoFee = ticket && mandate.success_fee_percent
                        ? String(Math.round(Number(ticket) * mandate.success_fee_percent / 100))
                        : feeForm.amount;
                      setFeeForm(p => ({ ...p, ticket_amount: ticket, amount: autoFee }));
                    }}
                  />
                  {feeForm.ticket_amount && mandate.success_fee_percent && (
                    <div style={{ fontSize: 11.5, color: "var(--text-4)", marginTop: 4 }}>
                      {Number(feeForm.ticket_amount).toLocaleString("fr-FR")} × {mandate.success_fee_percent}% = <strong>{Math.round(Number(feeForm.ticket_amount) * mandate.success_fee_percent / 100).toLocaleString("fr-FR")} {feeForm.currency ?? mandate.currency}</strong>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 5 }}>Montant fee *</label>
                  <input style={inp} type="number" placeholder="0" value={feeForm.amount ?? ""} onChange={setF("amount")} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 5 }}>Échéance</label>
                  <input style={inp} type="date" value={feeForm.due_date ?? ""} onChange={setF("due_date")} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 5 }}>Notes</label>
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
