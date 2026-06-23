"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Share2 } from "lucide-react";
import DeliveryForm from "@/components/DeliveryForm";
import DeliveryLifecycleActions, { type LifecycleResult } from "@/components/DeliveryLifecycleActions";
import { FulfillmentBadge, PaymentBadge } from "@/components/ui";
import { fmtDate, fmtShortDate, money } from "@/lib/format";
import type { Delivery } from "@/lib/types";

type KnightOpt = { id: string; display_name: string };
type ClientOpt = {
  id: string;
  client_name: string;
  company_name: string | null;
  gst_no: string | null;
  address: string | null;
};
type RateTierOpt = { min_km: number | null; max_km: number | null; fee: number | null };

export default function DeliveryTable({
  rows,
  knights,
  clients,
  rateTiers,
}: {
  rows: Delivery[];
  knights: KnightOpt[];
  clients: ClientOpt[];
  rateTiers: RateTierOpt[];
}) {
  const [visibleRows, setVisibleRows] = useState(rows);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  useEffect(() => {
    setVisibleRows(rows);
  }, [rows]);

  function openDelivery(delivery: Delivery) {
    setSelectedDelivery(delivery);
  }

  function openFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, delivery: Delivery) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openDelivery(delivery);
  }

  function updateDelivery(updated: Delivery) {
    setVisibleRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    setSelectedDelivery(updated);
  }

  return (
    <>
      <div className="card overflow-x-auto">
        <table className="data table-fixed min-w-[118rem]">
          <colgroup>
            <col className="w-[8rem]" />
            <col className="w-[14rem]" />
            <col className="w-[24rem]" />
            <col className="w-[24rem]" />
            <col className="w-[9rem]" />
            <col className="w-[9rem]" />
            <col className="w-[9rem]" />
            <col className="w-[7rem]" />
            <col className="w-[8rem]" />
            <col className="w-[6rem]" />
          </colgroup>
          <thead>
            <tr>
              <th>Date</th>
              <th>Delivery</th>
              <th>Pickup</th>
              <th>Drop</th>
              <th>Knight</th>
              <th>Status</th>
              <th>App status</th>
              <th>Fees</th>
              <th>Payment</th>
              <th>Kms</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((delivery) => (
              <tr
                key={delivery.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer outline-none transition-colors focus-visible:[&>td]:bg-[#eef4ff]"
                aria-label={`Preview delivery for ${delivery.sender_name ?? "unknown sender"}`}
                onClick={() => openDelivery(delivery)}
                onKeyDown={(event) => openFromKeyboard(event, delivery)}
              >
                <td className="whitespace-nowrap">
                  <div className="font-medium">{fmtShortDate(delivery.task_date)}</div>
                  {delivery.needs_review && <span className="badge badge-amber mt-1">review</span>}
                  {delivery.assignment_status === "cancelled" && (
                    <span className="badge badge-red mt-1">cancelled</span>
                  )}
                </td>
                <td>
                  <div className="font-semibold">{delivery.sender_name ?? "—"}</div>
                  <div className="mt-1 text-xs text-[var(--muted)] clamp-2">
                    {delivery.drop_recipient_name ? `to ${delivery.drop_recipient_name}` : delivery.content ?? "—"}
                  </div>
                  {delivery.content && delivery.drop_recipient_name ? (
                    <div className="mt-1 text-xs text-[var(--muted)] clamp-1">{delivery.content}</div>
                  ) : null}
                </td>
                <td>
                  <LocationSummary
                    location={delivery.pickup_location}
                    time={joinText(delivery.pickup_time_window, delivery.pickup_actual_time)}
                  />
                </td>
                <td>
                  <LocationSummary
                    location={delivery.drop_location}
                    time={joinText(delivery.drop_time_window, delivery.drop_actual_time)}
                  />
                </td>
                <td>
                  <div className="font-medium">{delivery.knight_name ?? "—"}</div>
                </td>
                <td>
                  <FulfillmentBadge status={delivery.fulfillment_status} />
                </td>
                <td className="text-xs text-[var(--muted)]">
                  {delivery.app_order?.status ? delivery.app_order.status.replace(/_/g, " ") : "—"}
                </td>
                <td className="font-semibold whitespace-nowrap">{money(delivery.fees)}</td>
                <td>
                  <PaymentBadge status={delivery.payment_status} />
                </td>
                <td className="whitespace-nowrap text-xs text-[var(--muted)]">
                  {delivery.kms != null ? `${delivery.kms} km` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedDelivery ? (
        <DeliveryPreviewModal
          delivery={selectedDelivery}
          knights={knights}
          clients={clients}
          rateTiers={rateTiers}
          onClose={() => setSelectedDelivery(null)}
          onSaved={updateDelivery}
        />
      ) : null}
    </>
  );
}

function DeliveryPreviewModal({
  delivery,
  knights,
  clients,
  rateTiers,
  onClose,
  onSaved,
}: {
  delivery: Delivery;
  knights: KnightOpt[];
  clients: ClientOpt[];
  rateTiers: RateTierOpt[];
  onClose: () => void;
  onSaved: (delivery: Delivery) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"preview" | "edit">("preview");

  useEffect(() => {
    setMode("preview");
  }, [delivery.id]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleSaved(updated: Record<string, any>) {
    onSaved({ ...delivery, ...updated, app_order: delivery.app_order } as Delivery);
    setMode("preview");
  }

  function handleLifecycleUpdated(result: LifecycleResult) {
    const next = { ...delivery, ...((result.delivery ?? {}) as Partial<Delivery>) } as Delivery;
    if ("app_order" in result) {
      next.app_order = result.app_order
        ? ({ ...(delivery.app_order ?? {}), ...result.app_order } as NonNullable<Delivery["app_order"]>)
        : null;
    }
    onSaved(next);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              {fmtDate(delivery.task_date)}
            </div>
            <h2 id="delivery-preview-title" className="mt-1 truncate text-xl font-bold">
              {delivery.sender_name ?? "Delivery"}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className={`btn ${mode === "preview" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setMode("preview")}
            >
              Preview
            </button>
            <button
              type="button"
              className={`btn ${mode === "edit" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setMode("edit")}
            >
              Edit
            </button>
            <button type="button" className="btn btn-secondary h-10 w-10 p-0" onClick={onClose}>
              x
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {mode === "preview" ? (
            <DeliveryPreview
              delivery={delivery}
              knights={knights}
              onEdit={() => setMode("edit")}
              onLifecycleUpdated={handleLifecycleUpdated}
            />
          ) : (
            <DeliveryForm
              mode="edit"
              id={delivery.id}
              initial={delivery}
              knights={knights}
              clients={clients}
              rateTiers={rateTiers}
              variant="modal"
              onSaved={handleSaved}
              onCancel={() => setMode("preview")}
            />
          )}
        </div>

        <div className="flex justify-end border-t border-[var(--border)] px-5 py-3">
          <button type="button" className="btn btn-secondary" onClick={() => router.refresh()}>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

function DeliveryPreview({
  delivery,
  knights,
  onEdit,
  onLifecycleUpdated,
}: {
  delivery: Delivery;
  knights: KnightOpt[];
  onEdit: () => void;
  onLifecycleUpdated: (result: LifecycleResult) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
      <section aria-label="Route">
        <div className="space-y-3">
          <RouteDetail
            title="Pickup"
            location={delivery.pickup_location}
            timeWindow={delivery.pickup_time_window}
            actualTime={delivery.pickup_actual_time}
          />
          <RouteDetail
            title="Drop"
            location={delivery.drop_location}
            timeWindow={delivery.drop_time_window}
            actualTime={delivery.drop_actual_time}
            person={delivery.drop_recipient_name}
          />
        </div>

        {(delivery.content || delivery.remark) && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoTile label="Content" value={delivery.content} />
            <InfoTile label="Remark" value={delivery.remark} />
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold">Delivery status</div>
              {delivery.app_order?.status ? (
                <div className="mt-1 text-xs text-[var(--muted)]">
                  App: {delivery.app_order.status.replace(/_/g, " ")}
                </div>
              ) : null}
            </div>
            <FulfillmentBadge status={delivery.fulfillment_status} />
          </div>
          <div className="mt-4">
            <DeliveryLifecycleActions delivery={delivery} knights={knights} onUpdated={onLifecycleUpdated} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoTile label="Sender" value={delivery.sender_name} />
          <InfoTile label="Knight" value={delivery.knight_name} />
          <InfoTile label="Fees" value={money(delivery.fees)} />
          <InfoTile label="Payment" value={<PaymentBadge status={delivery.payment_status} />} />
          <InfoTile label="Kms" value={delivery.kms == null ? "—" : `${delivery.kms} km`} />
          <InfoTile label="Mode" value={delivery.mode_of_booking} />
          <InfoTile label="Invoice" value={delivery.invoice_no} />
          <InfoTile label="Billing" value={delivery.billing_name} />
        </div>

        <button type="button" className="btn btn-primary w-full" onClick={onEdit}>
          Edit delivery
        </button>
      </aside>
    </div>
  );
}

function LocationSummary({
  location,
  time,
}: {
  location: string | null;
  time: string;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs leading-snug" title={location ?? undefined}>
        {location ?? "—"}
      </div>
      {time ? <div className="mt-1 truncate text-[0.7rem] text-[var(--muted)]">{time}</div> : null}
    </div>
  );
}

function RouteDetail({
  title,
  location,
  timeWindow,
  actualTime,
  person,
}: {
  title: string;
  location: string | null;
  timeWindow: string | null;
  actualTime: string | null;
  person?: string | null;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{title}</div>
        <AddressActions address={location} label={title} />
      </div>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{location ?? "—"}</div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
        {person ? <span className="badge badge-gray">To {person}</span> : null}
        {timeWindow ? <span className="badge badge-blue">Window {timeWindow}</span> : null}
        {actualTime ? <span className="badge badge-green">Actual {actualTime}</span> : null}
      </div>
    </div>
  );
}

function AddressActions({ address, label }: { address: string | null; label: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const disabled = !address;

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function shareAddress() {
    if (!address || !navigator.share) return;
    await navigator.share({
      title: `${label} address`,
      text: address,
    });
  }

  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--muted)] transition-colors hover:bg-[#f0f2f5] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={copyAddress}
        title={copied ? "Copied" : `Copy ${label.toLowerCase()} address`}
        aria-label={copied ? "Address copied" : `Copy ${label.toLowerCase()} address`}
      >
        {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
      </button>
      {canShare ? (
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--muted)] transition-colors hover:bg-[#f0f2f5] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={shareAddress}
          title={`Share ${label.toLowerCase()} address`}
          aria-label={`Share ${label.toLowerCase()} address`}
        >
          <Share2 aria-hidden="true" className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function InfoTile({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  const displayValue = value === null || value === undefined || value === "" ? "—" : value;

  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="text-[0.68rem] font-bold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 break-words text-sm">{displayValue}</div>
    </div>
  );
}

function joinText(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" / ");
}
