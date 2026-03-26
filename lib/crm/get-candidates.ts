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

  const { data: log } = await supabase
    .from("candidate_status_log")
    .select("id,old_status,new_status,note,created_at")
    .eq("candidate_id", id)
    .order("created_at", { ascending: false });

  return {
    ...candidate,
    status_log: (log ?? []) as CandidateDetail["status_log"],
  } as CandidateDetail;
}
