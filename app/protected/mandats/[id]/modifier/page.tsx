"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMandateById, updateMandate } from "@/actions/mandates";
import { getAllOrganisationsSimple } from "@/actions/organisations";

const TYPES = [
  { value: "fundraising", label: "Fundraising" },
  { value: "ma_sell",     label: "M&A Sell-side" },
  { value: "ma_buy",      label: "M&A Buy-side" },
  { value: "cfo_advisor", label: "CFO Advisory" },
  { value: "recruitment", label: "Recrutement" },
];
const STATUSES = [
  { value: "draft",   label: "Brouillon" },
  { value: "active",  label: "Actif" },
  { value: "on_hold", label: "En pause" },
  { value: "won",     label: "Gagné" },
  { value: "lost",    label: "Perdu" },
  { value: "closed",  label: "Clôturé" },
];
const PRIORITIES = [
  { value: "high",   label: "Haute" },
  { value: "medium", label: "Moyenne" },
  { value: "low",    label: "Basse" },
];
const CURRENCIES  = ["EUR", "CHF", "USD", "GBP"];
const FEE_BASES   = [
  { value: "ev",           label: "Valeur d'entreprise (EV)" },
  { value: "revenue",      label: "Chiffre d'affaires" },
  { value: "raise_amount", label: "Montant levé" },
  { value: "salary",       label: "Salaire annuel" },
];

