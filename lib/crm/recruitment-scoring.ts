// ─────────────────────────────────────────────────────────────────────────────
// Algorithme de scoring RH — Module M4
// Score candidat vs poste : 35pts compétences + 60pts profil + bonus entretiens
// ─────────────────────────────────────────────────────────────────────────────

import { SENIORITY_MAP, RH_GEO_COMPATIBILITY, REMOTE_COMPATIBILITY } from "./matching-maps";

export interface RequiredSkill {
  skill_name: string;
  is_mandatory: boolean;
  weight: number;
}

export interface CandidateSkillInput {
  skill_name: string;
  weight: number;
}

export interface InterviewInput {
  score: number | null;
  recommendation: string | null;
}

export interface ScoringDeal {
  required_seniority: string | null;
  required_location:  string | null;
  required_remote:    string | null;
  salary_min:         number | null;
  salary_max:         number | null;
}

export interface ScoringCandidate {
  seniority:          string | null;
  location:           string | null;
  remote_preference:  string | null;
  salary_target:      number | null;
}

export interface CriterionScore {
  raw:    number;   // points bruts sur sa base (ex: 0-15 pour séniorité)
  pct:    number;   // % de la base (0-100)
  active: boolean;  // criterion has data on both sides
}

export interface ScoreBreakdown {
  skills:          CriterionScore & { base: 35 };
  seniority:       CriterionScore & { base: 15 };
  salary:          CriterionScore & { base: 20 };
  geography:       CriterionScore & { base: 15 };
  remote:          CriterionScore & { base: 10 };
  interview_bonus: number;
}

export interface ScoringResult {
  total:               number;  // 0-100 (capped)
  breakdown:           ScoreBreakdown;
  eliminatory:         boolean;
  eliminatory_reason:  string | null;
}

