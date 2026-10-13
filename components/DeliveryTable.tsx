"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
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
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DeliveryForm, { submitDeliveryForm, type DeliveryFormHandle } from "@/components/DeliveryForm";
import { DeliveryStepItems, DialogRail, RailGroup, RailItem, RAIL_DIALOG_HEIGHT } from "@/components/DialogRail";
import DeliveryLifecycleActions, { type LifecycleResult } from "@/components/DeliveryLifecycleActions";
import DeliveryTaskBadges from "@/components/DeliveryTaskBadges";
import { FulfillmentBadge, PaymentBadge } from "@/components/ui";
import { getDeliveryInstructions, getDeliveryStops } from "@/lib/deliveryRouteDetails";
import { formatStopRouteSummary } from "@/lib/deliveryTaskBadges";
import { DIALOG_RADIUS, shadow, tableShellSx } from "@/lib/surface";
import { areaLabel, fmtDate, fmtDatetimeLocal, fmtShortDate, formatBookingMode, money, routeAreaLabel } from "@/lib/format";
import { formatDeliveryOrderId, serialPrefix } from "@/lib/serial";
import { deliverySchedule } from "@/lib/deliverySchedule";
import { effectiveFulfillmentStatus } from "@/lib/deliveryStatus";
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

/** The shared table shell, tuned for a wide index.
 *  Fixed layout: the address columns take whatever width is left and truncate, so it never scrolls sideways on a desktop. */
const indexTableSx = {
  minWidth: 1120,
  tableLayout: "fixed",
  "& .MuiTableCell-root": { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  "& .MuiTableCell-body": { height: 60, py: 1 },
  "& .pill-cell .MuiChip-root": {
    minWidth: 84,
    height: 26,
    borderRadius: "999px",
    fontSize: "0.8125rem",
    fontWeight: 500,
  },
} as const;

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
        <Table sx={indexTableSx}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 148 }}>Order</TableCell>
              <TableCell sx={{ width: 112 }}>Date</TableCell>
              <TableCell sx={{ width: "16%" }}>Sender</TableCell>
              <TableCell>Pickup</TableCell>
              <TableCell>Drop</TableCell>
              <TableCell sx={{ width: 116 }}>Knight</TableCell>
              <TableCell align="center" sx={{ width: 120 }}>
                Payment
              </TableCell>
              <TableCell align="center" sx={{ width: 124 }}>
                Status
              </TableCell>
              <TableCell align="right" sx={{ width: 104 }}>
                Fees
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((delivery) => {
              const schedule = deliverySchedule(delivery);
              return (
              <TableRow
                key={delivery.id}
                hover
                tabIndex={0}
                role="button"
                sx={{ cursor: "pointer", "&:focus-visible": { bgcolor: "action.selected" } }}
                aria-label={`Preview delivery for ${delivery.sender_name ?? "unknown sender"}`}
                onClick={() => openDelivery(delivery)}
                onKeyDown={(event) => openFromKeyboard(event, delivery)}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatDeliveryOrderId(delivery)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {serialPrefix(delivery.mode_of_booking, delivery.app_order_id) === "APPEYL"
                      ? "App"
                      : "Manual"}
                  </Typography>
                </TableCell>
                <TableCell>
                  {fmtShortDate(delivery.task_date)}
                  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                    {delivery.needs_review ? (
                      <Chip size="small" color="warning" variant="outlined" label="Review" />
                    ) : null}
                    {/* The Status column already says so once the delivery itself is cancelled. */}
                    {delivery.assignment_status === "cancelled" &&
                    effectiveFulfillmentStatus(delivery) !== "cancelled" ? (
                      <Chip size="small" color="error" variant="outlined" label="Cancelled" />
                    ) : null}
                    <DeliveryTaskBadges delivery={delivery} inline />
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap title={delivery.sender_name ?? undefined}>
                    {delivery.sender_name ?? "—"}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ color: "text.secondary", display: "block" }}>
                    {delivery.drop_recipient_name
                      ? `→ ${delivery.drop_recipient_name}`
                      : delivery.content ?? ""}
                  </Typography>
                </TableCell>
                <TableCell>
                  <LocationSummary
                    location={delivery.pickup_location}
                    time={joinText(schedule.pickup, delivery.pickup_actual_time)}
                  />
                </TableCell>
                <TableCell>
                  <LocationSummary
                    location={delivery.drop_location}
                    time={joinText(schedule.drop, delivery.drop_actual_time)}
                  />
                </TableCell>
                <TableCell title={delivery.knight_name ?? undefined}>{delivery.knight_name ?? "—"}</TableCell>
                <TableCell align="center" className="pill-cell">
                  <PaymentBadge status={delivery.payment_status} mode={delivery.payment_mode} />
                </TableCell>
                <TableCell align="center" className="pill-cell">
                  <FulfillmentBadge status={effectiveFulfillmentStatus(delivery)} />
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {money(delivery.fees)}
                  </Typography>
                  {delivery.kms != null ? (
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                      {delivery.kms} km
                    </Typography>
                  ) : null}
                </TableCell>
              </TableRow>
              );
            })}
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

