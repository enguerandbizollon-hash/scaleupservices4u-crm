import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";
import { CANDIDATE_STATUSES } from "@/lib/crm/matching-maps";
import { getReactivationAlerts } from "@/lib/crm/get-candidates";

export const revalidate = 0;

const fmt = (d: string | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(d)) : null;

async function Content() {
  const supabase = await createClient();

  const [candidatesResult, alerts] = await Promise.all([
    supabase
      .from("candidates")
      .select("id,first_name,last_name,email,title,current_company,location,seniority,candidate_status,last_contact_date,created_at")
      .order("last_name"),
    getReactivationAlerts(),
  ]);

  const list = candidatesResult.data ?? [];

  // Comptages par statut
  const counts: Record<string, number> = {};
  for (const c of list) counts[c.candidate_status] = (counts[c.candidate_status] ?? 0) + 1;

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>

      {/* En-tête */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>Candidats</h1>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, padding: "2px 9px", borderRadius: 20, background: "var(--surface-3)", color: "var(--text-4)", fontWeight: 600 }}>
              {list.length} total
            </span>
            {CANDIDATE_STATUSES.map(s => counts[s.value] ? (
              <span key={s.value} style={{ fontSize: 12, padding: "2px 9px", borderRadius: 20, background: s.bg, color: s.tx, fontWeight: 600 }}>
                {counts[s.value]} {s.label.toLowerCase()}
              </span>
            ) : null)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/protected/candidats/stats"
            style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-3)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}
          >
            Statistiques
          </Link>
          <Link
            href="/protected/candidats/nouveau"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9, background: "#1a56db", color: "#fff", textDecoration: "none", fontSize: 13.5, fontWeight: 600 }}
          >
            <Plus size={14} /> Nouveau candidat
          </Link>
        </div>
      </div>

      {/* Alertes réactivation M5 */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#92400E", marginBottom: 6 }}>
            ⏰ {alerts.length} candidat{alerts.length > 1 ? "s" : ""} placé{alerts.length > 1 ? "s" : ""} sans contact depuis 18+ mois
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {alerts.map(a => (
              <Link key={a.id} href={`/protected/candidats/${a.id}`} style={{ fontSize: 12, padding: "2px 10px", borderRadius: 20, background: "#FDE68A", color: "#78350F", textDecoration: "none", fontWeight: 600 }}>
                {a.last_name} {a.first_name} · {a.months_since_contact} mois
              </Link>
            ))}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-5)", fontSize: 14 }}>
          Aucun candidat — <Link href="/protected/candidats/nouveau" style={{ color: "#1a56db" }}>ajouter le premier</Link>
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                {["Candidat", "Poste / Entreprise", "Lieu", "Séniorité", "Statut", "Dernier contact"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((c, i) => {
                const st = CANDIDATE_STATUSES.find(s => s.value === c.candidate_status);
                return (
                  <tr
                    key={c.id}
                    style={{ borderBottom: i < list.length - 1 ? "1px solid var(--border)" : "none", transition: "background .1s" }}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <Link href={`/protected/candidats/${c.id}`} style={{ textDecoration: "none" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)" }}>
                          {c.last_name} {c.first_name}
                        </div>
                        {c.email && <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 1 }}>{c.email}</div>}
                      </Link>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, color: "var(--text-2)" }}>{c.title ?? "—"}</div>
                      {c.current_company && <div style={{ fontSize: 12, color: "var(--text-5)" }}>{c.current_company}</div>}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-3)" }}>{c.location ?? "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-3)", textTransform: "capitalize" }}>{c.seniority ?? "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      {st && (
                        <span style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 20, background: st.bg, color: st.tx, fontWeight: 600 }}>
                          {st.label}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--text-5)" }}>
                      {fmt(c.last_contact_date) ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CandidatsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ height: 400, borderRadius: 14, background: "var(--surface-2)" }} /></div>}>
      <Content />
    </Suspense>
  );
}
