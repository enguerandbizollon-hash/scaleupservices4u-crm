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
      participants: a.activity_contacts?.map((ac: any) => ac.contacts) || [],
    }));

    return { success: true, activities: enriched };
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
      .from("organisations")
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
