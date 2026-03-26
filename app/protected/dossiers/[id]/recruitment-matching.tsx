"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { addCandidateToDealAction } from "@/actions/recruitment-kanban";
import { getCandidateRanking } from "@/actions/recruitment-matching";
import { CANDIDATE_STATUSES, SENIORITY_OPTIONS, REMOTE_OPTIONS, RH_GEOGRAPHIES } from "@/lib/crm/matching-maps";
import { scoreColor } from "@/lib/crm/recruitment-scoring";
import { UserSearch, Plus } from "lucide-react";

const SEN_LABELS = Object.fromEntries(SENIORITY_OPTIONS.map(s => [s.value, s.label.split(" (")[0]]));
const GEO_LABELS = Object.fromEntries(RH_GEOGRAPHIES.map(g => [g.value, g.label]));
const REM_LABELS = Object.fromEntries(REMOTE_OPTIONS.map(r => [r.value, r.label]));

const CRITERION_LABELS: Record<string, string> = {
  skills:    "Compétences",
  seniority: "Séniorité",
  salary:    "Rémunération",
  geography: "Localisation",
  remote:    "Remote",
};

type RankResult = Awaited<ReturnType<typeof getCandidateRanking>>["results"][number];

function CriterionTag({ label, pct, active }: { label: string; pct: number; active: boolean }) {
  const color = !active
    ? { bg: "var(--surface-3)", tx: "var(--text-5)" }
    : pct >= 80
    ? { bg: "#D1FAE5", tx: "#065F46" }
    : pct >= 40
    ? { bg: "#FEF3C7", tx: "#92400E" }
    : { bg: "#FEE2E2", tx: "#991B1B" };

  return (
    <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 20, background: color.bg, color: color.tx, fontWeight: 600, whiteSpace: "nowrap" }}>
      {label}{active ? ` ${pct}%` : " —"}
    </span>
  );
}

function RankCard({ result, dealId, onAdded }: { result: RankResult; dealId: string; onAdded: () => void }) {
  const [adding, setAdding] = useState(false);
  const st = CANDIDATE_STATUSES.find(s => s.value === result.candidate_status);
  const sc = scoreColor(result.score);

  async function add() {
    setAdding(true);
    await addCandidateToDealAction(dealId, result.candidate_id);
    setAdding(false);
    onAdded();
  }

  if (result.eliminatory) {
    return (
      <div style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", opacity: .5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href={`/protected/candidats/${result.candidate_id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)", textDecoration: "none" }}>
            {result.last_name} {result.first_name}
          </Link>
          <span style={{ fontSize: 10.5, padding: "1px 8px", borderRadius: 20, background: "#FEE2E2", color: "#991B1B", fontWeight: 600 }}>Éliminé</span>
        </div>
        {result.eliminatory_reason && (
          <div style={{ fontSize: 11.5, color: "#991B1B", marginTop: 4 }}>{result.eliminatory_reason}</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "11px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/protected/candidats/${result.candidate_id}`} style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)", textDecoration: "none" }}>
            {result.last_name} {result.first_name}
          </Link>
          {result.title && (
            <div style={{ fontSize: 12, color: "var(--text-4)", marginTop: 1 }}>
              {result.title}{result.current_company ? ` · ${result.current_company}` : ""}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: sc.bg, color: sc.tx }}>
            {result.score}
          </span>
          {result.in_deal ? (
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 7, background: "var(--surface-3)", color: "var(--text-4)", fontWeight: 600 }}>
              {result.dc_stage ?? "Dans le pipeline"}
            </span>
          ) : (
            <button
              onClick={add}
              disabled={adding}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", border: "none", borderRadius: 7, background: "#1a56db", color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: adding ? .6 : 1 }}
            >
              <Plus size={10} />{adding ? "…" : "Ajouter"}
            </button>
          )}
        </div>
      </div>

      {/* Critères */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {st && (
          <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 20, background: st.bg, color: st.tx, fontWeight: 600 }}>
            {st.label}
          </span>
        )}
        <CriterionTag label="Compétences" pct={result.breakdown.skills.pct} active={result.breakdown.skills.active} />
        <CriterionTag label="Séniorité"   pct={result.breakdown.seniority.pct} active={result.breakdown.seniority.active} />
        <CriterionTag label="Salaire"     pct={result.breakdown.salary.pct}    active={result.breakdown.salary.active} />
        <CriterionTag label="Géo"         pct={result.breakdown.geography.pct} active={result.breakdown.geography.active} />
        <CriterionTag label="Remote"      pct={result.breakdown.remote.pct}    active={result.breakdown.remote.active} />
        {result.breakdown.interview_bonus > 0 && (
          <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 20, background: "#DBEAFE", color: "#1D4ED8", fontWeight: 600 }}>
            Entretien +{result.breakdown.interview_bonus}
          </span>
        )}
      </div>

      {/* Infos candidat */}
      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        {result.seniority && <span style={{ fontSize: 11, color: "var(--text-5)" }}>{SEN_LABELS[result.seniority] ?? result.seniority}</span>}
        {result.location && <span style={{ fontSize: 11, color: "var(--text-5)" }}>📍 {GEO_LABELS[result.location] ?? result.location}</span>}
        {result.remote_preference && <span style={{ fontSize: 11, color: "var(--text-5)" }}>{REM_LABELS[result.remote_preference] ?? result.remote_preference}</span>}
        {result.salary_target != null && (
          <span style={{ fontSize: 11, color: "var(--text-5)" }}>
            {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(result.salary_target)}
          </span>
        )}
      </div>
    </div>
  );
}

