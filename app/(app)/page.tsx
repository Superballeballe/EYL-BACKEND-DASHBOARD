import Typography from "@mui/material/Typography";
import { PageHeader } from "@/components/ui";
import DashboardShell from "@/components/DashboardShell";
import NewDeliveryButton from "@/components/NewDeliveryButton";
import { isAppOrderCancelled } from "@/lib/deliveryStatus";
import { attachAppOrders } from "@/lib/server/appOrders";
import { getDeliveryFormOptions } from "@/lib/server/formOptions";
import { getSessionUser } from "@/lib/server/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fmtDate, todayISO } from "@/lib/format";
import type { ChartBundle, MonthPoint } from "@/components/BusinessOverview";
import type { Delivery, DraftOrder, WorkDay } from "@/lib/types";

export const dynamic = "force-dynamic";

const PERIOD_START = "2026-04-01";

type PeriodRow = Pick<
  Delivery,
  "fees" | "payment_status" | "assignment_status" | "task_date" | "fulfillment_status"
>;

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function fetchAllPeriodRows(
  db: ReturnType<typeof supabaseAdmin>,
  from: string,
): Promise<PeriodRow[]> {
  const PAGE = 1000;
  const all: PeriodRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db
      .from("deliveries")
      .select("fees,payment_status,assignment_status,task_date,fulfillment_status")
      .gte("task_date", from)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as PeriodRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

function buildCharts(rows: PeriodRow[], today: string): ChartBundle {
  const year = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const active = rows.filter((d) => d.assignment_status !== "cancelled");

  const byMonth = new Map<string, MonthPoint>();
  for (let m = 1; m <= currentMonth; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    byMonth.set(key, {
      key,
      label: MONTH_LABELS[m - 1],
      deliveries: 0,
      revenue: 0,
      paid: 0,
      unpaid: 0,
    });
  }

  const statusCounts = new Map<string, number>();

  for (const row of active) {
    const date = row.task_date;
    if (!date || !date.startsWith(String(year))) continue;
    const key = date.slice(0, 7);
    const bucket = byMonth.get(key);
    if (!bucket) continue;

    const fees = row.fees ?? 0;
    bucket.deliveries += 1;
    bucket.revenue += fees;
    if (row.payment_status === "paid") bucket.paid += fees;
    else if (row.payment_status === "unpaid" || row.payment_status === "partial") bucket.unpaid += fees;

    const status = row.fulfillment_status ?? "unknown";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  const months = Array.from(byMonth.values());
  const statusOrder = ["booked", "accepted", "active", "completed", "cancelled", "unknown"];
  const statusBreakdown = statusOrder
    .filter((s) => (statusCounts.get(s) ?? 0) > 0 || ["booked", "accepted", "active", "completed"].includes(s))
    .map((status) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count: statusCounts.get(status) ?? 0,
    }));

  return {
    months,
    statusBreakdown,
    ytdRevenue: months.reduce((s, m) => s + m.revenue, 0),
    ytdDeliveries: months.reduce((s, m) => s + m.deliveries, 0),
  };
}

async function getData(today: string) {
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const db = supabaseAdmin();
  const [del, wd, unpaid, review, periodRows, pending, running, draft, formOpts] =
    await Promise.all([
      db
        .from("deliveries")
        .select("*")
        .eq("task_date", today)
        .order("serial_no", { nullsFirst: false }),
      db.from("work_days").select("*").eq("work_date", today).maybeSingle(),
      db
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .eq("task_date", today)
        .eq("payment_status", "unpaid"),
      db
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .eq("needs_review", true),
      fetchAllPeriodRows(db, yearStart),
      db
        .from("deliveries")
        .select("*")
        .eq("fulfillment_status", "booked")
        .neq("assignment_status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(80),
      db
        .from("deliveries")
        .select("*")
        .in("fulfillment_status", ["accepted", "active"])
        .neq("assignment_status", "cancelled")
        .order("updated_at", { ascending: false })
        .limit(80),
      db
        .from("orders")
        .select("id, order_code, pickup_address, delivery_address, recipient_name, total_price, expires_at, draft_reverted_at")
        .eq("status", "draft")
        .not("draft_reverted_at", "is", null)
        .order("draft_reverted_at", { ascending: false })
        .limit(80),
      getDeliveryFormOptions(),
    ]);

  const charts = buildCharts(periodRows, today);
  const fromPeriod = periodRows.filter(
    (d) => d.assignment_status !== "cancelled" && (d.task_date ?? "") >= PERIOD_START,
  );
  const sumFees = (rows: PeriodRow[]) => rows.reduce((s, d) => s + (d.fees ?? 0), 0);
  const paidRows = fromPeriod.filter((d) => d.payment_status === "paid");
  const unpaidRows = fromPeriod.filter(
    (d) => d.payment_status === "unpaid" || d.payment_status === "partial",
  );

  const [{ rows: pendingOrders }, { rows: runningOrders }] = await Promise.all([
    attachAppOrders(db, (pending.data ?? []) as Delivery[]),
    attachAppOrders(db, (running.data ?? []) as Delivery[]),
  ]);

  const activePending = pendingOrders.filter((d) => !isAppOrderCancelled(d.app_order));
  const draftOrders = (draft.data ?? []) as DraftOrder[];

  return {
    deliveries: (del.data ?? []) as Delivery[],
    workDay: (wd.data ?? null) as WorkDay | null,
    unpaidCount: unpaid.count ?? 0,
    reviewCount: review.count ?? 0,
    pendingOrders: activePending,
    draftOrders,
    runningOrders,
    knights: formOpts.knights as { id: string; display_name: string }[],
    clients: formOpts.clients,
    rateTiers: formOpts.rateTiers,
    charts,
    period: {
      count: fromPeriod.length,
      paidAmount: sumFees(paidRows),
      unpaidAmount: sumFees(unpaidRows),
      paidCount: paidRows.length,
      unpaidCount: unpaidRows.length,
    },
  };
}

export default async function Dashboard() {
  const today = todayISO();

  let data;
  try {
    data = await getData(today);
  } catch {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="card p-6">
          <p className="font-semibold">Supabase is not configured yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> to <code>.env.local</code>, run the SQL
            migration in <code>supabase/migrations/</code>, then refresh. See the README.
          </p>
        </div>
      </div>
    );
  }

  const {
    deliveries,
    workDay,
    unpaidCount,
    reviewCount,
    period,
    pendingOrders,
    draftOrders,
    runningOrders,
    knights,
    clients,
    rateTiers,
    charts,
  } = data;
  const revenue = deliveries
    .filter((d) => d.assignment_status !== "cancelled")
    .reduce((s, d) => s + (d.fees ?? 0), 0);
  const user = await getSessionUser();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {fmtDate(today)}
            {workDay?.is_sunday ? " · Sunday" : ""}
          </Typography>
        }
        action={
          <NewDeliveryButton knights={knights} clients={clients} rateTiers={rateTiers} />
        }
      />

      <DashboardShell
        viewDate={today}
        periodStart={PERIOD_START}
        workDay={workDay}
        deliveries={deliveries}
        unpaidCount={unpaidCount}
        reviewCount={reviewCount}
        period={period}
        revenue={revenue}
        pendingOrders={pendingOrders}
        draftOrders={draftOrders}
        runningOrders={runningOrders}
        knights={knights}
        clients={clients}
        rateTiers={rateTiers}
        isAdmin={user?.role === "admin"}
        charts={charts}
      />
    </div>
  );
}
