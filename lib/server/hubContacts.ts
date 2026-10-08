import { badRequest } from "@/lib/api";
import { HUB_CONTACTS_MAX_ACTIVE } from "@/lib/schemas";

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
