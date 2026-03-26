import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidateDetail } from "@/lib/crm/get-candidates";
import { CANDIDATE_STATUSES, SENIORITY_OPTIONS, REMOTE_OPTIONS, RH_GEOGRAPHIES } from "@/lib/crm/matching-maps";
import {
  updateCandidateStatusAction,
  addJobAction,
  deleteJobAction,
  addSkillAction,
  deleteSkillAction,
  addInterviewAction,
  deleteCandidateDocumentAction,
} from "@/actions/candidates";
import { DriveDocumentPicker } from "@/components/candidates/DriveDocumentPicker";
import { ReportGenerator } from "@/components/candidates/ReportGenerator";
import { dealTypeLabels, dealStatusLabels } from "@/lib/crm/labels";
import { getMatchingDeals } from "@/actions/recruitment-matching";
import { scoreColor } from "@/lib/crm/recruitment-scoring";

const GEO_LABELS = Object.fromEntries(RH_GEOGRAPHIES.map(g => [g.value, g.label]));
const SEN_LABELS = Object.fromEntries(SENIORITY_OPTIONS.map(s => [s.value, s.label]));
const REM_LABELS = Object.fromEntries(REMOTE_OPTIONS.map(r => [r.value, r.label]));

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  rh:        "Entretien RH",
  client:    "Entretien client",
  technique: "Technique",
  autre:     "Autre",
};

const RECOMMENDATION_STYLES: Record<string, { bg: string; tx: string; label: string }> = {
  go:     { bg: "#D1FAE5", tx: "#065F46", label: "Go ✓" },
  no_go:  { bg: "#FEE2E2", tx: "#991B1B", label: "No go ✗" },
  maybe:  { bg: "#FEF3C7", tx: "#92400E", label: "À voir" },
};

const fmt = (d: string | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d)) : null;

const fmtShort = (d: string | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d)) : null;

const fmtMoney = (n: number | null) =>
  n != null ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) : null;

