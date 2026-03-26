import { createClient } from "@/lib/supabase/server";

export interface CandidateRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  current_company: string | null;
  location: string | null;
  seniority: string | null;
  remote_preference: string | null;
  candidate_status: string;
  last_contact_date: string | null;
  created_at: string;
}

export interface CandidateJob {
  id: string;
  company_name: string | null;
  title: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
}

export interface CandidateSkill {
  id: string;
  skill_name: string;
  level: string | null;
  is_shareable: boolean;
  weight: number;
}

export interface CandidateInterview {
  id: string;
  deal_id: string | null;
  interviewer: string | null;
  interview_date: string | null;
  interview_type: string | null;
  score: number | null;
  feedback: string | null;
  recommendation: string | null;
  is_confidential: boolean;
  created_at: string;
}

export interface CandidateDocument {
  id: string;
  file_name: string;
  file_url: string;
  drive_file_id: string;
  mime_type: string | null;
  document_type: string;
  source: string;
  created_at: string;
}

export interface LinkedDeal {
  id: string;
  stage: string;
  combined_score: number | null;
  notes: string | null;
  added_at: string;
  deal: {
    id: string;
    name: string;
    deal_type: string;
    deal_status: string;
  } | null;
}

export interface CandidateDetail extends CandidateRow {
  linkedin_url: string | null;
  cv_url: string | null;
  salary_current: number | null;
  salary_target: number | null;
  notes_internal: string | null;
  notes_shareable: string | null;
  is_confidential: boolean;
  source: string;
  available_from: string | null;
  status_log: {
    id: string;
    old_status: string | null;
    new_status: string;
    note: string;
    created_at: string;
  }[];
  jobs: CandidateJob[];
  skills: CandidateSkill[];
  interviews: CandidateInterview[];
  linked_deals: LinkedDeal[];
  documents: CandidateDocument[];
}

export interface ReactivationAlert {
  id: string;
  first_name: string;
  last_name: string;
  last_contact_date: string | null;
  months_since_contact: number;
}

// Candidats placés sans contact depuis 18+ mois
export async function getReactivationAlerts(): Promise<ReactivationAlert[]> {
  const supabase = await createClient();
  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() - 18);

  const { data } = await supabase
    .from("candidates")
    .select("id,first_name,last_name,last_contact_date")
    .eq("candidate_status", "placed")
    .or(`last_contact_date.is.null,last_contact_date.lte.${threshold.toISOString().split("T")[0]}`);

  return (data ?? []).map(c => {
    const lastContact = c.last_contact_date ? new Date(c.last_contact_date) : null;
    const diffMs = lastContact ? Date.now() - lastContact.getTime() : Date.now() - threshold.getTime();
    const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
    return { ...c, months_since_contact: months };
  });
}

export async function getCandidatesView(filters?: {
  status?: string;
  search?: string;
}): Promise<CandidateRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("candidates")
    .select("id,first_name,last_name,email,phone,title,current_company,location,seniority,remote_preference,candidate_status,last_contact_date,created_at")
    .order("last_name", { ascending: true });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("candidate_status", filters.status);
  }
  if (filters?.search) {
    const s = `%${filters.search}%`;
    query = query.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},current_company.ilike.${s},title.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CandidateRow[];
}

export async function getCandidateDetail(id: string): Promise<CandidateDetail | null> {
  const supabase = await createClient();

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!candidate) return null;

  const [logResult, jobsResult, skillsResult, interviewsResult, linkedDealsResult, docsResult] = await Promise.all([
    supabase
      .from("candidate_status_log")
      .select("id,old_status,new_status,note,created_at")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("candidate_jobs")
      .select("id,company_name,title,start_date,end_date,is_current,description")
      .eq("candidate_id", id)
      .order("start_date", { ascending: false }),
    supabase
      .from("candidate_skills")
      .select("id,skill_name,level,is_shareable,weight")
      .eq("candidate_id", id)
      .order("skill_name"),
    supabase
      .from("candidate_interviews")
      .select("id,deal_id,interviewer,interview_date,interview_type,score,feedback,recommendation,is_confidential,created_at")
      .eq("candidate_id", id)
      .order("interview_date", { ascending: false }),
    supabase
      .from("deal_candidates")
      .select("id,stage,combined_score,notes,added_at,deals(id,name,deal_type,deal_status)")
      .eq("candidate_id", id)
      .order("added_at", { ascending: false }),
    supabase
      .from("candidate_documents")
      .select("id,file_name,file_url,drive_file_id,mime_type,document_type,source,created_at")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return {
    ...candidate,
    status_log:   (logResult.data   ?? []) as CandidateDetail["status_log"],
    jobs:         (jobsResult.data  ?? []) as CandidateJob[],
    skills:       (skillsResult.data ?? []) as CandidateSkill[],
    interviews:   (interviewsResult.data ?? []) as CandidateInterview[],
    documents:    (docsResult.data ?? []) as CandidateDocument[],
    linked_deals: ((linkedDealsResult.data ?? []) as unknown[]).map((row: unknown) => {
      const r = row as { id: string; stage: string; combined_score: number | null; notes: string | null; added_at: string; deals: unknown };
      return {
        id:            r.id,
        stage:         r.stage,
        combined_score: r.combined_score,
        notes:         r.notes,
        added_at:      r.added_at,
        deal:          r.deals as LinkedDeal["deal"],
      };
    }),
  } as CandidateDetail;
}
