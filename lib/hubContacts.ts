// Shared helpers for the hub_contacts rows behind the app's
// "Urgent, connect with us" card (one official contact, Call + WhatsApp).

type SortableContact = { sort_order: number; label: string; active: boolean };

/** Same order the app uses: sort_order, then label. */
export function sortContacts<T extends SortableContact>(list: T[]): T[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

/** The row customers see: the first active one in app order, or null. */
export function shownContact<T extends SortableContact>(list: T[]): T | null {
  return sortContacts(list).find((c) => c.active) ?? null;
}

/** wa.me wants the number as digits only, with the country code and no "+". */
export function whatsAppLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

/** whatsAppLink() without the scheme, for showing to ops. */
export function whatsAppPreview(phone: string): string {
  return whatsAppLink(phone).replace(/^https:\/\//, "");
}
