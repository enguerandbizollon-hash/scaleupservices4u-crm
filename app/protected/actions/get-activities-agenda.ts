"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Récupérer toutes les activités unifiées avec contexte complet
 * Utilisé pour la page /protected/agenda
 */
export async function getActivitiesAgendaAction(filters?: {
  activityType?: string;
  contactId?: string;
  dealId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated", activities: [] };
    }

    // Requête de base
    let query = supabase
      .from("activities")
      .select(
        `
        id,
        title,
        summary,
        activity_type,
        activity_date,
        due_date,
        due_time,
        location,
        is_all_day,
        task_status,
        deal_id,
        contact_id,
        organization_id,
        created_at,
        deals:deal_id (id, name, deal_type),
        contacts:contact_id (id, first_name, last_name),
        organisations:organization_id (id, name),
        activity_contacts (contact_id, contacts:contact_id (id, first_name, last_name))
      `
      )
      .eq("user_id", user.id)
      .order("due_date", { ascending: false });

    // Appliquer les filtres
    if (filters?.activityType) {
      query = query.eq("activity_type", filters.activityType);
    }
    if (filters?.contactId) {
      query = query.eq("contact_id", filters.contactId);
    }
    if (filters?.dealId) {
      query = query.eq("deal_id", filters.dealId);
    }
    if (filters?.status) {
      query = query.eq("task_status", filters.status);
    }
    if (filters?.startDate) {
      query = query.gte("due_date", filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte("due_date", filters.endDate);
    }

    const { data: activities, error } = await query;

    if (error) {
      return { success: false, error: error.message, activities: [] };
    }

    // Enrichir les données avec les participants
    const enriched = activities.map((a: any) => ({
      ...a,
      source_type: "activity",
      source_id: a.id,
      participants: a.activity_contacts?.map((ac: any) => ac.contacts) || [],
    }));

    // ── Agréger les dates CRM d'autres tables ────────────────────────────
    const extraEvents: any[] = [];

    // Tâches avec due_date non terminées
    if (!filters?.activityType || filters.activityType === "task") {
      let tq = supabase.from("tasks")
        .select("id, title, due_date, deal_id, contact_id")
        .eq("user_id", user.id)
        .not("task_status", "in", '("done","cancelled")')
        .not("due_date", "is", null);
      if (filters?.startDate) tq = tq.gte("due_date", filters.startDate);
      if (filters?.endDate) tq = tq.lte("due_date", filters.endDate);
      const { data: tasks } = await tq;
      for (const t of tasks ?? []) {
        extraEvents.push({
          id: `task_${t.id}`, title: t.title, activity_type: "todo",
          activity_date: t.due_date, due_date: t.due_date, due_time: null,
          is_all_day: true, task_status: "open", location: null, summary: null,
          deal_id: t.deal_id, contact_id: t.contact_id, organization_id: null,
          created_at: t.due_date, source_type: "task", source_id: t.id,
          deals: null, contacts: null, organisations: null, participants: [],
        });
      }
    }

    // Deals — target_date (closing cible)
    if (!filters?.activityType) {
      let dq = supabase.from("deals")
        .select("id, name, target_date")
        .eq("user_id", user.id)
        .eq("deal_status", "open")
        .not("target_date", "is", null);
      if (filters?.startDate) dq = dq.gte("target_date", filters.startDate);
      if (filters?.endDate) dq = dq.lte("target_date", filters.endDate);
      const { data: deals } = await dq;
      for (const d of deals ?? []) {
        extraEvents.push({
          id: `deal_closing_${d.id}`, title: `Closing cible : ${d.name}`,
          activity_type: "closing", activity_date: d.target_date, due_date: d.target_date,
          due_time: null, is_all_day: true, task_status: "open", location: null, summary: null,
          deal_id: d.id, contact_id: null, organization_id: null,
          created_at: d.target_date, source_type: "deal_closing", source_id: d.id,
          deals: { id: d.id, name: d.name, deal_type: null }, contacts: null, organisations: null, participants: [],
        });
      }
    }

    // Deals — next_action_date (relances)
    if (!filters?.activityType) {
      let rq = supabase.from("deals")
        .select("id, name, next_action_date")
        .eq("user_id", user.id)
        .eq("deal_status", "open")
        .not("next_action_date", "is", null);
      if (filters?.startDate) rq = rq.gte("next_action_date", filters.startDate);
      if (filters?.endDate) rq = rq.lte("next_action_date", filters.endDate);
      const { data: relances } = await rq;
      for (const r of relances ?? []) {
        extraEvents.push({
          id: `deal_relance_${r.id}`, title: `Relance : ${r.name}`,
          activity_type: "follow_up", activity_date: r.next_action_date, due_date: r.next_action_date,
          due_time: null, is_all_day: true, task_status: "open", location: null, summary: null,
          deal_id: r.id, contact_id: null, organization_id: null,
          created_at: r.next_action_date, source_type: "deal_relance", source_id: r.id,
          deals: { id: r.id, name: r.name, deal_type: null }, contacts: null, organisations: null, participants: [],
        });
      }
    }

    // Mandats — target_close_date
    if (!filters?.activityType) {
      let mq = supabase.from("mandates")
        .select("id, name, target_close_date")
        .eq("user_id", user.id)
        .eq("status", "active")
        .not("target_close_date", "is", null);
      if (filters?.startDate) mq = mq.gte("target_close_date", filters.startDate);
      if (filters?.endDate) mq = mq.lte("target_close_date", filters.endDate);
      const { data: mandates } = await mq;
      for (const m of mandates ?? []) {
        extraEvents.push({
          id: `mandate_closing_${m.id}`, title: `Closing mandat : ${m.name}`,
          activity_type: "deadline", activity_date: m.target_close_date, due_date: m.target_close_date,
          due_time: null, is_all_day: true, task_status: "open", location: null, summary: null,
          deal_id: null, contact_id: null, organization_id: null,
          created_at: m.target_close_date, source_type: "mandate_closing", source_id: m.id,
          deals: null, contacts: null, organisations: null, participants: [],
        });
      }
    }

    // Fee milestones — due_date non payés
    if (!filters?.activityType) {
      let fq = supabase.from("fee_milestones")
        .select("id, name, due_date, mandate_id")
        .eq("user_id", user.id)
        .is("paid_date", null)
        .not("due_date", "is", null);
      if (filters?.startDate) fq = fq.gte("due_date", filters.startDate);
      if (filters?.endDate) fq = fq.lte("due_date", filters.endDate);
      const { data: milestones } = await fq;
      for (const f of milestones ?? []) {
        extraEvents.push({
          id: `fee_${f.id}`, title: `Jalon : ${f.name}`,
          activity_type: "delivery", activity_date: f.due_date, due_date: f.due_date,
          due_time: null, is_all_day: true, task_status: "open", location: null, summary: null,
          deal_id: null, contact_id: null, organization_id: null,
          created_at: f.due_date, source_type: "fee_milestone", source_id: f.id,
          deals: null, contacts: null, organisations: null, participants: [],
        });
      }
    }

    const all = [...enriched, ...extraEvents].sort((a, b) => {
      const da = a.due_date || a.activity_date || "";
      const db = b.due_date || b.activity_date || "";
      return db.localeCompare(da);
    });

    return { success: true, activities: all };
  } catch (err: any) {
    return { success: false, error: err.message, activities: [] };
  }
}

