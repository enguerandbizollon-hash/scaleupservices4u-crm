import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintButton } from "./PrintButton";

// Page publique — aucune auth requise
// Accès via token unique (30 jours)

const fmt = (d: string | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d)) : null;

const SENIORITY_LABELS: Record<string, string> = {
  junior: "Junior", mid: "Confirmé", senior: "Senior", lead: "Lead",
  director: "Directeur", "c-level": "C-Level",
};

const REC_LABELS: Record<string, { label: string; color: string }> = {
  go:    { label: "Recommandé ✓",  color: "#065F46" },
  no_go: { label: "Non recommandé", color: "#991B1B" },
  maybe: { label: "À considérer",  color: "#92400E" },
};

const INT_TYPE_LABELS: Record<string, string> = {
  rh: "Entretien RH", client: "Entretien client", technique: "Technique", autre: "Entretien",
};

export default async function RapportPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase  = createAdminClient();

  // Valider le token
  const { data: report } = await supabase
    .from("candidate_reports")
    .select("candidate_id, label, expires_at, created_at")
    .eq("token", token)
    .maybeSingle();

  if (!report) notFound();
  if (new Date(report.expires_at) < new Date()) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ textAlign: "center", color: "#6B7280" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Rapport expiré</div>
          <div style={{ fontSize: 14 }}>Ce lien n'est plus valide. Contactez votre consultant ScaleUp Services 4U.</div>
        </div>
      </div>
    );
  }

  const candidateId = report.candidate_id;

  // Charger les données partageable
  const [
    { data: candidate },
    { data: skills },
    { data: interviews },
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select("first_name,last_name,title,current_company,location,seniority,notes_shareable,linkedin_url")
      .eq("id", candidateId)
      .maybeSingle(),
    supabase
      .from("candidate_skills")
      .select("skill_name,level,weight")
      .eq("candidate_id", candidateId)
      .eq("is_shareable", true)
      .order("weight", { ascending: false }),
    supabase
      .from("candidate_interviews")
      .select("interview_date,interview_type,score,feedback,recommendation")
      .eq("candidate_id", candidateId)
      .eq("is_confidential", false)
      .order("interview_date", { ascending: false }),
  ]);

  if (!candidate) notFound();

  const generatedDate = fmt(report.created_at);

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Barre impression */}
      <div className="no-print" style={{ background: "#1a56db", color: "#fff", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Rapport candidat — ScaleUp Services 4U</span>
        <PrintButton />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 60px" }}>

        {/* En-tête rapport */}
        <div style={{ borderBottom: "2px solid #1a56db", paddingBottom: 20, marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#1a56db", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
            ScaleUp Services 4U · Rapport candidat
          </div>
          <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 800, color: "#111" }}>
            {candidate.first_name} {candidate.last_name}
          </h1>
          {candidate.title && (
            <div style={{ fontSize: 16, color: "#374151", marginBottom: 2 }}>
              {candidate.title}{candidate.current_company ? ` · ${candidate.current_company}` : ""}
            </div>
          )}
          <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
            {candidate.seniority && (
              <span style={{ fontSize: 13, color: "#6B7280" }}>
                {SENIORITY_LABELS[candidate.seniority] ?? candidate.seniority}
              </span>
            )}
            {candidate.location && (
              <span style={{ fontSize: 13, color: "#6B7280" }}>📍 {candidate.location}</span>
            )}
            {candidate.linkedin_url && (
              <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#1a56db" }}>
                LinkedIn
              </a>
            )}
          </div>
          {report.label && (
            <div style={{ marginTop: 10, fontSize: 13, color: "#6B7280", fontStyle: "italic" }}>{report.label}</div>
          )}
        </div>

        {/* Synthèse partageable */}
        {candidate.notes_shareable && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10, borderLeft: "3px solid #1a56db", paddingLeft: 10 }}>
              Synthèse
            </h2>
            <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: 0 }}>
              {candidate.notes_shareable}
            </p>
          </div>
        )}

        {/* Compétences */}
        {skills && skills.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12, borderLeft: "3px solid #1a56db", paddingLeft: 10 }}>
              Compétences clés
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {skills.map(s => (
                <span
                  key={s.skill_name}
                  style={{
                    fontSize: 13,
                    padding: "4px 12px",
                    borderRadius: 20,
                    background: s.weight >= 2 ? "#EEF2FF" : "#F3F4F6",
                    color: s.weight >= 2 ? "#3730A3" : "#374151",
                    fontWeight: s.weight >= 2 ? 700 : 500,
                    border: `1px solid ${s.weight >= 2 ? "#C7D2FE" : "#E5E7EB"}`,
                  }}
                >
                  {s.skill_name}{s.level ? ` · ${s.level}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Entretiens non-confidentiels */}
        {interviews && interviews.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12, borderLeft: "3px solid #1a56db", paddingLeft: 10 }}>
              Entretiens
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {interviews.map((iv, i) => {
                const rec = iv.recommendation ? REC_LABELS[iv.recommendation] : null;
                return (
                  <div key={i} style={{ padding: "14px 16px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
                        {INT_TYPE_LABELS[iv.interview_type ?? ""] ?? (iv.interview_type ?? "Entretien")}
                        {iv.interview_date ? ` · ${fmt(iv.interview_date)}` : ""}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {iv.score != null && (
                          <span style={{ fontSize: 13, fontWeight: 800, color: iv.score >= 7 ? "#065F46" : iv.score >= 4 ? "#92400E" : "#991B1B" }}>
                            {iv.score}/10
                          </span>
                        )}
                        {rec && (
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: rec.color }}>{rec.label}</span>
                        )}
                      </div>
                    </div>
                    {iv.feedback && (
                      <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.6, margin: 0 }}>{iv.feedback}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 20, marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>ScaleUp Services 4U SA</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>M&A · Fundraising · Recrutement</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#9CA3AF" }}>
            <div>Généré le {generatedDate}</div>
            <div>Document confidentiel · Usage restreint</div>
          </div>
        </div>

      </div>
    </div>
  );
}
