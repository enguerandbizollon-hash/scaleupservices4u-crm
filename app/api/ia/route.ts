import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { claudeModel } from "@/lib/ai/anthropic";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "get_deals",
    description: "Récupère la liste des dossiers du CRM avec leur statut, étape et organisation cliente.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filtrer par statut: active, inactive, closed. Laisser vide pour tous." }
      },
      required: []
    }
  },
  {
    name: "get_contacts",
    description: "Récupère les contacts du CRM avec leur organisation et statut.",
    input_schema: {
      type: "object" as const,
      properties: {
        search: { type: "string", description: "Recherche par nom, email ou organisation." }
      },
      required: []
    }
  },
  {
    name: "get_deal_detail",
    description: "Récupère le détail complet d'un dossier: contacts liés, tâches, activités, documents.",
    input_schema: {
      type: "object" as const,
      properties: {
        deal_id: { type: "string", description: "L'ID du dossier." }
      },
      required: ["deal_id"]
    }
  },
  {
    name: "create_task",
    description: "Crée une tâche ou relance liée à un dossier.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Titre de la tâche." },
        deal_id: { type: "string", description: "ID du dossier concerné." },
        due_date: { type: "string", description: "Date d'échéance au format YYYY-MM-DD." },
        priority_level: { type: "string", description: "high, medium ou low." },
        description: { type: "string", description: "Description optionnelle." }
      },
      required: ["title"]
    }
  },
  {
    name: "create_activity",
    description: "Enregistre une activité (email, call, réunion...) sur un dossier.",
    input_schema: {
      type: "object" as const,
      properties: {
        deal_id: { type: "string", description: "ID du dossier." },
        activity_type: { type: "string", description: "Type: email_sent, email_received, call, meeting, follow_up, note, document_sent, nda, deck_sent, other." },
        title: { type: "string", description: "Titre de l'activité." },
        summary: { type: "string", description: "Résumé de l'activité." },
        activity_date: { type: "string", description: "Date au format YYYY-MM-DD. Aujourd'hui si non précisé." }
      },
      required: ["deal_id", "activity_type", "title"]
    }
  },
];