const fmtDateRange = (start: string | null, end: string | null, isCurrent: boolean) => {
  const s = start ? new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(new Date(start)) : null;
  const e = isCurrent ? "Présent" : end ? new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(new Date(end)) : null;
  if (s && e) return `${s} – ${e}`;
  if (s) return `depuis ${s}`;
  return null;
};

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await getCandidateDetail(id);
  if (!candidate) notFound();

  const [matchingDeals, reportsResult] = await Promise.all([
    getMatchingDeals(id),
    (await import("@/lib/supabase/server").then(m => m.createClient()))
      .from("candidate_reports")
      .select("id,label,token,expires_at,created_at")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const existingReports = (reportsResult.data ?? []) as {
    id: string; label: string | null; token: string; expires_at: string; created_at: string;
  }[];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const st = CANDIDATE_STATUSES.find(s => s.value === candidate.candidate_status);

  const inp = "width:100%;padding:8px 11px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:var(--surface);color:var(--text-1);box-sizing:border-box";
  const lbl = "display:block;font-size:11px;font-weight:700;color:var(--text-4);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em";
  const section = "background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px 22px;margin-bottom:12px";
  const subSection = "background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:16px 18px;margin-top:14px";

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {candidate.email && (
              <div>
                <div style={{ cssText: lbl } as React.CSSProperties}>Email</div>
                <a href={`mailto:${candidate.email}`} style={{ fontSize: 13, color: "#1a56db", textDecoration: "none" }}>{candidate.email}</a>
              </div>
            )}
            {candidate.phone && (
              <div>
                <div style={{ cssText: lbl } as React.CSSProperties}>Téléphone</div>
                <a href={`tel:${candidate.phone}`} style={{ fontSize: 13, color: "var(--text-2)", textDecoration: "none" }}>{candidate.phone}</a>
              </div>
            )}
            {candidate.linkedin_url && (
              <div>
                <div style={{ cssText: lbl } as React.CSSProperties}>LinkedIn</div>
                <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#1a56db", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                  Profil LinkedIn ↗
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Profil professionnel */}
        <div style={{ cssText: section } as React.CSSProperties}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>Profil</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <div>
              <div style={{ cssText: lbl } as React.CSSProperties}>Séniorité</div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{candidate.seniority ? SEN_LABELS[candidate.seniority] ?? candidate.seniority : "—"}</div>
            </div>
            <div>
              <div style={{ cssText: lbl } as React.CSSProperties}>Localisation</div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{candidate.location ? GEO_LABELS[candidate.location] ?? candidate.location : "—"}</div>
            </div>
            <div>
              <div style={{ cssText: lbl } as React.CSSProperties}>Remote</div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{candidate.remote_preference ? REM_LABELS[candidate.remote_preference] ?? candidate.remote_preference : "—"}</div>
            </div>
            <div>
              <div style={{ cssText: lbl } as React.CSSProperties}>Disponible à partir de</div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{fmt(candidate.available_from) ?? "—"}</div>
            </div>
            <div>
              <div style={{ cssText: lbl } as React.CSSProperties}>Rémunération actuelle</div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{fmtMoney(candidate.salary_current) ?? "—"}</div>
            </div>
            <div>
              <div style={{ cssText: lbl } as React.CSSProperties}>Prétentions</div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{fmtMoney(candidate.salary_target) ?? "—"}</div>
            </div>
          </div>
        </div>

        {/* ── EXPÉRIENCES ─────────────────────────────────────────────── */}
        <div style={{ cssText: section } as React.CSSProperties}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>
            Expériences {candidate.jobs.length > 0 && <span style={{ fontSize: 12, color: "var(--text-5)", fontWeight: 400 }}>({candidate.jobs.length})</span>}
          </div>

          {candidate.jobs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {candidate.jobs.map(job => (
                <div key={job.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)" }}>
                      {job.title}
                      {job.is_current && <span style={{ marginLeft: 6, fontSize: 10.5, padding: "1px 7px", borderRadius: 20, background: "#D1FAE5", color: "#065F46", fontWeight: 600 }}>En poste</span>}
                    </div>
                    {job.company_name && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 1 }}>{job.company_name}</div>}
                    {(job.start_date || job.end_date) && (
                      <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 2 }}>
                        {fmtDateRange(job.start_date, job.end_date, job.is_current)}
                      </div>
                    )}
                    {job.description && <div style={{ fontSize: 12.5, color: "var(--text-4)", marginTop: 4, lineHeight: 1.5 }}>{job.description}</div>}
                  </div>
                  <form action={deleteJobAction}>
                    <input type="hidden" name="job_id" value={job.id} />
                    <input type="hidden" name="candidate_id" value={id} />
                    <button type="submit" style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-5)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                      ✕
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          {/* Formulaire ajout expérience */}
          <div style={{ cssText: subSection } as React.CSSProperties}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>Ajouter une expérience</div>
            <form action={addJobAction}>
              <input type="hidden" name="candidate_id" value={id} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Intitulé *</label>
                  <input name="title" required style={{ cssText: inp } as React.CSSProperties} placeholder="ex: Directeur Commercial" />
                </div>
                <div>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Entreprise</label>
                  <input name="company_name" style={{ cssText: inp } as React.CSSProperties} placeholder="ex: Acme SAS" />
                </div>
                <div>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Date de début</label>
                  <input name="start_date" type="date" style={{ cssText: inp } as React.CSSProperties} />
                </div>
                <div>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Date de fin</label>
                  <input name="end_date" type="date" style={{ cssText: inp } as React.CSSProperties} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Description</label>
                  <textarea name="description" rows={2} style={{ cssText: inp + ";resize:vertical" } as React.CSSProperties} placeholder="Missions, réalisations..." />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input name="is_current" type="checkbox" id={`is_current_${id}`} style={{ width: 14, height: 14 }} />
                  <label htmlFor={`is_current_${id}`} style={{ fontSize: 13, color: "var(--text-3)", cursor: "pointer" }}>Poste actuel</label>
                </div>
              </div>
              <button type="submit" style={{ padding: "7px 16px", borderRadius: 7, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                + Ajouter
              </button>
            </form>
          </div>
        </div>

        {/* ── COMPÉTENCES ─────────────────────────────────────────────── */}
        <div style={{ cssText: section } as React.CSSProperties}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>
            Compétences {candidate.skills.length > 0 && <span style={{ fontSize: 12, color: "var(--text-5)", fontWeight: 400 }}>({candidate.skills.length})</span>}
          </div>

          {candidate.skills.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
              {candidate.skills.map(skill => {
                const levelColors: Record<string, { bg: string; tx: string }> = {
                  junior:  { bg: "#F3F4F6", tx: "#6B7280" },
                  mid:     { bg: "#DBEAFE", tx: "#1D4ED8" },
                  senior:  { bg: "#EDE9FE", tx: "#5B21B6" },
                  expert:  { bg: "#FEF3C7", tx: "#92400E" },
                };
                const lc = skill.level ? levelColors[skill.level] : { bg: "var(--surface-3)", tx: "var(--text-4)" };
                return (
                  <div key={skill.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: lc.bg, border: "1px solid transparent" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: lc.tx }}>{skill.skill_name}</span>
                    {skill.level && <span style={{ fontSize: 10.5, color: lc.tx, opacity: .7 }}>· {skill.level}</span>}
                    {!skill.is_shareable && <span style={{ fontSize: 10, color: "var(--text-5)", marginLeft: 2 }}>🔒</span>}
                    <form action={deleteSkillAction} style={{ display: "inline" }}>
                      <input type="hidden" name="skill_id" value={skill.id} />
                      <input type="hidden" name="candidate_id" value={id} />
                      <button type="submit" style={{ marginLeft: 2, padding: "0 3px", border: "none", background: "transparent", color: lc.tx, fontSize: 11, cursor: "pointer", opacity: .6, lineHeight: 1 }}>✕</button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulaire ajout compétence */}
          <div style={{ cssText: subSection } as React.CSSProperties}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>Ajouter une compétence</div>
            <form action={addSkillAction}>
              <input type="hidden" name="candidate_id" value={id} />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, alignItems: "flex-end" }}>
                <div>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Compétence *</label>
                  <input name="skill_name" required style={{ cssText: inp } as React.CSSProperties} placeholder="ex: Gestion P&L, Levée de fonds..." />
                </div>
                <div>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Niveau</label>
                  <select name="level" style={{ cssText: inp } as React.CSSProperties}>
                    <option value="">—</option>
                    <option value="junior">Junior</option>
                    <option value="mid">Confirmé</option>
                    <option value="senior">Senior</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <button type="submit" style={{ padding: "8px 14px", borderRadius: 7, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  + Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── ENTRETIENS ──────────────────────────────────────────────── */}
        <div style={{ cssText: section } as React.CSSProperties}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>
            Entretiens {candidate.interviews.length > 0 && <span style={{ fontSize: 12, color: "var(--text-5)", fontWeight: 400 }}>({candidate.interviews.length})</span>}
          </div>

          {candidate.interviews.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {candidate.interviews.map(itv => {
                const rec = itv.recommendation ? RECOMMENDATION_STYLES[itv.recommendation] : null;
                return (
                  <div key={itv.id} style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {itv.interview_type && (
                          <span style={{ fontSize: 11.5, padding: "1px 8px", borderRadius: 20, background: "var(--surface-3)", color: "var(--text-3)", fontWeight: 600 }}>
                            {INTERVIEW_TYPE_LABELS[itv.interview_type] ?? itv.interview_type}
                          </span>
                        )}
                        {rec && (
                          <span style={{ fontSize: 11.5, padding: "1px 8px", borderRadius: 20, background: rec.bg, color: rec.tx, fontWeight: 700 }}>
                            {rec.label}
                          </span>
                        )}
                        {itv.score != null && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>{itv.score}/10</span>
                        )}
                      </div>
                      <span style={{ fontSize: 11.5, color: "var(--text-5)" }}>
                        {itv.interview_date ? fmtShort(itv.interview_date) : fmtShort(itv.created_at)}
                      </span>
                    </div>
                    {itv.interviewer && <div style={{ fontSize: 12.5, color: "var(--text-4)", marginBottom: 4 }}>Intervieweur : {itv.interviewer}</div>}
                    {itv.feedback && <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{itv.feedback}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulaire ajout entretien */}
          <div style={{ cssText: subSection } as React.CSSProperties}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>Ajouter un entretien</div>
            <form action={addInterviewAction}>
              <input type="hidden" name="candidate_id" value={id} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Type</label>
                  <select name="interview_type" style={{ cssText: inp } as React.CSSProperties}>
                    <option value="">—</option>
                    <option value="rh">Entretien RH</option>
                    <option value="client">Entretien client</option>
                    <option value="technique">Technique</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Date</label>
                  <input name="interview_date" type="datetime-local" style={{ cssText: inp } as React.CSSProperties} />
                </div>
                <div>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Intervieweur</label>
                  <input name="interviewer" style={{ cssText: inp } as React.CSSProperties} placeholder="Prénom Nom" />
                </div>
                <div>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Score (0-10)</label>
                  <input name="score" type="number" min="0" max="10" step="0.5" style={{ cssText: inp } as React.CSSProperties} placeholder="ex: 7.5" />
                </div>
                <div>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Recommandation</label>
                  <select name="recommendation" style={{ cssText: inp } as React.CSSProperties}>
                    <option value="">—</option>
                    <option value="go">Go ✓</option>
                    <option value="maybe">À voir</option>
                    <option value="no_go">No go ✗</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ cssText: lbl } as React.CSSProperties}>Feedback</label>
                  <textarea name="feedback" rows={2} style={{ cssText: inp + ";resize:vertical" } as React.CSSProperties} placeholder="Points forts, points faibles, observations..." />
                </div>
              </div>
              <button type="submit" style={{ padding: "7px 16px", borderRadius: 7, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                + Ajouter l&apos;entretien
              </button>
            </form>
          </div>
        </div>

        {/* ── DOSSIERS LIÉS ───────────────────────────────────────────── */}
        {candidate.linked_deals.length > 0 && (
          <div style={{ cssText: section } as React.CSSProperties}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>
              Dossiers liés ({candidate.linked_deals.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {candidate.linked_deals.map(ld => {
                const deal = ld.deal;
                if (!deal) return null;
                const dealStatus = dealStatusLabels[deal.deal_status] ?? deal.deal_status;
                const dealType   = dealTypeLabels[deal.deal_type] ?? deal.deal_type;
                return (
                  <Link key={ld.id} href={`/protected/dossiers/${deal.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)", textDecoration: "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)" }}>{deal.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 2 }}>
                        {dealType} · {dealStatus} · Stage pipeline : {ld.stage}
                      </div>
                    </div>
                    {ld.combined_score != null && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1a56db" }}>Score {Math.round(ld.combined_score)}</div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── NOTES ───────────────────────────────────────────────────── */}
        {(candidate.notes_internal || candidate.notes_shareable) && (
          <div style={{ cssText: section } as React.CSSProperties}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>Notes</div>
            {candidate.notes_internal && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ cssText: lbl } as React.CSSProperties}>Notes internes <span style={{ fontWeight: 400, color: "var(--text-5)", textTransform: "none" }}>(jamais partagées)</span></div>
                <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{candidate.notes_internal}</div>
              </div>
            )}
            {candidate.notes_shareable && (
              <div>
                <div style={{ cssText: lbl } as React.CSSProperties}>Notes partageables</div>
                <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{candidate.notes_shareable}</div>
              </div>
            )}
          </div>
        )}

        {/* ── DOSSIERS COMPATIBLES (matching M4) ─────────────────────── */}
        {matchingDeals.results.length > 0 && (
          <div style={{ cssText: section } as React.CSSProperties}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>
              Dossiers compatibles ({matchingDeals.results.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {matchingDeals.results.slice(0, 10).map(r => {
                const sc = scoreColor(r.score);
                return (
                  <Link key={r.deal_id} href={`/protected/dossiers/${r.deal_id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--bg)", borderRadius: 9, border: "1px solid var(--border)", textDecoration: "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)" }}>{r.deal_name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 1 }}>
                        {r.job_title ? `${r.job_title} · ` : ""}{dealTypeLabels[r.deal_type] ?? r.deal_type} · {dealStatusLabels[r.deal_status] ?? r.deal_status}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      {r.in_deal && (
                        <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 20, background: "#DBEAFE", color: "#1D4ED8", fontWeight: 600 }}>
                          {r.dc_stage ?? "En process"}
                        </span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: sc.bg, color: sc.tx }}>
                        {r.score}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── RAPPORT CLIENT ──────────────────────────────────────────── */}
        <div style={{ cssText: section } as React.CSSProperties}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 14 }}>Rapport client partageable</div>
          <ReportGenerator
            candidateId={id}
            existingReports={existingReports}
            appUrl={appUrl}
          />
        </div>

        {/* ── DOCUMENTS ───────────────────────────────────────────────── */}
        <div style={{ cssText: section } as React.CSSProperties}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Documents</div>
            <DriveDocumentPicker candidateId={id} />
          </div>

          {candidate.documents.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--text-5)", fontStyle: "italic" }}>Aucun document lié.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {candidate.documents.map(doc => {
                const docTypeLabels: Record<string, string> = {
                  cv: "CV", cover_letter: "Lettre de motivation", portfolio: "Portfolio",
                  reference: "Référence", other: "Autre",
                };
                const isImage = doc.mime_type?.startsWith("image/");
                const isPdf   = doc.mime_type === "application/pdf";
                const icon    = isPdf ? "📄" : isImage ? "🖼️" : "📎";
                return (
                  <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 16 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", textDecoration: "none" }}>
                        {doc.file_name}
                      </a>
                      <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 1 }}>
                        {docTypeLabels[doc.document_type] ?? doc.document_type} · {fmtShort(doc.created_at)}
                      </div>
                    </div>
                    <form action={deleteCandidateDocumentAction}>
                      <input type="hidden" name="doc_id" value={doc.id} />
                      <input type="hidden" name="candidate_id" value={id} />
                      <button type="submit" style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-4)", cursor: "pointer", fontFamily: "inherit" }}>
                        Supprimer
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── STATUT ──────────────────────────────────────────────────── */}
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

          {/* Historique */}
          {candidate.status_log.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Historique</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {candidate.status_log.map(log => {
                  const newSt = CANDIDATE_STATUSES.find(s => s.value === log.new_status);
                  return (
                    <div key={log.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ fontSize: 11.5, color: "var(--text-5)", minWidth: 90, paddingTop: 1 }}>{fmtShort(log.created_at)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
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
                        <div style={{ fontSize: 12, color: "var(--text-4)", fontStyle: "italic" }}>{log.note}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Métadonnées */}
        <div style={{ fontSize: 11.5, color: "var(--text-5)", textAlign: "right", marginTop: 4 }}>
          Créé le {fmt(candidate.created_at)} · Source : {candidate.source}
        </div>

      </div>
    </div>
  );
}

export default function CandidatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ height: 600, borderRadius: 14, background: "var(--surface-2)" }} /></div>}>
      <Content params={params} />
    </Suspense>
  );
}
