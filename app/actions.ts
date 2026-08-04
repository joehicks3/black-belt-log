"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return {
    supabase,
    user,
  };
}

type ParsedEntryFormData =
  | {
      success: true;
      exerciseId: string;
      quantity: number;
      completedAt: string;
      notes: string;
    }
  | {
      success: false;
      error: string;
    };

function parseEntryFormData(
  formData: FormData,
): ParsedEntryFormData {
  console.log({
    exercise_id: formData.get("exercise_id"),
    quantity: formData.get("quantity"),
    completed_at: formData.get("completed_at"),
    notes: formData.get("notes"),
  });

  const exerciseIdValue =
    formData.get("exercise_id");

  const quantityValue =
    formData.get("quantity");

  const completedAtValue =
    formData.get("completed_at");

  const notesValue =
    formData.get("notes");

  if (
    typeof exerciseIdValue !== "string" ||
    typeof quantityValue !== "string" ||
    typeof completedAtValue !== "string" ||
    !exerciseIdValue ||
    !quantityValue ||
    !completedAtValue
  ) {
    return {
      success: false,
      error:
        "Missing required entry information",
    };
  }

  const quantity = Number(quantityValue);

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return {
      success: false,
      error:
        "Quantity must be greater than zero",
    };
  }

  if (typeof notesValue !== "string") {
    return {
      success: false,
      error: "Notes must be a string",
    };
  }

  return {
    success: true,
    exerciseId: exerciseIdValue,
    quantity,
    completedAt: completedAtValue,
    notes: notesValue,
  };
}

export async function addExerciseEntry(formData: FormData) {
  const parsed = parseEntryFormData(formData);

  if ("error" in parsed) {
    redirect(`/?error=${encodeURIComponent(parsed.error)}`);
  }

  const { supabase, user } = await getAuthenticatedUser();

  const { error } = await supabase.from("exercise_entries").insert({
    exercise_id: parsed.exerciseId,
    quantity: parsed.quantity,
    completed_at: parsed.completedAt,
    notes: parsed.notes,
    user_id: user.id,
  });

  if (error) {
    console.error("Unable to add exercise entry:", error);

    redirect(
      `/?error=${encodeURIComponent(
        `Unable to save entry: ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/");
  revalidatePath("/history");
  redirect("/?success=Activity logged");
}

export async function updateExerciseEntry(formData: FormData) {
  const entryId = formData.get("entry_id");

  if (typeof entryId !== "string" || !entryId) {
    redirect("/?error=Invalid activity entry");
  }

  const parsed = parseEntryFormData(formData);

  if ("error" in parsed) {
    redirect(
      `/entries/${entryId}/edit?error=${encodeURIComponent(parsed.error)}`,
    );
  }

  const { supabase, user } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("exercise_entries")
    .update({
      exercise_id: parsed.exerciseId,
      quantity: parsed.quantity,
      completed_at: parsed.completedAt,
      notes: parsed.notes,
    })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Unable to update exercise entry:", error);

    redirect(
      `/entries/${entryId}/edit?error=${encodeURIComponent(
        `Unable to update entry: ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/");
  revalidatePath(`/entries/${entryId}/edit`);
  revalidatePath("/history");

  redirect("/?success=Activity updated");
}

export async function deleteExerciseEntry(formData: FormData) {
  const entryId = formData.get("entry_id");

  if (typeof entryId !== "string" || !entryId) {
    redirect("/?error=Invalid activity entry");
  }

  const { supabase, user } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("exercise_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Unable to delete exercise entry:", error);

    redirect(
      `/?error=${encodeURIComponent(
        `Unable to delete entry: ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/");
  revalidatePath("/history");
  redirect("/?success=Activity deleted");
}