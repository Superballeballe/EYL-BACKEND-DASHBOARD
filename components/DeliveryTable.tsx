"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Check, Copy, Share2, X } from "lucide-react";
import DeliveryForm from "@/components/DeliveryForm";
import DeliveryLifecycleActions, { type LifecycleResult } from "@/components/DeliveryLifecycleActions";
import { FulfillmentBadge, PaymentBadge } from "@/components/ui";
import { areaLabel, fmtDate, fmtDatetimeLocal, fmtShortDate, formatBookingMode, money, routeAreaLabel } from "@/lib/format";
import { formatSerialCode, serialPrefix } from "@/lib/serial";
import { tableShellSx } from "@/lib/surface";
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
  isAdmin = false,
}: {
  rows: Delivery[];
  knights: KnightOpt[];
  clients: ClientOpt[];
  rateTiers: RateTierOpt[];
  isAdmin?: boolean;
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

  function removeDelivery(id: string) {
    setVisibleRows((current) => current.filter((row) => row.id !== id));
    setSelectedDelivery(null);
  }

  return (
    <>
      <TableContainer sx={{ ...tableShellSx, overflowX: "auto" }}>
        <Table size="small" stickyHeader sx={{ minWidth: 1100 }}>
          <TableHead>
            <TableRow>
              <TableCell>Order ID</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Delivery</TableCell>
              <TableCell sx={{ minWidth: 180 }}>Pickup</TableCell>
              <TableCell sx={{ minWidth: 180 }}>Drop</TableCell>
              <TableCell>Knight</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Fees</TableCell>
              <TableCell>Payment</TableCell>
              <TableCell>Kms</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((delivery) => (
              <TableRow
                key={delivery.id}
                hover
                tabIndex={0}
                role="button"
                sx={{ cursor: "pointer", "&:focus-visible": { bgcolor: "#eff6ff" } }}
                aria-label={`Preview delivery for ${delivery.sender_name ?? "unknown sender"}`}
                onClick={() => openDelivery(delivery)}
                onKeyDown={(event) => openFromKeyboard(event, delivery)}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {formatSerialCode(
                      delivery.mode_of_booking,
                      delivery.serial_no,
                      delivery.app_order_id,
                    )}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {serialPrefix(delivery.mode_of_booking, delivery.app_order_id) === "APPEYL"
                      ? "App"
                      : "Manual"}
                  </Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {fmtShortDate(delivery.task_date)}
                  </Typography>
                  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mt: 0.5 }}>
                    {delivery.needs_review ? (
                      <Chip size="small" color="warning" variant="outlined" label="Review" />
                    ) : null}
                    {delivery.assignment_status === "cancelled" ? (
                      <Chip size="small" color="error" variant="outlined" label="Cancelled" />
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {delivery.sender_name ?? "—"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {delivery.drop_recipient_name
                      ? `→ ${delivery.drop_recipient_name}`
                      : delivery.content ?? ""}
                  </Typography>
                </TableCell>
                <TableCell>
                  <LocationSummary
                    location={delivery.pickup_location}
                    time={joinText(delivery.pickup_time_window, delivery.pickup_actual_time)}
                  />
                </TableCell>
                <TableCell>
                  <LocationSummary
                    location={delivery.drop_location}
                    time={joinText(delivery.drop_time_window, delivery.drop_actual_time)}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{delivery.knight_name ?? "—"}</Typography>
                </TableCell>
                <TableCell>
                  <FulfillmentBadge status={delivery.fulfillment_status} />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {money(delivery.fees)}
                </TableCell>
                <TableCell>
                  <PaymentBadge status={delivery.payment_status} mode={delivery.payment_mode} />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {delivery.kms != null ? `${delivery.kms} km` : "—"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {selectedDelivery ? (
        <DeliveryPreviewModal
          delivery={selectedDelivery}
          knights={knights}
          clients={clients}
          rateTiers={rateTiers}
          isAdmin={isAdmin}
          onClose={() => setSelectedDelivery(null)}
          onSaved={updateDelivery}
          onDeleted={removeDelivery}
        />
      ) : null}
    </>
  );
}

function orderMeta(delivery: Delivery) {
  const orderId = formatSerialCode(
    delivery.mode_of_booking,
    delivery.serial_no,
    delivery.app_order_id,
  );
  const source = serialPrefix(delivery.mode_of_booking, delivery.app_order_id) === "APPEYL" ? "App" : "Manual";
  return { orderId, source };
}

function previewLifecycleVariant(
  status: string | null | undefined,
): "pending" | "running" | null {
  if (status === "booked") return "pending";
  if (status === "accepted" || status === "active") return "running";
  return null;
}

function DeliveryPreviewModal({
  delivery,
  knights,
  clients,
  rateTiers,
  isAdmin,
  onClose,
  onSaved,
  onDeleted,
}: {
  delivery: Delivery;
  knights: KnightOpt[];
  clients: ClientOpt[];
  rateTiers: RateTierOpt[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (delivery: Delivery) => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { orderId, source } = orderMeta(delivery);

  useEffect(() => {
    setMode("preview");
    setDeleteOpen(false);
    setDeleteError(null);
  }, [delivery.id]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !deleteOpen) onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, deleteOpen]);

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

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error || "Could not delete order");
        return;
      }
      setDeleteOpen(false);
      onDeleted(delivery.id);
      router.refresh();
    } catch {
      setDeleteError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
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
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                <Chip size="small" color="primary" variant="outlined" label={orderId} />
                <Chip size="small" variant="outlined" label={source} />
                <FulfillmentBadge status={delivery.fulfillment_status} />
                {delivery.needs_review ? (
                  <Chip size="small" color="warning" variant="outlined" label="Review" />
                ) : null}
              </Stack>
              <h2 id="delivery-preview-title" className="mt-2 truncate text-xl font-bold">
                {delivery.sender_name ?? "Delivery"}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {fmtDate(delivery.task_date)}
                {delivery.knight_name ? ` · ${delivery.knight_name}` : ""}
                {delivery.drop_recipient_name ? ` · → ${delivery.drop_recipient_name}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {mode === "preview" ? (
                <button type="button" className="btn btn-primary" onClick={() => setMode("edit")}>
                  Edit
                </button>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={() => setMode("preview")}>
                  Back
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary flex h-10 w-10 items-center justify-center p-0"
                onClick={onClose}
                aria-label="Close"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto p-5">
            {mode === "preview" ? (
              <DeliveryPreview
                delivery={delivery}
                knights={knights}
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

          {mode === "preview" ? (
            <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
              {isAdmin ? (
                <button
                  type="button"
                  className="btn btn-secondary text-red-600 hover:border-red-200 hover:bg-red-50"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete order
                </button>
              ) : (
                <span />
              )}
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete order?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`${orderId} (${delivery.sender_name ?? "delivery"}) will be permanently removed. This cannot be undone.`}
          </DialogContentText>
          {deleteError ? (
            <Typography variant="body2" color="error" sx={{ mt: 2 }}>
              {deleteError}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={deleting}
            onClick={() => setDeleteOpen(false)}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-primary bg-red-600 hover:bg-red-700" disabled={deleting} onClick={handleDelete}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function DeliveryPreview({
  delivery,
  knights,
  onLifecycleUpdated,
}: {
  delivery: Delivery;
  knights: KnightOpt[];
  onLifecycleUpdated: (result: LifecycleResult) => void;
}) {
  const { orderId, source } = orderMeta(delivery);
  const actionVariant = previewLifecycleVariant(delivery.fulfillment_status);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
      <section aria-label="Route">
        <div className="mb-4 rounded-lg bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[var(--text)]">
          {routeAreaLabel(delivery.pickup_location, delivery.drop_location)}
        </div>
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
        {actionVariant ? (
          <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="text-sm font-bold">Actions</div>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5, mb: 2 }}>
              {actionVariant === "pending"
                ? "Assign a knight to start this delivery."
                : delivery.fulfillment_status === "active"
                  ? "Mark done when delivered, or edit details."
                  : "Mark pickup when collected, or edit details."}
            </Typography>
            <DeliveryLifecycleActions
              delivery={delivery}
              knights={knights}
              variant={actionVariant}
              onUpdated={onLifecycleUpdated}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <InfoTile label="Order ID" value={orderId} />
          <InfoTile label="Source" value={source} />
          <InfoTile label="Sender" value={delivery.sender_name} />
          <InfoTile label="Knight" value={delivery.knight_name} />
          <InfoTile label="Fees" value={money(delivery.fees)} />
          <InfoTile label="Payment" value={<PaymentBadge status={delivery.payment_status} mode={delivery.payment_mode} />} />
          <InfoTile label="Kms" value={delivery.kms == null ? "—" : `${delivery.kms} km`} />
          <InfoTile label="Mode" value={formatBookingMode(delivery.mode_of_booking)} />
          <InfoTile label="Invoice" value={delivery.invoice_no} />
          <InfoTile label="Billing" value={delivery.billing_name} />
        </div>
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
    <Box sx={{ minWidth: 0, maxWidth: 220 }}>
      <Typography
        variant="caption"
        sx={{ display: "block", lineHeight: 1.35 }}
        title={location ?? undefined}
        noWrap
      >
        {location ?? "—"}
      </Typography>
      {time ? (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }} noWrap>
          {time}
        </Typography>
      ) : null}
    </Box>
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
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">{title}</div>
        <AddressActions address={location} label={title} />
      </div>
      <div className="mt-2">
        <div className="text-sm font-semibold">{areaLabel(location)}</div>
        <div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted-foreground)]">
          {location ?? "—"}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
        {person ? <span className="badge badge-gray">To {person}</span> : null}
        {timeWindow ? <span className="badge badge-blue">Scheduled {fmtDatetimeLocal(timeWindow)}</span> : null}
        {actualTime ? <span className="badge badge-green">Actual {fmtDatetimeLocal(actualTime)}</span> : null}
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
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--muted-foreground)] transition-colors hover:bg-[#f0f2f5] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
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
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--muted-foreground)] transition-colors hover:bg-[#f0f2f5] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
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
      <div className="text-[0.68rem] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-1 break-words text-sm">{displayValue}</div>
    </div>
  );
}

function joinText(...values: Array<string | null | undefined>) {
  return values
    .map((v) => fmtDatetimeLocal(v))
    .filter((v) => v && v !== "—")
    .join(" / ");
}