export function RecruitmentMatching({ dealId }: { dealId: string }) {
  const [results, setResults] = useState<RankResult[]>([]);
  const [dealProfile, setDealProfile] = useState<Awaited<ReturnType<typeof getCandidateRanking>>["deal_profile"] | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [showElim, setShowElim] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getCandidateRanking(dealId);
      if (r.error) setError(r.error);
      else { setResults(r.results); setDealProfile(r.deal_profile); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const filtered = results.filter(r => {
    if (r.eliminatory) return showElim;
    return r.score >= minScore;
  });

  const profileFilled = dealProfile && (
    dealProfile.required_seniority || dealProfile.required_location ||
    dealProfile.required_remote || dealProfile.salary_min != null
  );

  if (loading) return (
    <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-5)", fontSize: 13 }}>Calcul des scores…</div>
  );

  if (error) return (
    <div style={{ padding: 16, background: "#FEE2E2", borderRadius: 10, color: "#991B1B", fontSize: 13 }}>Erreur : {error}</div>
  );

  const nonElim = results.filter(r => !r.eliminatory);
  const elim    = results.filter(r => r.eliminatory);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <UserSearch size={15} color="var(--text-4)" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em" }}>
          Matching vivier
        </span>
        <span style={{ fontSize: 11.5, background: "var(--surface-3)", color: "var(--text-4)", borderRadius: 20, padding: "1px 7px", fontWeight: 600 }}>
          {nonElim.length}
        </span>
      </div>

      {!profileFilled && (
        <div style={{ padding: "10px 14px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 9, fontSize: 13, color: "#92400E", marginBottom: 14 }}>
          ⚠️ Le profil de poste n'est pas renseigné (séniorité, localisation, remote, salaire). Le scoring ne reflète que les compétences.{" "}
          <Link href={`/protected/dossiers/${dealId}/modifier`} style={{ color: "#92400E", fontWeight: 700 }}>Compléter le profil →</Link>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[0, 40, 70].map(min => (
          <button
            key={min}
            onClick={() => setMinScore(min)}
            style={{
              padding: "4px 12px", borderRadius: 20, border: "1px solid var(--border)", fontSize: 12, fontWeight: 600,
              background: minScore === min ? "#1a56db" : "var(--surface)",
              color:      minScore === min ? "#fff"     : "var(--text-3)",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {min === 0 ? "Tous" : `Score ≥ ${min}`}
          </button>
        ))}
        {elim.length > 0 && (
          <button
            onClick={() => setShowElim(p => !p)}
            style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, background: showElim ? "#FEE2E2" : "var(--surface)", color: showElim ? "#991B1B" : "var(--text-5)", cursor: "pointer", fontFamily: "inherit" }}
          >
            {showElim ? "Masquer" : "Voir"} éliminés ({elim.length})
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-5)", fontSize: 13 }}>
          Aucun candidat dans le vivier ne correspond à ce filtre.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {filtered.map(r => (
            <RankCard key={r.candidate_id} result={r} dealId={dealId} onAdded={load} />
          ))}
        </div>
      )}
    </div>
  );
}
