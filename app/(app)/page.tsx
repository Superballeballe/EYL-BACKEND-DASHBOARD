import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader, StatCard, PaymentBadge, EmptyState } from "@/components/ui";
import { fmtDate, money, todayISO } from "@/lib/format";
import type { DailyAssignment, Delivery, WorkDay } from "@/lib/types";

export const dynamic = "force-dynamic";

const PERIOD_START = "2026-04-01";

type PeriodRow = Pick<Delivery, "fees" | "payment_status" | "assignment_status">;

async function fetchAllPeriodRows(
  db: ReturnType<typeof supabaseAdmin>,
): Promise<PeriodRow[]> {
  const PAGE = 1000;
  const all: PeriodRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db
      .from("deliveries")
      .select("fees,payment_status,assignment_status")
      .gte("task_date", PERIOD_START)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as PeriodRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

async function getData(today: string) {
  const db = supabaseAdmin();
  const [del, asg, wd, unpaid, review, periodRows] = await Promise.all([
    db.from("deliveries").select("*").eq("task_date", today).order("serial_no", { nullsFirst: false }),
    db.from("daily_assignments").select("*").eq("work_date", today).order("role").order("position"),
    db.from("work_days").select("*").eq("work_date", today).maybeSingle(),
    db.from("deliveries").select("id", { count: "exact", head: true }).eq("task_date", today).eq("payment_status", "unpaid"),
    db.from("deliveries").select("id", { count: "exact", head: true }).eq("needs_review", true),
    fetchAllPeriodRows(db),
  ]);

  const active = periodRows.filter((d) => d.assignment_status !== "cancelled");
  const sumFees = (rows: PeriodRow[]) => rows.reduce((s, d) => s + (d.fees ?? 0), 0);
  const paidRows = active.filter((d) => d.payment_status === "paid");
  const unpaidRows = active.filter(
    (d) => d.payment_status === "unpaid" || d.payment_status === "partial",
  );

  return {
    deliveries: (del.data ?? []) as Delivery[],
    assignments: (asg.data ?? []) as DailyAssignment[],
    workDay: (wd.data ?? null) as WorkDay | null,
    unpaidCount: unpaid.count ?? 0,
    reviewCount: review.count ?? 0,
    period: {
      count: active.length,
      paidAmount: sumFees(paidRows),
      unpaidAmount: sumFees(unpaidRows),
      paidCount: paidRows.length,
      unpaidCount: unpaidRows.length,
    },
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawDate = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const viewDate = rawDate && ISO_DATE.test(rawDate) ? rawDate : todayISO();
  const isToday = viewDate === todayISO();

  let data;
  try {
    data = await getData(viewDate);
  } catch {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="card p-6">
          <p className="font-semibold">Supabase is not configured yet.</p>
          <p className="text-sm text-[var(--muted)] mt-2">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> to <code>.env.local</code>, run the SQL
            migration in <code>supabase/migrations/</code>, then refresh. See the README.
          </p>
        </div>
      </div>
    );
  }

  const { deliveries, assignments, workDay, unpaidCount, reviewCount, period } = data;
  const revenue = deliveries
    .filter((d) => d.assignment_status !== "cancelled")
    .reduce((s, d) => s + (d.fees ?? 0), 0);
  const walkers = assignments.filter((a) => a.role === "walker");
  const bikers = assignments.filter((a) => a.role === "biker");

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          <form method="get" action="/" className="flex items-center gap-2">
            <input
              type="date"
              name="date"
              defaultValue={viewDate}
              className="input !py-1 !px-2 !w-auto text-sm"
            />
            <button type="submit" className="btn btn-secondary !py-1 !px-2 text-xs">Go</button>
            {!isToday && (
              <Link href="/" className="text-xs text-[var(--muted)] hover:underline">Today</Link>
            )}
            <span className="text-sm text-[var(--muted)]">
              {fmtDate(viewDate)}{workDay?.is_sunday ? " · Sunday" : ""}
            </span>
          </form>
        }
        action={
          <Link href="/deliveries/new" className="btn btn-primary">
            + New delivery
          </Link>
        }
      />

      {workDay?.note && (
        <div className="card p-3 mb-5 text-sm bg-[#fff4e5] border-[#f3d9a8]">
          <span className="font-semibold">Note:</span> {workDay.note}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
          Since 1 April 2026
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Deliveries"
            value={period.count}
            href={`/deliveries?from=${PERIOD_START}`}
          />
          <StatCard
            label="Paid amount"
            value={money(period.paidAmount)}
            tone="green"
            hint={`${period.paidCount} delivery${period.paidCount === 1 ? "" : "s"}`}
            href={`/deliveries?payment_status=paid&from=${PERIOD_START}`}
          />
          <StatCard
            label="Unpaid amount"
            value={money(period.unpaidAmount)}
            tone={period.unpaidAmount > 0 ? "red" : "default"}
            hint={`${period.unpaidCount} delivery${period.unpaidCount === 1 ? "" : "s"}`}
            href={`/deliveries?payment_status=unpaid&from=${PERIOD_START}`}
          />
          <StatCard
            label="Collection rate"
            value={
              period.paidAmount + period.unpaidAmount > 0
                ? `${Math.round((period.paidAmount / (period.paidAmount + period.unpaidAmount)) * 100)}%`
                : "—"
            }
            hint="Paid ÷ (Paid + Unpaid)"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label={isToday ? "Deliveries today" : "Deliveries"} value={deliveries.length} href={`/deliveries?date=${viewDate}`} />
        <StatCard label={isToday ? "Revenue today" : "Revenue"} value={money(revenue)} tone="green" hint="Sum of fees" />
        <StatCard label={isToday ? "Unpaid today" : "Unpaid"} value={unpaidCount} tone={unpaidCount ? "red" : "default"} />
        <StatCard
          label="Needs review"
          value={reviewCount}
          tone={reviewCount ? "amber" : "default"}
          href="/deliveries?needs_review=true"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">{isToday ? "Today's lineup" : "Lineup"}</h2>
            <Link href={`/lineup?date=${viewDate}`} className="text-sm text-[var(--brand)] hover:underline">
              Manage
            </Link>
          </div>
          {assignments.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No lineup set for this day.</p>
          ) : (
            <div className="space-y-4">
              <LineupGroup title={`Walkers (${walkers.length})`} rows={walkers} />
              <LineupGroup title={`Bikers (${bikers.length})`} rows={bikers} />
            </div>
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">{isToday ? "Today's deliveries" : "Deliveries"}</h2>
            <Link href={`/deliveries?date=${viewDate}`} className="text-sm text-[var(--brand)] hover:underline">
              View all
            </Link>
          </div>
          {deliveries.length === 0 ? (
            <EmptyState message="No deliveries logged for this day." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Sender</th>
                    <th>Pickup → Drop</th>
                    <th>Knight</th>
                    <th>Fees</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.slice(0, 20).map((d, i) => (
                    <tr key={d.id}>
                      <td className="text-[var(--muted)]">{d.serial_no ?? i + 1}</td>
                      <td>
                        <Link href={`/deliveries/${d.id}/edit`} className="text-[var(--brand)] hover:underline">
                          {d.sender_name ?? "—"}
                        </Link>
                      </td>
                      <td className="text-xs">
                        {d.pickup_location ?? "—"} → {d.drop_location ?? "—"}
                      </td>
                      <td>{d.knight_name ?? "—"}</td>
                      <td>{money(d.fees)}</td>
                      <td><PaymentBadge status={d.payment_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deliveries.length > 20 && (
                <p className="text-xs text-[var(--muted)] mt-2">
                  Showing 20 of {deliveries.length}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LineupGroup({ title, rows }: { title: string; rows: DailyAssignment[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">None</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((a) => (
            <li key={a.id} className="text-sm flex items-center justify-between gap-2">
              <span className="font-medium">
                {a.knight_name ?? "—"}
                {a.status !== "working" && (
                  <span className="badge badge-amber ml-2">{a.status.replace("_", " ")}</span>
                )}
              </span>
              <span className="text-xs text-[var(--muted)] text-right">
                {a.location ?? ""} {a.shift_time ? `· ${a.shift_time}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
