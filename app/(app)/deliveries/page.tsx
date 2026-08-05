import Link from "next/link";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import NewDeliveryButton from "@/components/NewDeliveryButton";
import DeliveriesFilters from "@/components/DeliveriesFilters";
import DeliveriesPagination from "@/components/DeliveriesPagination";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { EmptyState } from "@/components/ui";
import DeliveryTable from "@/components/DeliveryTable";
import { getDeliveryFormOptions } from "@/lib/server/formOptions";
import { getSessionUser } from "@/lib/server/session";
import { fmtDate } from "@/lib/format";
import { parseSerialQuery } from "@/lib/serial";
import type { Delivery } from "@/lib/types";

export const dynamic = "force-dynamic";

const LIMIT = 100;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const APP_ORDER_SELECTS = [
  "id, order_code, status, rider_name, pickup_scheduled_at, delivery_scheduled_at, accepted_at, rider_assigned_at",
  "id, order_code, status",
  "id, order_code",
];

async function loadAppOrders(
  db: ReturnType<typeof supabaseAdmin>,
  appOrderIds: string[],
): Promise<{ orders: NonNullable<Delivery["app_order"]>[]; error: string | null }> {
  for (const columns of APP_ORDER_SELECTS) {
    const { data, error } = await db.from("orders").select(columns).in("id", appOrderIds);
    if (!error) {
      return {
        orders: (data ?? []) as unknown as NonNullable<Delivery["app_order"]>[],
        error: null,
      };
    }
  }

  return { orders: [], error: "App order status could not be loaded." };
}

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const date = one(sp.date);
  const from = one(sp.from) || date;
  const to = one(sp.to) || date;
  const q = one(sp.q);
  const paymentStatus = one(sp.payment_status);
  const knightId = one(sp.knight_id);
  const fulfillmentStatus = one(sp.status);
  const needsReview = one(sp.needs_review) === "true";
  const openNew = one(sp.new) === "1";
  const offset = Math.max(0, Number(one(sp.offset)) || 0);

  const hasFilters = Boolean(
    q || date || from || to || paymentStatus || knightId || fulfillmentStatus || needsReview,
  );

  const db = supabaseAdmin();
  const [{ knights, clients, rateTiers }, user] = await Promise.all([
    getDeliveryFormOptions(),
    getSessionUser(),
  ]);

  let query = db
    .from("deliveries")
    .select("*", { count: "exact" })
    .order("task_date", { ascending: false, nullsFirst: false })
    .order("serial_no", { ascending: true, nullsFirst: false })
    .range(offset, offset + LIMIT - 1);

  if (from && to && from === to) query = query.eq("task_date", from);
  else {
    if (from) query = query.gte("task_date", from);
    if (to) query = query.lte("task_date", to);
  }
  if (paymentStatus) query = query.eq("payment_status", paymentStatus);
  if (knightId) query = query.eq("knight_id", knightId);
  if (fulfillmentStatus) query = query.eq("fulfillment_status", fulfillmentStatus);
  if (needsReview) query = query.eq("needs_review", true);
  if (q) {
    const serialNo = parseSerialQuery(q);
    if (serialNo != null) {
      query = query.eq("serial_no", serialNo);
    } else {
      const t = `%${q}%`;
      query = query.or(
        [
          `sender_name.ilike.${t}`,
          `sender_last_name.ilike.${t}`,
          `drop_recipient_name.ilike.${t}`,
          `billing_name.ilike.${t}`,
          `content.ilike.${t}`,
          `pickup_location.ilike.${t}`,
          `drop_location.ilike.${t}`,
          `invoice_no.ilike.${t}`,
        ].join(","),
      );
    }
  }

  const { data, count, error: deliveriesError } = await query;
  const deliveryRows = (data ?? []) as Delivery[];
  const appOrderIds = Array.from(
    new Set(deliveryRows.map((row) => row.app_order_id).filter((id): id is string => Boolean(id))),
  );
  const appOrdersById = new Map<string, NonNullable<Delivery["app_order"]>>();
  let appOrdersError: string | null = null;

  if (appOrderIds.length > 0) {
    const { orders: appOrders, error } = await loadAppOrders(db, appOrderIds);
    if (error) {
      appOrdersError = error;
    } else {
      for (const order of appOrders) {
        appOrdersById.set(order.id, order as NonNullable<Delivery["app_order"]>);
      }
    }
  }

  const rows = deliveryRows.map((row) => ({
    ...row,
    app_order: row.app_order_id ? appOrdersById.get(row.app_order_id) ?? null : null,
  }));
  const total = count ?? 0;

  const dateSummary =
    from && to && from === to
      ? fmtDate(from)
      : from || to
        ? `${from ? `from ${fmtDate(from)}` : ""}${from && to ? " " : ""}${to ? `to ${fmtDate(to)}` : ""}`.trim()
        : undefined;

  return (
    <div>
      <DeliveriesFilters
        knights={knights}
        total={total}
        hasFilters={hasFilters}
        dateSummary={dateSummary}
        action={
          <NewDeliveryButton
            knights={knights}
            clients={clients}
            rateTiers={rateTiers}
            defaultOpen={openNew}
          />
        }
        values={{
          q,
          from,
          to,
          knightId,
          paymentStatus,
          fulfillmentStatus,
        }}
      />

      {deliveriesError ? (
        <EmptyState message={`Could not load deliveries: ${deliveriesError.message}`} />
      ) : appOrdersError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Deliveries loaded, but app order status could not be loaded: {appOrdersError}
        </Alert>
      ) : null}

      {!deliveriesError && rows.length === 0 ? (
        <EmptyState
          message={
            hasFilters
              ? "No deliveries match these filters. Try clearing filters or broadening your search."
              : "No deliveries yet. Create your first booking to get started."
          }
        />
      ) : !deliveriesError ? (
        <>
          <DeliveryTable
            rows={rows}
            knights={knights}
            clients={clients}
            rateTiers={rateTiers}
            isAdmin={user?.role === "admin"}
          />
          {total > LIMIT ? <DeliveriesPagination sp={sp} offset={offset} total={total} /> : null}
        </>
      ) : null}

      {!deliveriesError && rows.length === 0 && hasFilters ? (
        <Button component={Link} href="/deliveries" variant="outlined" sx={{ mt: 2 }}>
          Clear all filters
        </Button>
      ) : null}
    </div>
  );
}