async function executeTool(name: string, input: Record<string, string>, userId: string) {
  const supabase = await createClient();

  if (name === "get_deals") {
    let query = supabase.from("deals").select("id, name, deal_type, deal_status, deal_stage, priority_level, client_organization_id");
    if (input.status) query = query.eq("deal_status", input.status);
    const { data } = await query.order("priority_level");
    const orgIds = [...new Set((data ?? []).map(d => d.client_organization_id).filter(Boolean))];
    let orgsMap: Record<string, string> = {};
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase.from("organizations").select("id, name").in("id", orgIds);
      orgsMap = Object.fromEntries((orgs ?? []).map(o => [o.id, o.name]));
    }
    return (data ?? []).map(d => ({
      id: d.id, name: d.name, type: d.deal_type, status: d.deal_status,
      stage: d.deal_stage, priority: d.priority_level,
      organisation: orgsMap[d.client_organization_id] ?? "—"
    }));
  }

  if (name === "get_contacts") {
    let query = supabase.from("contacts").select("id, first_name, last_name, full_name, email, title, base_status, organization_contacts(organizations(name))").order("last_name");
    const { data } = await query;
    const contacts = (data ?? []).map(c => {
      const org = (c.organization_contacts as any)?.[0]?.organizations?.name ?? "—";
      return { id: c.id, name: c.full_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(), email: c.email, title: c.title, status: c.base_status, organisation: org };
    });
    if (input.search) {
      const s = input.search.toLowerCase();
      return contacts.filter(c => c.name.toLowerCase().includes(s) || (c.email ?? "").toLowerCase().includes(s) || c.organisation.toLowerCase().includes(s));
    }
    return contacts;
  }

  if (name === "get_deal_detail") {
    // deal_contacts et deal_documents n'existent plus (purge R0) : les
    // contacts viennent des organisations liées au dossier, les documents
    // de ma_documents (la table vivante depuis v49).
    const [{ data: deal }, { data: dealOrgs }, { data: openTasks }, { data: recentActs }, { data: docs }] = await Promise.all([
      supabase.from("deals").select("id, name, deal_type, deal_status, deal_stage, description").eq("id", input.deal_id).maybeSingle(),
      supabase.from("deal_organizations").select("organization_id").eq("deal_id", input.deal_id),
      supabase.from("actions")
        .select("id, title, status, priority, due_date")
        .eq("deal_id", input.deal_id)
        .eq("type", "task")
        .not("status", "in", '("done","cancelled","completed")'),
      supabase.from("actions")
        .select("id, type, title, description, due_date, start_datetime")
        .eq("deal_id", input.deal_id)
        .neq("type", "task")
        .order("start_datetime", { ascending: false, nullsFirst: false })
        .limit(10),
      supabase.from("ma_documents").select("id, file_name, document_type, file_url").eq("deal_id", input.deal_id),
    ]);
    const orgIds = (dealOrgs ?? []).map(o => o.organization_id).filter(Boolean);
    let contacts: Array<Record<string, unknown>> = [];
    if (orgIds.length > 0) {
      const { data: ocs } = await supabase
        .from("organization_contacts")
        .select("role_label, organizations(name), contacts(full_name, first_name, last_name, email, title)")
        .in("organization_id", orgIds);
      contacts = (ocs ?? []).flatMap(oc => {
        const c = Array.isArray(oc.contacts) ? oc.contacts[0] : oc.contacts;
        const o = Array.isArray(oc.organizations) ? oc.organizations[0] : oc.organizations;
        if (!c) return [];
        return [{ ...c, role_label: oc.role_label, organisation: (o as { name?: string } | null)?.name ?? null }];
      });
    }
    // Préserver la forme historique attendue par les prompts IA :
    const tasks = (openTasks ?? []).map(t => ({
      id: t.id, title: t.title, task_status: t.status, priority_level: t.priority, due_date: t.due_date,
    }));
    const activities = (recentActs ?? []).map(a => ({
      id: a.id, activity_type: a.type, title: a.title, summary: a.description, activity_date: a.start_datetime ?? a.due_date,
    }));
    return { deal, contacts, tasks, activities, docs: docs ?? [] };
  }

  if (name === "create_task") {
    const { data, error } = await supabase.from("actions").insert({
      type: "task",
      status: "open",
      title: input.title,
      deal_id: input.deal_id ?? null,
      due_date: input.due_date ?? null,
      priority: input.priority_level ?? "medium",
      description: input.description ?? null,
      user_id: userId,
    }).select("id, title").single();
    if (error) return { error: error.message };
    return { success: true, task: data, message: `Tâche "${data.title}" créée avec succès.` };
  }

  if (name === "create_activity") {
    // Mapper les anciens activity_type du prompt IA vers les types unifiés de actions
    const ACTIVITY_TYPE_MAP: Record<string, string> = {
      email_sent: "email", email_received: "email",
      call: "call", meeting: "meeting",
      follow_up: "task", note: "note",
      document_sent: "note", nda: "note", deck_sent: "note", other: "note",
    };
    const mappedType = ACTIVITY_TYPE_MAP[input.activity_type] ?? "note";
    const today = new Date().toISOString().split("T")[0];
    const activityDate = input.activity_date ?? today;
    const { data, error } = await supabase.from("actions").insert({
      type: mappedType,
      status: "completed",
      title: input.title,
      description: input.summary ?? null,
      start_datetime: activityDate,
      due_date: activityDate,
      email_direction: input.activity_type === "email_received" ? "received" : input.activity_type === "email_sent" ? "sent" : null,
      deal_id: input.deal_id,
      user_id: userId,
    }).select("id, title").single();
    if (error) return { error: error.message };
    return { success: true, activity: data, message: `Activité "${data.title}" enregistrée.` };
  }

  return { error: "Outil inconnu." };
}

export async function POST(request: NextRequest) {
  try {
    const { messages, stats } = await request.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? "";
    const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const systemPrompt = `Tu es l'assistant de VF Tool, l'outil M&A interne de Vectis Finance, spécialisé en M&A small cap.
Aujourd'hui : ${today}.

Base de données actuelle :
- ${stats.deals} dossiers · ${stats.contacts} contacts · ${stats.orgs} organisations

Tu as accès à des outils pour lire et écrire dans la base CRM en temps réel.
Utilise-les systématiquement quand l'utilisateur te parle d'un dossier, contact, ou veut créer quelque chose.

Règles :
- Réponds toujours en français
- Sois direct et professionnel
- Pour les emails, fournis objet + corps complet, prêts à copier
- Avant de créer une tâche ou activité, confirme les détails si nécessaire
- Quand tu récupères des données, présente-les clairement et propose des actions`;

    let currentMessages = [...messages];
    let finalText = "";

    // Boucle agent : max 5 itérations pour gérer les tool_use
    for (let i = 0; i < 5; i++) {
      const response = await client.messages.create({
        model: claudeModel("smart"),
        max_tokens: 2000,
        system: systemPrompt,
        tools,
        messages: currentMessages,
      });

      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find(b => b.type === "text");
        finalText = textBlock?.type === "text" ? textBlock.text : "Réponse reçue.";
        break;
      }

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
        const toolResults: Anthropic.MessageParam = {
          role: "user",
          content: await Promise.all(
            toolUseBlocks.map(async (block) => {
              if (block.type !== "tool_use") return { type: "tool_result" as const, tool_use_id: "", content: "" };
              const result = await executeTool(block.name, block.input as Record<string, string>, userId);
              return {
                type: "tool_result" as const,
                tool_use_id: block.id,
                content: JSON.stringify(result),
              };
            })
          ),
        };

        currentMessages = [
          ...currentMessages,
          { role: "assistant" as const, content: response.content },
          toolResults,
        ];
        continue;
      }

      break;
    }

    return NextResponse.json({ text: finalText || "Je n'ai pas pu générer une réponse." });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