export default function ModifierMandatPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", type: "fundraising", client_organization_id: "",
    status: "active", priority: "medium", currency: "EUR",
    description: "", start_date: "", target_close_date: "",
    success_fee_percent: "", success_fee_base: "ev",
    operation_amount: "", retainer_monthly: "", estimated_fee_amount: "", notes: "",
  });

  useEffect(() => {
    Promise.all([
      getMandateById(id),
      getAllOrganisationsSimple(),
    ]).then(([mandate, orgList]) => {
      setOrgs(orgList);
      if (mandate) {
        setForm({
          name:                    mandate.name ?? "",
          type:                    mandate.type ?? "fundraising",
          client_organization_id:  mandate.client_organization_id ?? "",
          status:                  mandate.status ?? "active",
          priority:                mandate.priority ?? "medium",
          currency:                mandate.currency ?? "EUR",
          description:             mandate.description ?? "",
          start_date:              mandate.start_date ?? "",
          target_close_date:       mandate.target_close_date ?? "",
          success_fee_percent:     mandate.success_fee_percent != null ? String(mandate.success_fee_percent) : "",
          success_fee_base:        mandate.success_fee_base ?? "ev",
          operation_amount:        mandate.operation_amount != null ? String(mandate.operation_amount) : "",
          retainer_monthly:        mandate.retainer_monthly != null ? String(mandate.retainer_monthly) : "",
          estimated_fee_amount:    mandate.estimated_fee_amount != null ? String(mandate.estimated_fee_amount) : "",
          notes:                   mandate.notes ?? "",
        });
      }
      setInitialLoading(false);
    }).catch(() => setInitialLoading(false));
  }, [id]);

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim())            { setError("Le nom est obligatoire"); return; }
    if (!form.client_organization_id) { setError("Sélectionnez un client"); return; }

    setLoading(true);
    setError(null);

    const r = await updateMandate(id, {
      name:                   form.name.trim(),
      type:                   form.type,
      client_organization_id: form.client_organization_id,
      status:                 form.status,
      priority:               form.priority,
      currency:               form.currency,
      description:            form.description  || null,
      start_date:             form.start_date   || null,
      target_close_date:      form.target_close_date || null,
      success_fee_percent:    form.success_fee_percent ? Number(form.success_fee_percent) : null,
      success_fee_base:       form.success_fee_percent ? form.success_fee_base : null,
      operation_amount:       form.operation_amount ? Number(form.operation_amount) : null,
      retainer_monthly:       form.retainer_monthly ? Number(form.retainer_monthly) : null,
      estimated_fee_amount:   form.estimated_fee_amount ? Number(form.estimated_fee_amount) : null,
      notes:                  form.notes || null,
    });

    setLoading(false);
    if (!r.success) { setError(r.error); return; }
    router.push(`/protected/mandats/${id}`);
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", border: "1px solid var(--border)",
    borderRadius: 9, fontSize: 13, fontFamily: "inherit", outline: "none",
    background: "var(--surface)", color: "var(--text-1)", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase",
    letterSpacing: ".05em", display: "block", marginBottom: 5,
  };
  const section: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 14, padding: "20px 22px", marginBottom: 12,
  };

  if (initialLoading) {
    return (
      <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ height: 400, borderRadius: 14, background: "var(--surface-2)" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        <Link href={`/protected/mandats/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-4)", textDecoration: "none", marginBottom: 20 }}>
          <ArrowLeft size={13} /> Mandat
        </Link>

        <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>Modifier le mandat</h1>

        {error && (
          <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Identification */}
          <div style={section}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Identification</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={lbl}>Nom du mandat *</label>
                <input style={inp} value={form.name} onChange={setF("name")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={lbl}>Type *</label>
                  <select style={inp} value={form.type} onChange={setF("type")}>
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Client *</label>
                  <select style={inp} value={form.client_organization_id} onChange={setF("client_organization_id")}>
                    <option value="">— Sélectionner —</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={lbl}>Statut</label>
                  <select style={inp} value={form.status} onChange={setF("status")}>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Priorité</label>
                  <select style={inp} value={form.priority} onChange={setF("priority")}>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Devise</label>
                  <select style={inp} value={form.currency} onChange={setF("currency")}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Description</label>
                <textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} value={form.description} onChange={setF("description")} />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div style={section}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Calendrier</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Date de début</label>
                <input style={inp} type="date" value={form.start_date} onChange={setF("start_date")} />
              </div>
              <div>
                <label style={lbl}>Objectif de clôture</label>
                <input style={inp} type="date" value={form.target_close_date} onChange={setF("target_close_date")} />
              </div>
            </div>
          </div>

          {/* Honoraires */}
          <div style={section}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Opération & Honoraires</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={lbl}>
                  {{fundraising:"Montant à lever",ma_sell:"Valorisation cible (EV)",ma_buy:"Budget d'acquisition",recruitment:"Salaire annuel (base)",cfo_advisor:"Budget mission"}[form.type] ?? "Montant de l'opération"}
                </label>
                <input style={inp} type="number" placeholder="0" value={form.operation_amount} onChange={setF("operation_amount")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={lbl}>Success fee (%)</label>
                  <input style={inp} type="number" step="0.1" placeholder="ex: 3" value={form.success_fee_percent} onChange={setF("success_fee_percent")} />
                </div>
                <div>
                  <label style={lbl}>Base de calcul</label>
                  <select style={inp} value={form.success_fee_base} onChange={setF("success_fee_base")}>
                    {FEE_BASES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={lbl}>Retainer mensuel</label>
                  <input style={inp} type="number" placeholder="0" value={form.retainer_monthly} onChange={setF("retainer_monthly")} />
                </div>
                <div>
                  <label style={lbl}>Honoraires estimés total</label>
                  <input style={inp} type="number" placeholder="0" value={form.estimated_fee_amount} onChange={setF("estimated_fee_amount")} />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={section}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 12 }}>Notes internes</div>
            <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} value={form.notes} onChange={setF("notes")} />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Link href={`/protected/mandats/${id}`} style={{
              padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)",
              background: "var(--surface-2)", color: "var(--text-3)", fontSize: 13, textDecoration: "none",
            }}>
              Annuler
            </Link>
            <button type="submit" disabled={loading} style={{
              padding: "10px 24px", borderRadius: 10, border: "none",
              background: "var(--text-1)", color: "var(--bg)", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1,
            }}>
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
