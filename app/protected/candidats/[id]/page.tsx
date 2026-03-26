import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidateDetail } from "@/lib/crm/get-candidates";
import { CANDIDATE_STATUSES, SENIORITY_OPTIONS, REMOTE_OPTIONS, RH_GEOGRAPHIES } from "@/lib/crm/matching-maps";
import { updateCandidateStatusAction } from "@/actions/candidates";

const GEO_LABELS = Object.fromEntries(RH_GEOGRAPHIES.map(g => [g.value, g.label]));
const SEN_LABELS = Object.fromEntries(SENIORITY_OPTIONS.map(s => [s.value, s.label]));
const REM_LABELS = Object.fromEntries(REMOTE_OPTIONS.map(r => [r.value, r.label]));

const fmt = (d: string | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d)) : null;

const fmtShort = (d: string | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d)) : null;

const fmtMoney = (n: number | null) =>
  n != null ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) : null;

async function Content({ id }: { id: string }) {
  const candidate = await getCandidateDetail(id);
  if (!candidate) notFound();

  const st = CANDIDATE_STATUSES.find(s => s.value === candidate.candidate_status);
  const inp = "width:100%;padding:8px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:var(--surface);color:var(--text-1);box-sizing:border-box";
  const lbl = "display:block;font-size:11px;font-weight:700;color:var(--text-4);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em";
  const section = "background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 22px;margin-bottom:12px";

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
              <Link href="/protected/candidats" style={{ color: "var(--text-5)", textDecoration: "none" }}>Candidats</Link>
              {" · "}
              <span>{candidate.last_name} {candidate.first_name}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>
              {candidate.last_name} {candidate.first_name}
            </h1>
            {candidate.title && (
              <div style={{ fontSize: 14, color: "var(--text-3)", marginTop: 4 }}>
                {candidate.title}{candidate.current_company ? ` · ${candidate.current_company}` : ""}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {st && (
              <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: st.bg, color: st.tx, fontWeight: 700 }}>
                {st.label}
              </span>
            )}
            <Link
              href={`/protected/candidats/${id}/modifier`}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-3)", textDecoration: "none", fontSize: 13 }}
            >
              Modifier
            </Link>
          </div>
        </div>

        {/* Coordonnées */}
        <div style={{ cssText: section } as React.CSSProperties}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>Coordonnées</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {candidate.email && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>Email</div>
                <a href={`mailto:${candidate.email}`} style={{ fontSize: 13.5, color: "#1a56db", textDecoration: "none" }}>{candidate.email}</a>
              </div>
            )}
            {candidate.phone && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>Téléphone</div>
                <a href={`tel:${candidate.phone}`} style={{ fontSize: 13.5, color: "var(--text-2)", textDecoration: "none" }}>{candidate.phone}</a>
              </div>
            )}
            {candidate.linkedin_url && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>LinkedIn</div>
                <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#1a56db", textDecoration: "none" }}>{candidate.linkedin_url}</a>
              </div>
            )}
          </div>
        </div>

        {/* Profil professionnel */}
        <div style={{ cssText: section } as React.CSSProperties}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>Profil professionnel</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>Séniorité</div>
              <div style={{ fontSize: 13.5, color: "var(--text-2)" }}>{candidate.seniority ? SEN_LABELS[candidate.seniority] ?? candidate.seniority : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>Localisation</div>
              <div style={{ fontSize: 13.5, color: "var(--text-2)" }}>{candidate.location ? GEO_LABELS[candidate.location] ?? candidate.location : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>Remote</div>
              <div style={{ fontSize: 13.5, color: "var(--text-2)" }}>{candidate.remote_preference ? REM_LABELS[candidate.remote_preference] ?? candidate.remote_preference : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>Disponible à partir de</div>
              <div style={{ fontSize: 13.5, color: "var(--text-2)" }}>{fmt(candidate.available_from) ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>Rémunération actuelle</div>
              <div style={{ fontSize: 13.5, color: "var(--text-2)" }}>{fmtMoney(candidate.salary_current) ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>Prétentions</div>
              <div style={{ fontSize: 13.5, color: "var(--text-2)" }}>{fmtMoney(candidate.salary_target) ?? "—"}</div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {(candidate.notes_internal || candidate.notes_shareable) && (
          <div style={{ cssText: section } as React.CSSProperties}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>Notes</div>
            {candidate.notes_internal && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
                  Notes internes <span style={{ fontWeight: 400, color: "var(--text-5)", textTransform: "none" }}>(jamais partagées)</span>
                </div>
                <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{candidate.notes_internal}</div>
              </div>
            )}
            {candidate.notes_shareable && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
                  Notes partageables
                </div>
                <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{candidate.notes_shareable}</div>
              </div>
            )}
          </div>
        )}

        {/* Changer le statut */}
        <div style={{ cssText: section } as React.CSSProperties}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>Changer le statut</div>
          <form action={updateCandidateStatusAction}>
            <input type="hidden" name="candidate_id" value={id} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Nouveau statut</label>
                <select name="new_status" style={{ cssText: inp } as React.CSSProperties}>
                  {CANDIDATE_STATUSES.map(s => (
                    <option key={s.value} value={s.value} selected={s.value === candidate.candidate_status}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Note (obligatoire) *</label>
                <input name="note" required placeholder="Raison du changement de statut..." style={{ cssText: inp } as React.CSSProperties} />
              </div>
            </div>
            <button type="submit" style={{ padding: "8px 18px", borderRadius: 8, background: "#1a56db", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Enregistrer le changement
            </button>
          </form>
        </div>

        {/* Historique des statuts */}
        {candidate.status_log.length > 0 && (
          <div style={{ cssText: section } as React.CSSProperties}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>Historique</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {candidate.status_log.map(log => {
                const newSt = CANDIDATE_STATUSES.find(s => s.value === log.new_status);
                return (
                  <div key={log.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11.5, color: "var(--text-5)", minWidth: 90, paddingTop: 1 }}>{fmtShort(log.created_at)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        {log.old_status && (
                          <>
                            <span style={{ fontSize: 11.5, color: "var(--text-4)" }}>
                              {CANDIDATE_STATUSES.find(s => s.value === log.old_status)?.label ?? log.old_status}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-5)" }}>→</span>
                          </>
                        )}
                        {newSt && (
                          <span style={{ fontSize: 11.5, padding: "1px 8px", borderRadius: 20, background: newSt.bg, color: newSt.tx, fontWeight: 600 }}>
                            {newSt.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-3)", fontStyle: "italic" }}>{log.note}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Métadonnées */}
        <div style={{ fontSize: 11.5, color: "var(--text-5)", textAlign: "right" }}>
          Créé le {fmt(candidate.created_at)} · Source : {candidate.source}
        </div>

      </div>
    </div>
  );
}

export default function CandidatDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ height: 600, borderRadius: 14, background: "var(--surface-2)" }} /></div>}>
      <Content id={params.id} />
    </Suspense>
  );
}
