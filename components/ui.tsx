import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <div className="text-sm text-[var(--muted)] mt-1">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: "default" | "green" | "red" | "amber";
}) {
  const toneColor =
    tone === "green"
      ? "text-[#1a7f37]"
      : tone === "red"
        ? "text-[#b42318]"
        : tone === "amber"
          ? "text-[#9a6700]"
          : "text-[var(--text)]";
  const body = (
    <div className="card p-4 h-full">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${toneColor}`}>{value}</div>
      {hint && <div className="text-xs text-[var(--muted)] mt-1">{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-90 transition-opacity">
      {body}
    </Link>
  ) : (
    body
  );
}

export function PaymentBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="badge badge-gray">—</span>;
  const cls =
    status === "paid"
      ? "badge-green"
      : status === "unpaid"
        ? "badge-red"
        : status === "free"
          ? "badge-blue"
          : "badge-amber";
  return <span className={`badge ${cls}`}>{status}</span>;
}

const FULFILLMENT_META: Record<string, { label: string; cls: string }> = {
  placed: { label: "Placed", cls: "badge-gray" },
  picked_up: { label: "Picked up", cls: "badge-amber" },
  in_transit: { label: "In transit", cls: "badge-blue" },
  delivered: { label: "Delivered", cls: "badge-green" },
  cancelled: { label: "Cancelled", cls: "badge-red" },
};

export function FulfillmentBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="badge badge-gray">—</span>;
  const meta = FULFILLMENT_META[status];
  if (!meta) return <span className="badge badge-gray">{status}</span>;
  return <span className={`badge ${meta.cls}`}>{meta.label}</span>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="card p-10 text-center text-[var(--muted)] text-sm">{message}</div>
  );
}
