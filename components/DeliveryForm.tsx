"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";

type KnightOpt = { id: string; display_name: string };
type ClientOpt = {
  id: string;
  client_name: string;
  company_name: string | null;
  gst_no: string | null;
  address: string | null;
};
type RateTier = { min_km: number | null; max_km: number | null; fee: number | null };

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
  variant = "page",
}: {
  title: string;
  children: React.ReactNode;
  variant?: "page" | "modal";
}) {
  const isModal = variant === "modal";

  return (
    <section
      className={
        isModal
          ? "border-t border-[var(--border)] pt-4 first:border-t-0 first:pt-0"
          : "card p-5"
      }
    >
      <h2
        className={`text-sm font-bold uppercase tracking-wider text-[var(--muted)] ${
          isModal ? "mb-3" : "mb-4"
        }`}
      >
        {title}
      </h2>
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isModal ? "gap-3" : "gap-4"}`}>
        {children}
      </div>
    </section>
  );
}

export default function DeliveryForm({
  mode,
  id,
  initial,
  knights,
  clients,
  rateTiers,
  onSaved,
  onCancel,
  variant = "page",
}: {
  mode: "new" | "edit";
  id?: string;
  initial?: Record<string, any> | null;
  knights: KnightOpt[];
  clients: ClientOpt[];
  rateTiers: RateTier[];
  onSaved?: (delivery: Record<string, any>) => void;
  onCancel?: () => void;
  variant?: "page" | "modal";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }, []);

  const { register, handleSubmit, watch, setValue } = useForm<Record<string, any>>({
    defaultValues: {
      task_date: today,
      mode_of_booking: "online",
      assignment_status: "assigned",
      fulfillment_status: "placed",
      ...(initial ?? {}),
    },
  });

  const kms = watch("kms");
  const suggestedFee = useMemo(() => {
    const k = Number(kms);
    if (!Number.isFinite(k) || !rateTiers.length) return null;
    const tier = rateTiers.find(
      (t) => (t.min_km ?? 0) <= k && k <= (t.max_km ?? Infinity),
    );
    return tier?.fee ?? null;
  }, [kms, rateTiers]);

  function applyClient(name: string) {
    const c = clients.find(
      (x) => x.client_name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (c) {
      setValue("client_id", c.id);
      if (c.address) setValue("billing_address", c.address);
      if (c.gst_no) setValue("gst_no", c.gst_no);
    } else {
      setValue("client_id", null);
    }
  }

  async function onSubmit(values: Record<string, any>) {
    setSaving(true);
    setError(null);
    try {
      const url = mode === "new" ? "/api/deliveries" : `/api/deliveries/${id}`;
      const method = mode === "new" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        const saved = await res.json().catch(() => null);
        if (onSaved && saved) {
          onSaved(saved);
          router.refresh();
        } else {
          router.push("/deliveries");
          router.refresh();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Save failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={variant === "modal" ? "space-y-4" : "space-y-5"}>
      <Section title="Booking" variant={variant}>
        <Field label="Task date">
          <input type="date" className="input" {...register("task_date")} />
        </Field>
        <Field label="Booking date">
          <input type="date" className="input" {...register("booking_date")} />
        </Field>
        <Field label="Mode of booking">
          <select className="select" {...register("mode_of_booking")}>
            <option value="">—</option>
            <option value="online">Online</option>
            <option value="b2b">B2B</option>
          </select>
        </Field>
        <Field label="Serial no.">
          <input type="number" className="input" {...register("serial_no")} />
        </Field>
      </Section>

      <Section title="Sender" variant={variant}>
        <Field label="Name">
          <input className="input" {...register("sender_name")} placeholder="Business / person sending" />
        </Field>
        <Field label="Last name / booked by">
          <input className="input" {...register("sender_last_name")} />
        </Field>
      </Section>

      <Section title="Pickup" variant={variant}>
        <Field label="Pickup location">
          <input className="input" {...register("pickup_location")} />
        </Field>
        <Field label="Pickup time window">
          <input className="input" {...register("pickup_time_window")} placeholder="e.g. 11-1130" />
        </Field>
        <Field label="Pickup actual time">
          <input className="input" {...register("pickup_actual_time")} placeholder="e.g. 11:23" />
        </Field>
      </Section>

      <Section title="Drop" variant={variant}>
        <Field label="Drop location">
          <input className="input" {...register("drop_location")} />
        </Field>
        <Field label="Recipient name">
          <input className="input" {...register("drop_recipient_name")} />
        </Field>
        <Field label="Drop time window">
          <input className="input" {...register("drop_time_window")} />
        </Field>
        <Field label="Drop actual time">
          <input className="input" {...register("drop_actual_time")} />
        </Field>
      </Section>

      <Section title="Assignment" variant={variant}>
        <Field label="Knight (name)">
          <input
            className="input"
            list="knight-list"
            {...register("knight_name")}
            placeholder="Type or pick — also accepts We fast / Uber / self"
          />
          <datalist id="knight-list">
            {knights.map((k) => (
              <option key={k.id} value={k.display_name} />
            ))}
          </datalist>
        </Field>
        <Field label="Status">
          <select className="select" {...register("assignment_status")}>
            <option value="assigned">Assigned</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Delivery status (shown to customer)">
          <select className="select" {...register("fulfillment_status")}>
            <option value="placed">Placed</option>
            <option value="picked_up">Picked up</option>
            <option value="in_transit">In transit</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Working hours">
          <input className="input" {...register("working_hours")} placeholder="e.g. 1:34" />
        </Field>
      </Section>

      <Section title="Money & payment" variant={variant}>
        <Field label="Fees (₹)">
          <input type="number" step="0.01" className="input" {...register("fees")} />
          {suggestedFee != null && (
            <button
              type="button"
              className="text-xs text-[var(--brand)] mt-1 hover:underline"
              onClick={() => setValue("fees", suggestedFee)}
            >
              Suggested by km: {money(suggestedFee)} — apply
            </button>
          )}
        </Field>
        <Field label="Kms">
          <input type="number" step="0.1" className="input" {...register("kms")} />
        </Field>
        <Field label="Payment status">
          <select className="select" {...register("payment_status")}>
            <option value="">—</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="free">Free</option>
          </select>
        </Field>
        <Field label="Payment mode">
          <input className="input" {...register("payment_mode")} placeholder="cash / upi / monthly billing" />
        </Field>
        <Field label="Final bill amount (₹)">
          <input type="number" step="0.01" className="input" {...register("final_bill_amount")} />
        </Field>
        <Field label="Payment received date">
          <input type="date" className="input" {...register("payment_received_date")} />
        </Field>
        <Field label="COD / fee collection / remark" wide>
          <input className="input" {...register("cod_remark")} />
        </Field>
        <Field label="Cab & auto fare" wide>
          <input className="input" {...register("cab_auto_fare")} />
        </Field>
      </Section>

      <Section title="Billing" variant={variant}>
        <Field label="Billing name">
          <input
            className="input"
            list="client-list"
            {...register("billing_name")}
            onBlur={(e) => applyClient(e.target.value)}
            placeholder="Pick a client to auto-fill GST & address"
          />
          <datalist id="client-list">
            {clients.map((c) => (
              <option key={c.id} value={c.client_name}>
                {c.company_name ?? ""}
              </option>
            ))}
          </datalist>
        </Field>
        <Field label="GST no.">
          <input className="input" {...register("gst_no")} />
        </Field>
        <Field label="Billing address" wide>
          <textarea className="textarea" rows={2} {...register("billing_address")} />
        </Field>
        <Field label="Invoice no.">
          <input className="input" {...register("invoice_no")} />
        </Field>
        <Field label="Invoice date">
          <input type="date" className="input" {...register("invoice_date")} />
        </Field>
      </Section>

      <Section title="Notes" variant={variant}>
        <Field label="Content / parcel" wide>
          <input className="input" {...register("content")} />
        </Field>
        <Field label="Remark" wide>
          <textarea className="textarea" rows={2} {...register("remark")} />
        </Field>
        <Field label="Needs review">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("needs_review")} />
            Flag this record for review
          </label>
        </Field>
      </Section>

      {error && <p className="text-sm text-[#b42318]">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : mode === "new" ? "Create delivery" : "Save changes"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel ?? (() => router.back())}>
          Cancel
        </button>
      </div>
    </form>
  );
}
