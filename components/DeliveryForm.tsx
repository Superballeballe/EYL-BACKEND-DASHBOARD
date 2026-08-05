"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { calcWorkingHours, isWithinWorkingHours, money, toDatetimeLocalValue, workDayEndInput, workDayStartInput, workingHoursError } from "@/lib/format";
import { formatSerialCode } from "@/lib/serial";
import { formatInvoiceNo } from "@/lib/invoice";
import LocationPicker from "@/components/LocationPicker";

type KnightOpt = { id: string; display_name: string };
type ClientOpt = {
  id: string;
  client_name: string;
  company_name: string | null;
  gst_no: string | null;
  address: string | null;
};
type RateTier = { min_km: number | null; max_km: number | null; fee: number | null };

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const WIZARD_STEP_FIELDS: string[][] = [
  ["task_date", "booking_date", "mode_of_booking", "serial_no"],
  [
    "sender_name",
    "pickup_location",
    "pickup_time_window",
    "pickup_actual_time",
    "drop_location",
    "drop_time_window",
    "drop_actual_time",
    "drop_recipient_name",
    "recipient_phone",
  ],
  ["knight_name", "fulfillment_status", "working_hours"],
  ["fees", "kms", "payment_status", "payment_mode", "final_bill_amount"],
];

function Field({
  label,
  children,
  wide,
  required,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  required?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label">
        {label}
        {required ? <span className="text-[#b42318]"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[#b42318]">{message}</p>;
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
        className={`text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)] ${
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

export type DeliveryFormHandle = {
  validateStep: (step: number) => Promise<boolean>;
  validateAllSteps: () => Promise<{ ok: boolean; firstInvalidStep: number | null }>;
};

const DeliveryForm = forwardRef<DeliveryFormHandle, {
  mode: "new" | "edit";
  id?: string;
  initial?: Record<string, any> | null;
  knights: KnightOpt[];
  clients: ClientOpt[];
  rateTiers: RateTier[];
  onSaved?: (delivery: Record<string, any>) => void;
  onCancel?: () => void;
  variant?: "page" | "modal";
  wizardStep?: number;
  hideActions?: boolean;
  formId?: string;
}>(function DeliveryForm(
{
  mode,
  id,
  initial,
  knights,
  clients,
  rateTiers,
  onSaved,
  onCancel,
  variant = "page",
  wizardStep,
  hideActions = false,
  formId,
},
ref,
) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }, []);

  const initialTaskDate =
    (initial?.task_date as string | undefined)?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? today;

  const { register, handleSubmit, watch, setValue, control, trigger, formState: { errors } } = useForm<Record<string, any>>({
    shouldUnregister: false,
    defaultValues: {
      task_date: today,
      booking_date: today,
      mode_of_booking: "b2b",
      assignment_status: "assigned",
      fulfillment_status: "booked",
      ...(initial ?? {}),
      pickup_time_window: toDatetimeLocalValue(
        initial?.pickup_time_window as string | undefined,
        initialTaskDate,
      ),
      pickup_actual_time: toDatetimeLocalValue(
        initial?.pickup_actual_time as string | undefined,
        initialTaskDate,
      ),
      drop_time_window: toDatetimeLocalValue(
        initial?.drop_time_window as string | undefined,
        initialTaskDate,
      ),
      drop_actual_time: toDatetimeLocalValue(
        initial?.drop_actual_time as string | undefined,
        initialTaskDate,
      ),
      recipient_phone:
        (initial?.recipient_phone as string | undefined) ??
        (typeof initial?.raw === "object" && initial?.raw && "recipient_phone" in initial.raw
          ? String((initial.raw as { recipient_phone?: string }).recipient_phone ?? "")
          : ""),
    },
  });

  useImperativeHandle(ref, () => ({
    validateStep: async (step: number) => {
      const fields = WIZARD_STEP_FIELDS[step];
      return fields ? trigger(fields) : true;
    },
    validateAllSteps: async () => {
      for (let s = 0; s < WIZARD_STEP_FIELDS.length; s++) {
        if (!(await trigger(WIZARD_STEP_FIELDS[s]))) {
          return { ok: false, firstInvalidStep: s };
        }
      }
      return { ok: true, firstInvalidStep: null };
    },
  }));

  const bookingMode = watch("mode_of_booking") as "online" | "b2b" | "" | undefined;
  const serialNo = watch("serial_no");
  const invoiceNo = watch("invoice_no");
  const taskDate = watch("task_date") as string | undefined;
  const scheduleMin = taskDate?.match(/^\d{4}-\d{2}-\d{2}$/) ? workDayStartInput(taskDate) : undefined;
  const scheduleMax = taskDate?.match(/^\d{4}-\d{2}-\d{2}$/) ? workDayEndInput(taskDate) : undefined;
  const withinWorkingHours = (v: unknown) =>
    isWithinWorkingHours(String(v ?? "")) || workingHoursError();

  const serialLabel = useMemo(() => {
    const n = serialNo != null && serialNo !== "" ? Number(serialNo) : null;
    if (n == null || !Number.isFinite(n)) return "—";
    return formatSerialCode(bookingMode === "online" ? "online" : "b2b", n, null);
  }, [bookingMode, serialNo]);

  const editSerialCode = useMemo(() => {
    if (mode !== "edit" || initial?.serial_no == null) return null;
    return formatSerialCode(
      initial.mode_of_booking,
      initial.serial_no,
      initial.app_order_id,
    );
  }, [mode, initial]);

  useEffect(() => {
    if (mode !== "new") return;
    let cancelled = false;
    fetch("/api/deliveries/next-invoice")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.invoice_no) return;
        setValue("invoice_no", d.invoice_no);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, setValue]);

  useEffect(() => {
    if (mode !== "new") return;
    const m = bookingMode === "online" ? "online" : "b2b";
    let cancelled = false;
    fetch(`/api/deliveries/next-serial?mode=${m}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || d?.serial_no == null) return;
        setValue("serial_no", d.serial_no);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, bookingMode, setValue]);

  const pickupActual = watch("pickup_actual_time");
  const dropActual = watch("drop_actual_time");
  const fulfillmentStatus = watch("fulfillment_status");

  const workingHoursLabel = useMemo(
    () => calcWorkingHours(pickupActual, dropActual) ?? "—",
    [pickupActual, dropActual],
  );

  useEffect(() => {
    setValue("assignment_status", fulfillmentStatus === "cancelled" ? "cancelled" : "assigned");
  }, [fulfillmentStatus, setValue]);

  useEffect(() => {
    const hours = calcWorkingHours(pickupActual, dropActual);
    setValue("working_hours", hours ?? "");
  }, [pickupActual, dropActual, setValue]);

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

  const show = (step: number) => wizardStep === undefined || wizardStep === step;

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(onSubmit)}
      className={variant === "modal" ? "space-y-4" : "space-y-5"}
    >
      {show(0) ? (
      <Section title="Booking" variant={variant}>
        <Field label="Task date" required>
          <input
            type="date"
            className="input"
            {...register("task_date", { required: "Task date is required" })}
          />
          {errors.task_date ? (
            <p className="mt-1 text-xs text-[#b42318]">{String(errors.task_date.message)}</p>
          ) : null}
        </Field>
        <Field label="Booking date" required>
          <input
            type="date"
            className="input"
            {...register("booking_date", { required: "Booking date is required" })}
          />
          {errors.booking_date ? (
            <p className="mt-1 text-xs text-[#b42318]">{String(errors.booking_date.message)}</p>
          ) : null}
        </Field>
        <Field label="Mode of booking" required>
          <select
            className="select"
            {...register("mode_of_booking", { required: "Mode of booking is required" })}
          >
            <option value="b2b">Manual</option>
            <option value="online">Online</option>
          </select>
          {errors.mode_of_booking ? (
            <p className="mt-1 text-xs text-[#b42318]">{String(errors.mode_of_booking.message)}</p>
          ) : null}
        </Field>
        <Field label="Serial no." required>
          {mode === "edit" ? (
            <div
              className="input flex items-center bg-[var(--surface-muted)] font-semibold tracking-wide"
              aria-readonly
            >
              {editSerialCode ?? "—"}
            </div>
          ) : (
            <>
              <input
                type="hidden"
                {...register("serial_no", {
                  required: "Serial number is required",
                  validate: (v) => (Number(v) > 0 ? true : "Serial number is required"),
                })}
              />
              <div
                className="input flex items-center bg-[var(--surface-muted)] font-semibold tracking-wide"
                aria-readonly
              >
                {serialLabel}
              </div>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Auto-assigned · {bookingMode === "online" ? "APPEYL" : "MANEYL"}
              </p>
              {errors.serial_no ? (
                <p className="mt-1 text-xs text-[#b42318]">{String(errors.serial_no.message)}</p>
              ) : null}
            </>
          )}
        </Field>
      </Section>
      ) : null}

      {show(1) ? (
      <>
      <Section title="Sender" variant={variant}>
        <Field label="Name" required>
          <input
            className="input"
            {...register("sender_name", { required: "Sender name is required" })}
            placeholder="Business / person sending"
          />
          <FieldError message={errors.sender_name?.message as string | undefined} />
        </Field>
        <Field label="Last name / booked by">
          <input className="input" {...register("sender_last_name")} />
        </Field>
      </Section>

      <Section title="Pickup" variant={variant}>
        <Field label="Pickup location" wide required>
          <Controller
            name="pickup_location"
            control={control}
            rules={{ required: "Pickup location is required" }}
            render={({ field }) => (
              <LocationPicker
                value={field.value ?? ""}
                lat={watch("pickup_lat")}
                lng={watch("pickup_lng")}
                onChange={(address, coords) => {
                  field.onChange(address);
                  setValue("pickup_lat", coords?.lat ?? null);
                  setValue("pickup_lng", coords?.lng ?? null);
                }}
                placeholder="Search pickup address"
              />
            )}
          />
          <FieldError message={errors.pickup_location?.message as string | undefined} />
        </Field>
        <Field label="Pickup scheduled" required>
          <input
            type="datetime-local"
            className="input"
            min={scheduleMin}
            max={scheduleMax}
            {...register("pickup_time_window", {
              required: "Pickup time is required",
              validate: withinWorkingHours,
            })}
          />
          <FieldError message={errors.pickup_time_window?.message as string | undefined} />
        </Field>
        <Field label="Pickup actual" required>
          <input
            type="datetime-local"
            className="input"
            min={scheduleMin}
            max={scheduleMax}
            {...register("pickup_actual_time", {
              required: "Pickup actual time is required",
              validate: withinWorkingHours,
            })}
          />
          <FieldError message={errors.pickup_actual_time?.message as string | undefined} />
        </Field>
      </Section>

      <Section title="Drop" variant={variant}>
        <Field label="Drop location" wide required>
          <Controller
            name="drop_location"
            control={control}
            rules={{ required: "Drop location is required" }}
            render={({ field }) => (
              <LocationPicker
                value={field.value ?? ""}
                lat={watch("drop_lat")}
                lng={watch("drop_lng")}
                onChange={(address, coords) => {
                  field.onChange(address);
                  setValue("drop_lat", coords?.lat ?? null);
                  setValue("drop_lng", coords?.lng ?? null);
                }}
                placeholder="Search drop address"
              />
            )}
          />
          <FieldError message={errors.drop_location?.message as string | undefined} />
        </Field>
        <Field label="Recipient name" required>
          <input
            className="input"
            {...register("drop_recipient_name", { required: "Recipient name is required" })}
          />
          <FieldError message={errors.drop_recipient_name?.message as string | undefined} />
        </Field>
        <Field label="Phone number" required>
          <input
            type="tel"
            className="input"
            {...register("recipient_phone", {
              required: "Phone number is required",
              validate: (v) =>
                String(v ?? "").replace(/\D/g, "").length >= 10
                  ? true
                  : "Enter a valid 10-digit phone number",
            })}
            placeholder="e.g. 9876543210"
          />
          <FieldError message={errors.recipient_phone?.message as string | undefined} />
        </Field>
        <Field label="Drop scheduled" required>
          <input
            type="datetime-local"
            className="input"
            min={scheduleMin}
            max={scheduleMax}
            {...register("drop_time_window", {
              required: "Drop time is required",
              validate: withinWorkingHours,
            })}
          />
          <FieldError message={errors.drop_time_window?.message as string | undefined} />
        </Field>
        <Field label="Drop actual" required>
          <input
            type="datetime-local"
            className="input"
            min={scheduleMin}
            max={scheduleMax}
            {...register("drop_actual_time", {
              required: "Drop actual time is required",
              validate: withinWorkingHours,
            })}
          />
          <FieldError message={errors.drop_actual_time?.message as string | undefined} />
        </Field>
      </Section>
      </>
      ) : null}

      {show(2) ? (
      <Section title="Assignment" variant={variant}>
        <Field label="Knight (name)" required={fulfillmentStatus !== "cancelled"}>
          <input
            className="input"
            list="knight-list"
            {...register("knight_name", {
              validate: (v) => {
                if (fulfillmentStatus === "cancelled") return true;
                return String(v ?? "").trim() ? true : "Knight is required";
              },
            })}
            placeholder="Type or pick — also accepts We fast / Uber / self"
          />
          <FieldError message={errors.knight_name?.message as string | undefined} />
          <datalist id="knight-list">
            {knights.map((k) => (
              <option key={k.id} value={k.display_name} />
            ))}
          </datalist>
        </Field>
        <Field label="Status" required>
          <select
            className="select"
            {...register("fulfillment_status", { required: "Status is required" })}
          >
            <option value="booked">Booked</option>
            <option value="accepted">Accepted</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input type="hidden" {...register("assignment_status")} />
          <FieldError message={errors.fulfillment_status?.message as string | undefined} />
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Same status in dashboard and customer app
          </p>
        </Field>
        <Field label="Working hours" required>
          <input
            type="hidden"
            {...register("working_hours", {
              validate: () =>
                workingHoursLabel !== "—" ? true : "Enter pickup & drop actual times on Route step",
            })}
          />
          <div
            className="input flex items-center bg-[var(--surface-muted)] font-semibold"
            aria-readonly
          >
            {workingHoursLabel}
          </div>
          <FieldError message={errors.working_hours?.message as string | undefined} />
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Auto from pickup &amp; drop actual times (Route step)
          </p>
        </Field>
      </Section>
      ) : null}

      {show(3) ? (
      <Section title="Money & payment" variant={variant}>
        <Field label="Fees (₹)" required>
          <input
            type="number"
            step="0.01"
            className="input"
            {...register("fees", {
              validate: (v) => (toNumOrNull(v) != null ? true : "Fees is required"),
            })}
          />
          {suggestedFee != null && (
            <button
              type="button"
              className="text-xs text-[var(--brand)] mt-1 hover:underline"
              onClick={() => setValue("fees", suggestedFee)}
            >
              Suggested by km: {money(suggestedFee)} — apply
            </button>
          )}
          <FieldError message={errors.fees?.message as string | undefined} />
        </Field>
        <Field label="Kms" required>
          <input
            type="number"
            step="0.1"
            className="input"
            {...register("kms", {
              validate: (v) => (toNumOrNull(v) != null ? true : "Kms is required"),
            })}
          />
          <FieldError message={errors.kms?.message as string | undefined} />
        </Field>
        <Field label="Payment status" required>
          <select
            className="select"
            {...register("payment_status", {
              validate: (v) =>
                String(v ?? "").trim() ? true : "Payment status is required",
            })}
          >
            <option value="">—</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="free">Free</option>
          </select>
          <FieldError message={errors.payment_status?.message as string | undefined} />
        </Field>
        <Field label="Payment mode" required>
          <input
            className="input"
            {...register("payment_mode", { required: "Payment mode is required" })}
            placeholder="cash / upi / monthly billing"
          />
          <FieldError message={errors.payment_mode?.message as string | undefined} />
        </Field>
        <Field label="Final bill amount (₹)" required>
          <input
            type="number"
            step="0.01"
            className="input"
            {...register("final_bill_amount", {
              validate: (v) =>
                toNumOrNull(v) != null ? true : "Final bill amount is required",
            })}
          />
          <FieldError message={errors.final_bill_amount?.message as string | undefined} />
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
      ) : null}

      {show(4) ? (
      <>
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
        <Field label="GST no. (optional)">
          <input className="input" {...register("gst_no")} placeholder="Leave blank if not applicable" />
        </Field>
        <Field label="Billing address" wide>
          <textarea className="textarea" rows={2} {...register("billing_address")} />
        </Field>
        <Field label="Invoice no.">
          {mode === "edit" ? (
            <div
              className="input flex items-center bg-[var(--surface-muted)] font-semibold tracking-wide"
              aria-readonly
            >
              {invoiceNo?.trim() ? invoiceNo : "—"}
            </div>
          ) : (
            <>
              <input type="hidden" {...register("invoice_no")} />
              <div
                className="input flex items-center bg-[var(--surface-muted)] font-semibold tracking-wide"
                aria-readonly
              >
                {invoiceNo?.trim() ? invoiceNo : formatInvoiceNo(null)}
              </div>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">Auto-assigned · EYLINV</p>
            </>
          )}
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
      </Section>
      </>
      ) : null}

      {error && <p className="text-sm text-[#b42318]">{error}</p>}

      {!hideActions ? (
      <div className="flex gap-3">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : mode === "new" ? "Create delivery" : "Save changes"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel ?? (() => router.back())}>
          Cancel
        </button>
      </div>
      ) : null}
    </form>
  );
});

export default DeliveryForm;