/**
 * Récupérer les metadata pour les filtres (all contacts, deals, types)
 */
export async function getAgendaFiltersMetaAction() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        contacts: [],
        deals: [],
        organisations: [],
        activityTypes: [],
      };
    }

    // Récupérer tous les contacts
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("user_id", user.id)
      .order("first_name");

    // Récupérer tous les deals
    const { data: deals } = await supabase
      .from("deals")
      .select("id, name, deal_type")
      .eq("user_id", user.id)
      .order("name");

    // Récupérer toutes les organisations
    const { data: organisations } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name");

    // Activity types (hardcoded depuis labels)
    const activityTypes = [
      { id: "todo", label: "Todo", category: "Tasks" },
      { id: "follow_up", label: "Relance", category: "Tasks" },
      { id: "call", label: "Appel", category: "Communication" },
      { id: "meeting", label: "Réunion", category: "Communication" },
      { id: "email_sent", label: "Email envoyé", category: "Communication" },
      { id: "email_received", label: "Email reçu", category: "Communication" },
      { id: "intro", label: "Introduction", category: "Communication" },
      { id: "deck_sent", label: "Pitch deck envoyé", category: "Documents" },
      { id: "nda", label: "NDA", category: "Documents" },
      { id: "document_sent", label: "Document envoyé", category: "Documents" },
      { id: "deadline", label: "Deadline", category: "Events" },
      { id: "delivery", label: "Livraison", category: "Events" },
      { id: "closing", label: "Closing", category: "Events" },
      {
        id: "recruitment_interview",
        label: "Entretien recrutement",
        category: "Recruitment",
      },
      {
        id: "recruitment_feedback",
        label: "Feedback recrutement",
        category: "Recruitment",
      },
      {
        id: "recruitment_task",
        label: "Tâche recrutement",
        category: "Recruitment",
      },
      { id: "cfo_advisory", label: "Conseil CFO", category: "Advisory" },
      {
        id: "investor_meeting",
        label: "Réunion investisseur",
        category: "Advisory",
      },
      { id: "due_diligence", label: "Due diligence", category: "Advisory" },
      { id: "note", label: "Note", category: "Notes" },
      { id: "other", label: "Autre", category: "Notes" },
    ];

    return {
      success: true,
      contacts: contacts || [],
      deals: deals || [],
      organisations: organisations || [],
      activityTypes,
    };
  } catch (err: any) {
    return { success: false, error: err.message, contacts: [], deals: [], organisations: [], activityTypes: [] };
  }
}
