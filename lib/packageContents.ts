import type { AppOrderItem, Delivery } from "@/lib/types";

function describeItem(item: AppOrderItem): string | null {
  const description = item.description?.trim();
  const category = item.category?.trim();
  const weight = item.weight_kg == null ? NaN : Number(item.weight_kg);
  const parts = [
    description || null,
    category && category.toLowerCase() !== description?.toLowerCase()
      ? category.charAt(0).toUpperCase() + category.slice(1)
      : null,
    Number.isFinite(weight) && weight > 0 ? `${weight} kg` : null,
    item.delicate_handling ? "Delicate" : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" · ") : null;
}

/**
 * What is in the package. App and WhatsApp orders keep it in `order_items`
 * (the customer's own description); dashboard-entered and imported deliveries
 * keep it in `deliveries.content`.
 */
export function packageContents(delivery: Pick<Delivery, "content" | "app_order">): string | null {
  const fromItems = (delivery.app_order?.items ?? [])
    .map(describeItem)
    .filter((line): line is string => Boolean(line));
  if (fromItems.length) return fromItems.join("; ");
  return delivery.content?.trim() || null;
}
