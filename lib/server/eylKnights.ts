import { supabaseAdmin } from "@/lib/supabase/admin";
import { invalidateRoster } from "@/lib/server/roster";
import type { EylKnight } from "@/lib/types";

function displayNameFromApplicant(applicant: EylKnight) {
  const parts = (applicant.name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? "Knight";
}

async function insertRosterKnight(applicant: EylKnight) {
  const baseName = displayNameFromApplicant(applicant);
  const suffix = applicant.phone?.slice(-4) ?? applicant.user_id.slice(0, 4);
  const candidates = [baseName, `${baseName}${suffix}`, `${baseName}-${suffix}`];

  for (const display_name of candidates) {
    const { data, error } = await supabaseAdmin()
      .from("knights")
      .insert({
        full_name: applicant.name ?? display_name,
        display_name,
        role: applicant.knight_role ?? "walker",
        joining_date: new Date().toISOString().slice(0, 10),
        default_location: applicant.work_areas?.[0] ?? null,
        active: true,
        note: `EYL app · ${applicant.email ?? applicant.user_id}`,
      })
      .select("id")
      .maybeSingle();

    if (!error && data) return data.id;
    if (error && !/duplicate|unique/i.test(error.message)) throw error;
  }

  throw new Error("Could not create a unique roster name for this knight");
}

/** Approve applicant and add them to the ops knights roster when needed. */
export async function approveEylKnight(applicant: EylKnight, reviewNote: string | null) {
  let knightId = applicant.knight_id;
  if (!knightId) {
    knightId = await insertRosterKnight(applicant);
    invalidateRoster();
  }

  const { data, error } = await supabaseAdmin()
    .from("eyl_knights")
    .update({
      status: "approved",
      review_note: reviewNote,
      approved_at: new Date().toISOString(),
      rejected_at: null,
      knight_id: knightId,
      knight_role: applicant.knight_role ?? "walker",
    })
    .eq("id", applicant.id)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Applicant not found");
  return data;
}

export async function rejectEylKnight(applicantId: string, reviewNote: string | null) {
  const { data, error } = await supabaseAdmin()
    .from("eyl_knights")
    .update({
      status: "rejected",
      review_note: reviewNote,
      rejected_at: new Date().toISOString(),
      approved_at: null,
    })
    .eq("id", applicantId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Applicant not found");
  return data;
}