export function scoreCandidate(params: {
  candidate:       ScoringCandidate;
  candidateSkills: CandidateSkillInput[];
  deal:            ScoringDeal;
  requiredSkills:  RequiredSkill[];
  interviews:      InterviewInput[]; // triés desc par date
}): ScoringResult {
  const { candidate, candidateSkills, deal, requiredSkills, interviews } = params;

  // ── 1. Compétences (35pts) ─────────────────────────────────────────────
  let skillsRaw = 0;
  const hasSkills = requiredSkills.length > 0;

  if (hasSkills) {
    const candSet = new Set(candidateSkills.map(s => s.skill_name.toLowerCase().trim()));
    let totalWeight = 0;
    let matchedWeight = 0;

    for (const req of requiredSkills) {
      const w = req.weight > 0 ? req.weight : 1;
      totalWeight += w;
      const matched = candSet.has(req.skill_name.toLowerCase().trim());
      if (matched) {
        matchedWeight += w;
      } else if (req.is_mandatory) {
        // Deal breaker éliminatoire
        return {
          total: 0,
          breakdown: {
            skills:          { raw: 0, pct: 0, active: true,  base: 35 },
            seniority:       { raw: 0, pct: 0, active: false, base: 15 },
            salary:          { raw: 0, pct: 0, active: false, base: 20 },
            geography:       { raw: 0, pct: 0, active: false, base: 15 },
            remote:          { raw: 0, pct: 0, active: false, base: 10 },
            interview_bonus: 0,
          },
          eliminatory: true,
          eliminatory_reason: `Compétence obligatoire manquante : ${req.skill_name}`,
        };
      }
    }

    skillsRaw = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 35) : 35;
  }

  // ── 2. Séniorité (15pts) ──────────────────────────────────────────────
  const hasSeniority = !!(deal.required_seniority && candidate.seniority);
  let seniorityRaw = 0;
  if (hasSeniority) {
    const req  = deal.required_seniority!;
    const cand = candidate.seniority!;
    if (cand === req) {
      seniorityRaw = 15;
    } else if ((SENIORITY_MAP[req] ?? []).includes(cand)) {
      seniorityRaw = 8;
    }
  }

  // ── 3. Rémunération (20pts) ───────────────────────────────────────────
  const hasSalary =
    candidate.salary_target != null &&
    (deal.salary_min != null || deal.salary_max != null);
  let salaryRaw = 0;
  if (hasSalary) {
    const t   = candidate.salary_target!;
    const min = deal.salary_min ?? 0;
    const max = deal.salary_max ?? Infinity;

    if (t >= min && t <= max) {
      salaryRaw = 20;
    } else {
      const mid = max === Infinity ? min : (min + max) / 2;
      const deviation = mid > 0 ? Math.abs(t - mid) / mid : 1;
      if (deviation <= 0.20) salaryRaw = 10;
    }
  }

  // ── 4. Géographie (15pts) ────────────────────────────────────────────
  const hasGeo = !!(deal.required_location && candidate.location);
  let geoRaw = 0;
  if (hasGeo) {
    const jobGeo  = deal.required_location!;
    const candGeo = candidate.location!;
    const compat  = RH_GEO_COMPATIBILITY[jobGeo] ?? [];
    if (candGeo === jobGeo) {
      geoRaw = 15;
    } else if (compat.includes(candGeo)) {
      geoRaw = 8;
    }
  }

  // ── 5. Remote (10pts) ────────────────────────────────────────────────
  const hasRemote = !!(deal.required_remote && candidate.remote_preference);
  let remoteRaw = 0;
  if (hasRemote) {
    const jobR  = deal.required_remote!;
    const candR = candidate.remote_preference!;
    const compat = REMOTE_COMPATIBILITY[jobR] ?? [];
    if (candR === jobR) {
      remoteRaw = 10;
    } else if (compat.includes(candR)) {
      remoteRaw = 5;
    }
  }

  // ── Pondération dynamique ─────────────────────────────────────────────
  // Les critères inactifs (null) voient leur poids redistribué
  const OPT_BASE = 60; // 15 + 20 + 15 + 10
  type OptCrit = { active: boolean; raw: number; base: number };
  const optCriteria: OptCrit[] = [
    { active: hasSeniority, raw: seniorityRaw, base: 15 },
    { active: hasSalary,    raw: salaryRaw,    base: 20 },
    { active: hasGeo,       raw: geoRaw,       base: 15 },
    { active: hasRemote,    raw: remoteRaw,    base: 10 },
  ];

  const activeBase  = optCriteria.filter(c => c.active).reduce((s, c) => s + c.base, 0);
  const activeScore = optCriteria.filter(c => c.active).reduce((s, c) => s + c.raw,  0);
  const optScaled   = activeBase > 0 ? Math.round((activeScore / activeBase) * OPT_BASE) : 0;

  // ── Bonus entretiens ──────────────────────────────────────────────────
  let interviewBonus = 0;
  if (interviews.length > 0) {
    const scored = interviews.filter(i => i.score != null);
    if (scored.length > 0) {
      const avg = scored.reduce((s, i) => s + i.score!, 0) / scored.length;
      interviewBonus += Math.round(avg * 2); // avg 7.5/10 → +15pts
    }
    if (interviews[0].recommendation === "go") interviewBonus += 5;
  }

  const total = Math.min(skillsRaw + optScaled + interviewBonus, 100);

  const breakdown: ScoreBreakdown = {
    skills:          { raw: skillsRaw,    pct: hasSkills    ? Math.round((skillsRaw    / 35) * 100) : 0, active: hasSkills,    base: 35 },
    seniority:       { raw: seniorityRaw, pct: hasSeniority ? Math.round((seniorityRaw / 15) * 100) : 0, active: hasSeniority, base: 15 },
    salary:          { raw: salaryRaw,    pct: hasSalary    ? Math.round((salaryRaw    / 20) * 100) : 0, active: hasSalary,    base: 20 },
    geography:       { raw: geoRaw,       pct: hasGeo       ? Math.round((geoRaw       / 15) * 100) : 0, active: hasGeo,       base: 15 },
    remote:          { raw: remoteRaw,    pct: hasRemote    ? Math.round((remoteRaw    / 10) * 100) : 0, active: hasRemote,    base: 10 },
    interview_bonus: interviewBonus,
  };

  return { total, breakdown, eliminatory: false, eliminatory_reason: null };
}

/** Score coloré : vert ≥70, orange 40-69, rouge <40 */
export function scoreColor(score: number): { bg: string; tx: string } {
  if (score >= 70) return { bg: "#D1FAE5", tx: "#065F46" };
  if (score >= 40) return { bg: "#FEF3C7", tx: "#92400E" };
  return { bg: "#FEE2E2", tx: "#991B1B" };
}
