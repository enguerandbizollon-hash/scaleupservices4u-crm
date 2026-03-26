"use server";

import { createClient } from "@/lib/supabase/server";
import { scoreCandidate, type ScoringResult } from "@/lib/crm/recruitment-scoring";

export interface CandidateRankResult {
  candidate_id:    string;
  first_name:      string;
  last_name:       string;
  title:           string | null;
  current_company: string | null;
  candidate_status: string;
  seniority:       string | null;
  location:        string | null;
  remote_preference: string | null;
  salary_target:   number | null;
  in_deal:         boolean;
  dc_stage:        string | null;
  score:           number;
  breakdown:       ScoringResult["breakdown"];
  eliminatory:     boolean;
  eliminatory_reason: string | null;
}

export interface DealMatchResult {
  deal_id:     string;
  deal_name:   string;
  deal_type:   string;
  deal_status: string;
  job_title:   string | null;
  score:       number;
  breakdown:   ScoringResult["breakdown"];
  in_deal:     boolean;
  dc_stage:    string | null;
}

// ── getCandidateRanking ───────────────────────────────────────────────────────
// Score tous les candidats du vivier contre un dossier de recrutement

export async function getCandidateRanking(dealId: string): Promise<{
  results:      CandidateRankResult[];
  deal_profile: {
    required_seniority: string | null;
    required_location:  string | null;
    required_remote:    string | null;
    salary_min:         number | null;
    salary_max:         number | null;
    job_title:          string | null;
  };
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { results: [], deal_profile: { required_seniority: null, required_location: null, required_remote: null, salary_min: null, salary_max: null, job_title: null }, error: "Non authentifié" };

  // Profil du poste
  const { data: deal } = await supabase
    .from("deals")
    .select("id,required_seniority,required_location,required_remote,salary_min,salary_max,job_title")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!deal) return { results: [], deal_profile: { required_seniority: null, required_location: null, required_remote: null, salary_min: null, salary_max: null, job_title: null }, error: "Dossier introuvable" };

  const deal_profile = {
    required_seniority: deal.required_seniority as string | null,
    required_location:  deal.required_location  as string | null,
    required_remote:    deal.required_remote    as string | null,
    salary_min:         deal.salary_min         as number | null,
    salary_max:         deal.salary_max         as number | null,
    job_title:          deal.job_title          as string | null,
  };

  // Compétences requises du poste
  const { data: requiredSkills } = await supabase
    .from("deal_required_skills")
    .select("skill_name,is_mandatory,weight")
    .eq("deal_id", dealId)
    .eq("user_id", user.id);

  // Tous les candidats avec leurs compétences
  const { data: candidates } = await supabase
    .from("candidates")
    .select("id,first_name,last_name,title,current_company,candidate_status,seniority,location,remote_preference,salary_target,candidate_skills(skill_name,weight)")
    .eq("user_id", user.id);

  // Candidats déjà dans le dossier
  const { data: inDeal } = await supabase
    .from("deal_candidates")
    .select("candidate_id,stage")
    .eq("deal_id", dealId)
    .eq("user_id", user.id);

  const inDealMap = new Map<string, string>();
  for (const dc of inDeal ?? []) inDealMap.set(dc.candidate_id as string, dc.stage as string);

  // Entretiens par candidat pour ce dossier
  const { data: allInterviews } = await supabase
    .from("candidate_interviews")
    .select("candidate_id,score,recommendation,interview_date")
    .eq("deal_id", dealId)
    .eq("user_id", user.id)
    .order("interview_date", { ascending: false });

  const interviewsByCandidate = new Map<string, { score: number | null; recommendation: string | null }[]>();
  for (const itv of allInterviews ?? []) {
    const cid = itv.candidate_id as string;
    if (!interviewsByCandidate.has(cid)) interviewsByCandidate.set(cid, []);
    interviewsByCandidate.get(cid)!.push({ score: itv.score as number | null, recommendation: itv.recommendation as string | null });
  }

  const results: CandidateRankResult[] = [];

  for (const c of candidates ?? []) {
    const cid = c.id as string;
    const skills = (Array.isArray(c.candidate_skills) ? c.candidate_skills : []) as { skill_name: string; weight: number }[];
    const interviews = interviewsByCandidate.get(cid) ?? [];

    const scored = scoreCandidate({
      candidate:       { seniority: c.seniority as string | null, location: c.location as string | null, remote_preference: c.remote_preference as string | null, salary_target: c.salary_target as number | null },
      candidateSkills: skills,
      deal:            deal_profile,
      requiredSkills:  (requiredSkills ?? []) as { skill_name: string; is_mandatory: boolean; weight: number }[],
      interviews,
    });

    results.push({
      candidate_id:     cid,
      first_name:       c.first_name as string,
      last_name:        c.last_name  as string,
      title:            c.title      as string | null,
      current_company:  c.current_company as string | null,
      candidate_status: c.candidate_status as string,
      seniority:        c.seniority  as string | null,
      location:         c.location   as string | null,
      remote_preference: c.remote_preference as string | null,
      salary_target:    c.salary_target as number | null,
      in_deal:          inDealMap.has(cid),
      dc_stage:         inDealMap.get(cid) ?? null,
      score:            scored.total,
      breakdown:        scored.breakdown,
      eliminatory:      scored.eliminatory,
      eliminatory_reason: scored.eliminatory_reason,
    });
  }

  // Tri : éliminatoires en dernier, puis par score desc
  results.sort((a, b) => {
    if (a.eliminatory !== b.eliminatory) return a.eliminatory ? 1 : -1;
    return b.score - a.score;
  });

  return { results, deal_profile };
}

