"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { UnifiedActivityFormData } from "@/app/protected/components/unified-activity-modal";

/**
 * Créer une nuvre activité unifiée (task, meeting, event, etc.)
 */
export async function createUnifiedActivityAction(
  form: UnifiedActivityFormData,
  redirectPath?: string
) {
  try {
    const supabase = await createClient();

    // Récupérer le user_id actuel
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Préparer les données
    // Support multi-org : utiliser le premier de organizationIds si disponible
    const orgId = form.organizationIds?.[0] || form.organizationId || null;
    const activityData = {
      title: form.title,
      summary: form.summary || null,
      activity_type: form.activityType,
      task_status: form.status,
      activity_date: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      due_date: form.dueDate || null,
      due_time: form.dueTime || null,
      location: form.location || null,
      is_all_day: form.isAllDay || false,
      deal_id: form.dealId || null,
      contact_id: form.contactId || null,
      organization_id: orgId,
      user_id: user.id,
    };

    // Insérer l'activité
    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .insert([activityData])
      .select()
      .single();

    if (activityError) {
      console.error("Activity creation error:", activityError);
      return { success: false, error: activityError.message };
    }

    // Ajouter les participants
    if (form.participantContactIds && form.participantContactIds.length > 0) {
      const participantData = form.participantContactIds.map(contact_id => ({
        activity_id: activity.id,
        contact_id,
        user_id: user.id,
      }));

      const { error: participantsError } = await supabase
        .from("activity_contacts")
        .insert(participantData);

      if (participantsError) {
        console.error("Error adding participants:", participantsError);
        // Ne pas bloquer sur cette erreur
      }
    }

    // Revalider les paths concernés
    revalidatePath("/protected/dashboard");
    revalidatePath("/protected/ia");
    if (form.dealId) {
      revalidatePath(`/protected/dossiers/${form.dealId}`);
    }

    return {
      success: true,
      activity: {
        id: activity.id,
        ...activity,
      },
    };
  } catch (err) {
    console.error("Unexpected error in createUnifiedActivityAction:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Mettre à jour une activité existante
 */
export async function updateUnifiedActivityAction(
  activityId: string,
  updates: Partial<UnifiedActivityFormData>
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Préparer les données à mettre à jour
    const updateData: Record<string, any> = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.summary !== undefined) updateData.summary = updates.summary;
    if (updates.activityType !== undefined)
      updateData.activity_type = updates.activityType;
    if (updates.status !== undefined) updateData.task_status = updates.status;
    if (updates.dueDate !== undefined) {
      updateData.due_date = updates.dueDate;
      updateData.activity_date = updates.dueDate ? new Date(updates.dueDate).toISOString() : null;
    }
    if (updates.dueTime !== undefined) updateData.due_time = updates.dueTime;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.isAllDay !== undefined) updateData.is_all_day = updates.isAllDay;
    if (updates.dealId !== undefined) updateData.deal_id = updates.dealId || null;
    if (updates.contactId !== undefined) updateData.contact_id = updates.contactId || null;
    // Support multi-org : utiliser le premier de organizationIds si fourni
    if (updates.organizationIds !== undefined) {
      updateData.organization_id = updates.organizationIds?.[0] || null;
    } else if (updates.organizationId !== undefined) {
      updateData.organization_id = updates.organizationId;
    }

    // Mettre à jour l'activité
    const { data: activity, error: updateError } = await supabase
      .from("activities")
      .update(updateData)
      .eq("id", activityId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return { success: false, error: updateError.message };
    }

    // Mettre à jour les participants si fourni
    if (updates.participantContactIds !== undefined) {
      // Supprimer les participants existants
      await supabase
        .from("activity_contacts")
        .delete()
        .eq("activity_id", activityId);

      // Ajouter les nouveaux participants
      if (updates.participantContactIds.length > 0) {
        const participantData = updates.participantContactIds.map(contact_id => ({
          activity_id: activityId,
          contact_id,
          user_id: user.id,
        }));

        await supabase.from("activity_contacts").insert(participantData);
      }
    }

    revalidatePath("/protected/dashboard");
    revalidatePath("/protected/ia");

    return { success: true, activity };
  } catch (err) {
    console.error("Unexpected error in updateUnifiedActivityAction:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Supprimer une activité
 */
export async function deleteUnifiedActivityAction(activityId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Supprimer les participants d'abord (cascade)
    await supabase
      .from("activity_contacts")
      .delete()
      .eq("activity_id", activityId);

    // Supprimer l'activité
    const { error: deleteError } = await supabase
      .from("activities")
      .delete()
      .eq("id", activityId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return { success: false, error: deleteError.message };
    }

    revalidatePath("/protected/dashboard");
    revalidatePath("/protected/ia");

    return { success: true };
  } catch (err) {
    console.error("Unexpected error in deleteUnifiedActivityAction:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Ajouter un participant à une activité
 */
export async function addActivityParticipantAction(
  activityId: string,
  contactId: string
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase.from("activity_contacts").insert([
      {
        activity_id: activityId,
        contact_id: contactId,
        user_id: user.id,
      },
    ]);

    if (error) {
      console.error("Error adding participant:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/protected/dashboard");

    return { success: true };
  } catch (err) {
    console.error("Unexpected error in addActivityParticipantAction:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Assigner une organisation primaire à un contact
 */
export async function setContactPrimaryOrganizationAction(
  contactId: string,
  organizationId: string
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Mettre à jour le contact
    const { error: updateError } = await supabase
      .from("contacts")
      .update({ primary_organization_id: organizationId })
      .eq("id", contactId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating contact:", updateError);
      return { success: false, error: updateError.message };
    }

    // S'assurer que le contact est dans organization_contacts
    await supabase.from("organization_contacts").upsert(
      [
        {
          organization_id: organizationId,
          contact_id: contactId,
          user_id: user.id,
        },
      ],
      { onConflict: "organization_id,contact_id" }
    );

    revalidatePath("/protected/contacts");
    revalidatePath(`/protected/contacts/${contactId}`);
    revalidatePath("/protected/organisations");

    return { success: true };
  } catch (err) {
    console.error("Unexpected error in setContactPrimaryOrganizationAction:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