const EDIT_FORM_ID = "edit-delivery-form";

function orderMeta(delivery: Delivery) {
  const orderId = formatDeliveryOrderId(delivery);
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

export function DeliveryPreviewModal({
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
  /** The rail's selection: the read-only overview, the next-step actions, or one section of the edit form. */
  const [selectedView, setView] = useState<"overview" | "actions" | number>("overview");
  const actionVariant = previewLifecycleVariant(delivery.fulfillment_status);
  // A finished or cancelled order has no next step; fall back rather than show an empty tab.
  const view = selectedView === "actions" && !actionVariant ? "overview" : selectedView;
  const formRef = useRef<DeliveryFormHandle>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { orderId, source } = orderMeta(delivery);

  useEffect(() => {
    setView("overview");
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
    setView("overview");
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
        className="fixed inset-0 z-[1300] flex items-center justify-center bg-[rgba(26,26,26,0.32)] p-4 backdrop-blur-[2px]"
        role="presentation"
        onClick={onClose}
      >
        <div
          className="flex w-full max-w-6xl flex-col overflow-hidden bg-white md:flex-row"
          style={{ height: RAIL_DIALOG_HEIGHT, borderRadius: DIALOG_RADIUS, boxShadow: shadow.lg }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-preview-title"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogRail label="Order sections">
            <RailGroup title="Order">
              <RailItem
                icon={<ArticleOutlinedIcon />}
                label="Overview"
                selected={view === "overview"}
                onClick={() => setView("overview")}
              />
              {actionVariant ? (
                <RailItem
                  icon={<BoltOutlinedIcon />}
                  label="Actions"
                  selected={view === "actions"}
                  onClick={() => setView("actions")}
                />
              ) : null}
            </RailGroup>
            <RailGroup title="Edit">
              <DeliveryStepItems current={typeof view === "number" ? view : null} onSelect={setView} />
            </RailGroup>
            {isAdmin ? (
              <Box sx={{ mt: { md: "auto" } }}>
                <RailItem
                  icon={<DeleteOutlineOutlinedIcon />}
                  label="Delete order"
                  danger
                  onClick={() => setDeleteOpen(true)}
                />
              </Box>
            ) : null}
          </DialogRail>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
              <div className="min-w-0">
                <Typography id="delivery-preview-title" component="h2" variant="h6" noWrap>
                  {delivery.sender_name ?? "Delivery"}
                </Typography>
                <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
                  {fmtDate(delivery.task_date)}
                  {delivery.knight_name ? ` · ${delivery.knight_name}` : ""}
                  {delivery.drop_recipient_name ? ` · → ${delivery.drop_recipient_name}` : ""}
                </p>
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center", mt: 1.25 }}>
                  <Chip size="small" variant="outlined" label={orderId} />
                  <Chip size="small" variant="outlined" label={source} />
                  <FulfillmentBadge status={effectiveFulfillmentStatus(delivery)} />
                  {delivery.needs_review ? (
                    <Chip size="small" color="warning" variant="outlined" label="Review" />
                  ) : null}
                  <DeliveryTaskBadges delivery={delivery} inline />
                </Stack>
              </div>
              <button
                type="button"
                className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)]"
                onClick={onClose}
                aria-label="Close"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--border)] px-6 py-5">
              {view === "overview" ? (
                <DeliveryPreview delivery={delivery} />
              ) : view === "actions" && actionVariant ? (
                <DeliveryActions
                  delivery={delivery}
                  knights={knights}
                  variant={actionVariant}
                  onLifecycleUpdated={handleLifecycleUpdated}
                />
              ) : typeof view !== "number" ? null : (
                <DeliveryForm
                  ref={formRef}
                  mode="edit"
                  id={delivery.id}
                  initial={delivery}
                  knights={knights}
                  clients={clients}
                  rateTiers={rateTiers}
                  variant="modal"
                  wizardStep={view}
                  hideActions
                  formId={EDIT_FORM_ID}
                  onSaved={handleSaved}
                  onCancel={() => setView("overview")}
                />
              )}
            </div>

            <DialogActions sx={{ pt: 2 }}>
              {typeof view !== "number" ? (
                <>
                  <Button variant="outlined" onClick={onClose}>
                    Close
                  </Button>
                  <Button variant="contained" onClick={() => setView(0)}>
                    Edit order
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outlined" onClick={() => setView("overview")}>
                    Discard changes
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => submitDeliveryForm(formRef.current, EDIT_FORM_ID, setView)}
                  >
                    Save changes
                  </Button>
                </>
              )}
            </DialogActions>
          </div>
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
        <DialogActions>
          <Button variant="outlined" disabled={deleting} onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" color="error" disabled={deleting} onClick={handleDelete}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** The order's next step: one line on what it is waiting for, then the buttons that move it on. */
function DeliveryActions({
  delivery,
  knights,
  variant,
  onLifecycleUpdated,
}: {
  delivery: Delivery;
  knights: KnightOpt[];
  variant: "pending" | "running";
  onLifecycleUpdated: (result: LifecycleResult) => void;
}) {
  return (
    <section aria-label="Actions" className="max-w-xl">
      <h3 className="text-sm font-semibold">Next step</h3>
      <p className="mb-4 mt-1 text-sm text-[var(--muted-foreground)]">
        {effectiveFulfillmentStatus(delivery) === "cancelled"
          ? "This order was cancelled in the app — you cannot assign a knight."
          : variant === "pending"
            ? delivery.app_order_id
              ? "Once the customer has paid, confirm the order, then assign a knight."
              : "Assign a knight to start this delivery."
            : delivery.fulfillment_status === "active"
              ? "Mark done when delivered, or edit details."
              : "Mark pickup when collected, or edit details."}
      </p>
      <DeliveryLifecycleActions
        delivery={delivery}
        knights={knights}
        variant={variant}
        onUpdated={onLifecycleUpdated}
      />
    </section>
  );
}

function DeliveryPreview({ delivery }: { delivery: Delivery }) {
  const { orderId, source } = orderMeta(delivery);
  const stops = getDeliveryStops(delivery);
  const stopSummary = formatStopRouteSummary(stops);
  const instructions = getDeliveryInstructions(delivery);
  const schedule = deliverySchedule(delivery);

  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)]">
      <section aria-label="Route">
        <h3 className="mb-4 text-sm font-semibold">
          {stopSummary ?? routeAreaLabel(delivery.pickup_location, delivery.drop_location)}
        </h3>
        <ol>
          <RouteStop
            title="Pickup"
            location={delivery.pickup_location}
            scheduled={schedule.pickup}
            actualTime={delivery.pickup_actual_time}
            instructions={instructions.pickup}
          />
          {stops.map((stop, index) => (
            <RouteStop
              key={`${stop.label}-${stop.location ?? stop.contactName ?? "drop"}`}
              title={stop.label}
              location={stop.location}
              scheduled={stop.label === "Drop" ? schedule.drop : null}
              actualTime={stop.label === "Drop" ? delivery.drop_actual_time : null}
              person={stop.contactName}
              phone={stop.contactPhone}
              instructions={stop.instructions ?? (stop.label === "Drop" || stop.label === "Drop 1" ? instructions.delivery : null)}
              isReturn={stop.isReturn}
              last={index === stops.length - 1}
            />
          ))}
        </ol>
      </section>

      <section aria-label="Order details">
        <h3 className="mb-2 text-sm font-semibold">Details</h3>
        <dl>
          <DetailRow label="Order ID" value={orderId} />
          <DetailRow label="Source" value={source} />
          <DetailRow label="Sender" value={delivery.sender_name} />
          <DetailRow label="Knight" value={delivery.knight_name} />
          <DetailRow label="Fees" value={money(delivery.fees)} />
          <DetailRow
            label="Payment"
            value={<PaymentBadge status={delivery.payment_status} mode={delivery.payment_mode} />}
          />
          <DetailRow label="Kms" value={delivery.kms == null ? null : `${delivery.kms} km`} />
          <DetailRow label="Mode" value={formatBookingMode(delivery.mode_of_booking)} />
          <DetailRow label="Invoice" value={delivery.invoice_no} />
          <DetailRow label="Billing" value={delivery.billing_name} />
          {delivery.content ? <DetailRow label="Content" value={delivery.content} /> : null}
          {delivery.remark ? <DetailRow label="Remark" value={delivery.remark} /> : null}
          {instructions.multiDrop ? <DetailRow label="Multidrop notes" value={instructions.multiDrop} /> : null}
        </dl>
      </section>
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
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" title={location ?? undefined} noWrap>
        {location ?? "—"}
      </Typography>
      {time ? (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }} noWrap>
          {time}
        </Typography>
      ) : null}
    </Box>
  );
}

