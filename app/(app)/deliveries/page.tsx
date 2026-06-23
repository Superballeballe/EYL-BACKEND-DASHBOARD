import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader, EmptyState } from "@/components/ui";
import DeliveryTable from "@/components/DeliveryTable";
import { getDeliveryFormOptions } from "@/lib/server/formOptions";
import { fmtDate } from "@/lib/format";
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
  const from = one(sp.from);
  const to = one(sp.to);
  const q = one(sp.q);
  const paymentStatus = one(sp.payment_status);
  const knightId = one(sp.knight_id);
  const needsReview = one(sp.needs_review) === "true";
  const offset = Math.max(0, Number(one(sp.offset)) || 0);

  const db = supabaseAdmin();
  const { knights, clients, rateTiers } = await getDeliveryFormOptions();

  let query = db
    .from("deliveries")
    .select("*", { count: "exact" })
    .order("task_date", { ascending: false, nullsFirst: false })
    .order("serial_no", { ascending: true, nullsFirst: false })
    .range(offset, offset + LIMIT - 1);

  if (date) query = query.eq("task_date", date);
  if (from) query = query.gte("task_date", from);
  if (to) query = query.lte("task_date", to);
  if (paymentStatus) query = query.eq("payment_status", paymentStatus);
  if (knightId) query = query.eq("knight_id", knightId);
  if (needsReview) query = query.eq("needs_review", true);
  if (q) {
    const t = `%${q}%`;
    query = query.or(
      [
        `sender_name.ilike.${t}`,
        `drop_recipient_name.ilike.${t}`,
        `billing_name.ilike.${t}`,
        `content.ilike.${t}`,
        `pickup_location.ilike.${t}`,
        `drop_location.ilike.${t}`,
        `invoice_no.ilike.${t}`,
      ].join(","),
    );
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

  return (
    <div>
      <PageHeader
        title="Deliveries"
        subtitle={
          (from || to
            ? `${from ? `from ${fmtDate(from)}` : ""}${from && to ? " " : ""}${to ? `to ${fmtDate(to)}` : ""} · `
            : "") + `${total} record${total === 1 ? "" : "s"}`
        }
        action={
          <Link href="/deliveries/new" className="btn btn-primary">
            + New delivery
          </Link>
        }
      />

      {/* Filter bar — plain GET form, no JS needed */}
      <form method="get" action="/deliveries" className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div className="lg:col-span-2">
          <label className="label">Search</label>
          <input name="q" defaultValue={q} className="input" placeholder="sender, recipient, content, invoice…" />
        </div>
        <div>
          <label className="label">Task date</label>
          <input type="date" name="date" defaultValue={date} className="input" />
        </div>
        <div>
          <label className="label">Knight</label>
          <select name="knight_id" defaultValue={knightId} className="select">
            <option value="">All</option>
            {knights.map((k) => (
              <option key={k.id} value={k.id}>
                {k.display_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Payment</label>
          <select name="payment_status" defaultValue={paymentStatus} className="select">
            <option value="">All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="free">Free</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1">Filter</button>
          <Link href="/deliveries" className="btn btn-secondary">Reset</Link>
        </div>
        <label className="flex items-center gap-2 text-sm lg:col-span-6">
          <input type="checkbox" name="needs_review" value="true" defaultChecked={needsReview} />
          Only show records needing review
        </label>
      </form>

      {deliveriesError ? (
        <EmptyState message={`Could not load deliveries: ${deliveriesError.message}`} />
      ) : appOrdersError ? (
        <div className="card p-3 mb-4 text-sm bg-[#fff4e5] border-[#f3d9a8] text-[#9a6700]">
          Deliveries loaded, but app order status could not be loaded: {appOrdersError}
        </div>
      ) : null}

      {!deliveriesError && rows.length === 0 ? (
        <EmptyState message="No deliveries match these filters." />
      ) : !deliveriesError ? (
        <DeliveryTable
          rows={rows}
          knights={knights}
          clients={clients}
          rateTiers={rateTiers}
        />
      ) : null}

      {total > LIMIT && (
        <Pagination sp={sp} offset={offset} total={total} />
      )}
    </div>
  );
}

function Pagination({ sp, offset, total }: { sp: SP; offset: number; total: number }) {
  const mk = (newOffset: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "offset") continue;
      const val = Array.isArray(v) ? v[0] : v;
      if (val) params.set(k, val);
    }
    if (newOffset > 0) params.set("offset", String(newOffset));
    return `/deliveries?${params.toString()}`;
  };
  const page = Math.floor(offset / LIMIT) + 1;
  const pages = Math.ceil(total / LIMIT);
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-[var(--muted)]">Page {page} of {pages}</span>
      <div className="flex gap-2">
        {offset > 0 && <Link href={mk(offset - LIMIT)} className="btn btn-secondary">← Prev</Link>}
        {offset + LIMIT < total && <Link href={mk(offset + LIMIT)} className="btn btn-secondary">Next →</Link>}
      </div>
    </div>
  );
}