// ── getMatchingDeals ──────────────────────────────────────────────────────────
// Trouve les dossiers de recrutement compatibles pour un candidat

export async function getMatchingDeals(candidateId: string): Promise<{
  results: DealMatchResult[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { results: [], error: "Non authentifié" };

  // Profil candidat avec ses compétences
  const { data: candidate } = await supabase
    .from("candidates")
    .select("id,seniority,location,remote_preference,salary_target,candidate_skills(skill_name,weight)")
    .eq("id", candidateId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!candidate) return { results: [], error: "Candidat introuvable" };

  const candidateSkills = (Array.isArray(candidate.candidate_skills) ? candidate.candidate_skills : []) as { skill_name: string; weight: number }[];

  // Dossiers recrutement ouverts ou en pause
  const { data: deals } = await supabase
    .from("deals")
    .select("id,name,deal_type,deal_status,job_title,required_seniority,required_location,required_remote,salary_min,salary_max")
    .eq("user_id", user.id)
    .eq("deal_type", "recruitment")
    .in("deal_status", ["open", "paused"]);

  if (!deals || deals.length === 0) return { results: [] };

  // Compétences requises par dossier (batch)
  const dealIds = deals.map(d => d.id as string);
  const { data: allRequiredSkills } = await supabase
    .from("deal_required_skills")
    .select("deal_id,skill_name,is_mandatory,weight")
    .in("deal_id", dealIds)
    .eq("user_id", user.id);

  // Dossiers où le candidat est déjà présent
  const { data: inDeals } = await supabase
    .from("deal_candidates")
    .select("deal_id,stage")
    .eq("candidate_id", candidateId)
    .eq("user_id", user.id);

  const inDealMap = new Map<string, string>();
  for (const dc of inDeals ?? []) inDealMap.set(dc.deal_id as string, dc.stage as string);

  // Entretiens du candidat par dossier
  const { data: allInterviews } = await supabase
    .from("candidate_interviews")
    .select("deal_id,score,recommendation,interview_date")
    .eq("candidate_id", candidateId)
    .eq("user_id", user.id)
    .order("interview_date", { ascending: false });

  const interviewsByDeal = new Map<string, { score: number | null; recommendation: string | null }[]>();
  for (const itv of allInterviews ?? []) {
    const did = itv.deal_id as string;
    if (!did) continue;
    if (!interviewsByDeal.has(did)) interviewsByDeal.set(did, []);
    interviewsByDeal.get(did)!.push({ score: itv.score as number | null, recommendation: itv.recommendation as string | null });
  }

  const skillsByDeal = new Map<string, { skill_name: string; is_mandatory: boolean; weight: number }[]>();
  for (const req of allRequiredSkills ?? []) {
    const did = req.deal_id as string;
    if (!skillsByDeal.has(did)) skillsByDeal.set(did, []);
    skillsByDeal.get(did)!.push({ skill_name: req.skill_name as string, is_mandatory: req.is_mandatory as boolean, weight: req.weight as number });
  }

  const results: DealMatchResult[] = [];

  for (const deal of deals) {
    const did = deal.id as string;
    const requiredSkills = skillsByDeal.get(did) ?? [];
    const interviews     = interviewsByDeal.get(did) ?? [];

    const scored = scoreCandidate({
      candidate:       { seniority: candidate.seniority as string | null, location: candidate.location as string | null, remote_preference: candidate.remote_preference as string | null, salary_target: candidate.salary_target as number | null },
      candidateSkills,
      deal:            { required_seniority: deal.required_seniority as string | null, required_location: deal.required_location as string | null, required_remote: deal.required_remote as string | null, salary_min: deal.salary_min as number | null, salary_max: deal.salary_max as number | null },
      requiredSkills,
      interviews,
    });

    if (scored.eliminatory) continue; // exclusion silencieuse

    results.push({
      deal_id:     did,
      deal_name:   deal.name as string,
      deal_type:   deal.deal_type as string,
      deal_status: deal.deal_status as string,
      job_title:   deal.job_title as string | null,
      score:       scored.total,
      breakdown:   scored.breakdown,
      in_deal:     inDealMap.has(did),
      dc_stage:    inDealMap.get(did) ?? null,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return { results };
}
