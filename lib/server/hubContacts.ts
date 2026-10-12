import { NextResponse } from "next/server";
import { badRequest } from "@/lib/api";
import { HUB_CONTACTS_MAX_ACTIVE } from "@/lib/schemas";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const HUB_CONTACT_COLUMNS = "id, label, description, phone, sort_order, active, updated_at";

/**
 * Turns the hub_contacts check/trigger errors into a 400 with copy ops can act
 * on. Returns null for anything else so the caller can serverError() it.
 */
export function hubContactWriteError(error: { code?: string; message?: string }) {
  if (error.code !== "23514") return null;
  const message = error.message ?? "";
  // Raised by the hub_contacts_cap_active trigger; its message is already user-facing.
  if (message.startsWith(`Only ${HUB_CONTACTS_MAX_ACTIVE} hub contacts`)) return badRequest(message);
  if (message.includes("hub_contacts_phone_e164")) {
    return badRequest("Use + and the country code with no spaces, e.g. +919876543210");
  }
  if (message.includes("hub_contacts_label_length")) {
    return badRequest("Label must be 1–40 characters");
  }
  return badRequest(message);
}

/**
 * The app shows one contact ("Urgent, connect with us"): the first active row.
 * Keep it to a single active row so what ops see here is what customers see.
 * Called after `keepId` was saved as active; the save happens first so a
 * failed save never leaves the app with no active contact.
 */
export async function deactivateOtherContacts(keepId: string) {
  const { error } = await supabaseAdmin()
    .from("hub_contacts")
    .update({ active: false })
    .eq("active", true)
    .neq("id", keepId);
  if (!error) return null;
  console.error("hub_contacts: could not hide the other active contacts", error);
  return NextResponse.json(
    { error: "Saved, but the other contacts are still active. Refresh the page and turn them off." },
    { status: 500 },
  );
}