/** One stop on the route: a marker on the line, then the place, who it is for, and when. */
function RouteStop({
  title,
  location,
  scheduled,
  actualTime,
  person,
  phone,
  instructions,
  isReturn,
  last = false,
}: {
  title: string;
  location: string | null;
  scheduled: string | null;
  actualTime: string | null;
  person?: string | null;
  phone?: string | null;
  instructions?: string | null;
  isReturn?: boolean;
  last?: boolean;
}) {
  const contact = [person ? `To ${person}` : null, phone].filter(Boolean).join(" · ");

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      <div className="flex w-3 shrink-0 flex-col items-center pt-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--text)]" />
        {last ? null : <span className="mt-1 w-px flex-1 bg-[var(--border)]" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[var(--muted-foreground)]">
              {title}
              {isReturn ? " · Return leg" : ""}
            </div>
            <div className="mt-0.5 text-sm font-semibold">{areaLabel(location)}</div>
          </div>
          <AddressActions address={location} label={title} />
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-[var(--muted-foreground)]">
          {location ?? "—"}
        </p>
        <dl className="mt-2">
          {contact ? <StopFact label="Contact" value={contact} /> : null}
          {scheduled ? <StopFact label="Scheduled" value={scheduled} /> : null}
          {actualTime ? <StopFact label="Actual" value={fmtDatetimeLocal(actualTime)} /> : null}
          {instructions ? <StopFact label="Instructions" value={instructions} /> : null}
        </dl>
      </div>
    </li>
  );
}

function StopFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[0.8125rem] leading-relaxed">
      <dt className="w-24 shrink-0 text-[var(--muted-foreground)]">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
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
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--tint)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
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
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--tint)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
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

/** A label and its value on one line. */
function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  const displayValue = value === null || value === undefined || value === "" ? "—" : value;

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] py-2 text-[0.8125rem] last:border-b-0">
      <dt className="shrink-0 text-[var(--muted-foreground)]">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{displayValue}</dd>
    </div>
  );
}

function joinText(...values: Array<string | null | undefined>) {
  return values
    .map((v) => fmtDatetimeLocal(v))
    .filter((v) => v && v !== "—")
    .join(" / ");
}
