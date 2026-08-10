"use client";
import { useState } from "react";
import { updateDealField } from "@/actions/deals";
import { Wallet, Pencil, Check, X, ArrowRight } from "lucide-react";

// Budget d'acquisition d'un mandat ma_buy : remplace l'onglet Financier de la
// cession (grille P&L sans objet quand le dossier n'a pas d'entreprise sujette
// unique). Porte la capacité d'investissement du repreneur, sur les colonnes
// existantes du deal (acquisition_budget_min/max). Les financières des CIBLES
// vivent sur leurs fiches univers (Marché, Cibles).

const fmtEur = (n: number | null) =>
  n == null ? null : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M€` : `${Math.round(n / 1_000)} k€`;

function MoneyField({ dealId, field, label, hint, initial }: {
  dealId: string;
  field: "acquisition_budget_min" | "acquisition_budget_max";
  label: string;
  hint: string;
  initial: number | null;
}) {
  const [value, setValue] = useState<number | null>(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial != null ? String(initial) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    const next = draft.trim() === "" ? null : Number(draft);
    if (next != null && !Number.isFinite(next)) { setErr("Montant invalide."); setSaving(false); return; }
    const res = await updateDealField(dealId, field, next);
    setSaving(false);
    if (!res.success) { setErr(res.error); return; }
    setValue(next);
    setEditing(false);
  }

  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "13px 16px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{label}</div>
      {editing ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <input type="number" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
            placeholder="ex : 300000"
            style={{ flex: 1, padding: "7px 10px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text-1)", fontFamily: "inherit", outline: "none" }} />
          <button type="button" onClick={save} disabled={saving} aria-label="Enregistrer"
            style={{ display: "flex", padding: 7, borderRadius: 8, border: "none", background: "#065F46", color: "#fff", cursor: "pointer" }}>
            <Check size={13} />
          </button>
          <button type="button" onClick={() => { setEditing(false); setDraft(value != null ? String(value) : ""); setErr(null); }} aria-label="Annuler"
            style={{ display: "flex", padding: 7, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-3)", cursor: "pointer" }}>
            <X size={13} />
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: value != null ? "var(--text-1)" : "var(--text-5)" }}>
            {fmtEur(value) ?? "Non renseigné"}
          </span>
          <button type="button" onClick={() => setEditing(true)} aria-label={`Modifier : ${label}`}
            style={{ display: "flex", padding: 4, borderRadius: 6, border: "none", background: "none", color: "var(--text-4)", cursor: "pointer" }}>
            <Pencil size={12} />
          </button>
        </div>
      )}
      {err && <div style={{ marginTop: 6, fontSize: 11.5, color: "#991B1B" }}>{err}</div>}
      <div style={{ marginTop: 5, fontSize: 11.5, color: "var(--text-5)", lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

export function BuyBudgetTab({ dealId, budgetMin, budgetMax, revenueMin, revenueMax, onOpenPane }: {
  dealId: string;
  budgetMin: number | null;
  budgetMax: number | null;
  revenueMin: number | null;
  revenueMax: number | null;
  /** Renvoi vers les critères du dossier (fourchette de CA). */
  onOpenPane?: (tab: "dossier" | "sourcing") => void;
}) {
  const caCible = [fmtEur(revenueMin), fmtEur(revenueMax)].filter(Boolean).join(" à ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border-2)", padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Wallet size={15} color="#0F766E" />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>Budget d&apos;acquisition</h2>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--text-4)", lineHeight: 1.5 }}>
          La capacité d&apos;investissement du repreneur cadre la recherche et compte dans la qualification du mandat.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <MoneyField dealId={dealId} field="acquisition_budget_min" label="Apport / budget minimum"
            hint="L'apport personnel ou le budget plancher du repreneur (repris de la fiche de cadrage quand elle le donne)."
            initial={budgetMin} />
          <MoneyField dealId={dealId} field="acquisition_budget_max" label="Budget maximum"
            hint="L'enveloppe totale envisageable, dette comprise. Optionnel."
            initial={budgetMax} />
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border-2)", padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--text-4)" }}>Fourchette de CA cible :</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: caCible ? "var(--text-1)" : "var(--text-5)" }}>
            {caCible || "Non renseignée"}
          </span>
          {onOpenPane && (
            <button type="button" onClick={() => onOpenPane("dossier")}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 600, color: "#1a56db", fontFamily: "inherit", padding: 0 }}>
              Modifier dans les critères <ArrowRight size={11} />
            </button>
          )}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--text-5)", lineHeight: 1.5 }}>
          Les données financières des cibles (CA, EBITDA, effectifs) vivent sur leurs fiches univers, visibles depuis Marché, Cibles.
        </p>
      </div>
    </div>
  );
}
