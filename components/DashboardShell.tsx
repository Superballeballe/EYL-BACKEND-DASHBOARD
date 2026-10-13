"use client";

import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import DraftsIcon from "@mui/icons-material/Drafts";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DeliveryLifecycleActions from "@/components/DeliveryLifecycleActions";
import DeliveryTaskBadges from "@/components/DeliveryTaskBadges";
import { DeliveryPreviewModal } from "@/components/DeliveryTable";
import { EmptyState, FulfillmentBadge } from "@/components/ui";
import RetryRefundButton from "@/components/RetryRefundButton";
import { cancelledRefundPaise, formatPaise, refundStatusInfo } from "@/lib/refunds";
import BusinessOverview, { type ChartBundle } from "@/components/BusinessOverview";
import { fmtDatetimeLocal, money, routeAreaLabel, areaLabel } from "@/lib/format";
import { getDeliveryStops } from "@/lib/deliveryRouteDetails";
import { formatStopRouteSummary } from "@/lib/deliveryTaskBadges";
import { activateOnKey } from "@/lib/keyboard";
import { formatDeliveryOrderId } from "@/lib/serial";
import { FOCUS, gray, panelSx, shadow, tableShellSx } from "@/lib/surface";
import type { CancelledOrder, Delivery, DraftOrder, WorkDay } from "@/lib/types";

type KnightOpt = { id: string; display_name: string };
type ClientOpt = {
  id: string;
  client_name: string;
  company_name: string | null;
  gst_no: string | null;
  address: string | null;
};
type RateTierOpt = { min_km: number | null; max_km: number | null; fee: number | null };

type Period = {
  count: number;
  paidAmount: number;
  unpaidAmount: number;
  paidCount: number;
  unpaidCount: number;
};

type Props = {
  viewDate: string;
  periodStart: string;
  workDay: WorkDay | null;
  deliveries: Delivery[];
  unpaidCount: number;
  reviewCount: number;
  period: Period;
  revenue: number;
  pendingOrders: Delivery[];
  draftOrders: DraftOrder[];
  runningOrders: Delivery[];
  refundPendingOrders: CancelledOrder[];
  knights: KnightOpt[];
  clients: ClientOpt[];
  rateTiers: RateTierOpt[];
  isAdmin?: boolean;
  charts: ChartBundle;
};

function JobCard({
  delivery: d,
  knights,
  mode,
  onPreview,
}: {
  delivery: Delivery;
  knights: KnightOpt[];
  mode: "pending" | "running";
  onPreview: (delivery: Delivery) => void;
}) {
  const stops = getDeliveryStops(d);
  const stopSummary = formatStopRouteSummary(stops);
  const recipients =
    stops.length > 1
      ? stops.map((stop) => stop.contactName).filter(Boolean).join(" · ")
      : (d.drop_recipient_name ?? "");

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`Preview delivery for ${d.sender_name ?? "unknown sender"}`}
      onClick={() => onPreview(d)}
      onKeyDown={(event) => activateOnKey(event, () => onPreview(d))}
      sx={{
        ...panelSx,
        p: 1.5,
        cursor: "pointer",
        transition: "box-shadow .15s",
        "&:hover": { boxShadow: shadow.md },
        "&:focus-visible": { outline: `2px solid ${FOCUS}`, outlineOffset: 1 },
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <Typography variant="subtitle2" noWrap sx={{ minWidth: 0 }}>
          {d.sender_name ?? "—"}
        </Typography>
        <Typography variant="subtitle2" sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
          {money(d.fees)}
        </Typography>
      </Stack>
      <Typography
        variant="caption"
        noWrap
        sx={{
          display: "block",
          mt: 0.25,
          color: "text.secondary",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {stopSummary ?? routeAreaLabel(d.pickup_location, d.drop_location)}
      </Typography>
      {stopSummary ? (
        <Typography variant="caption" noWrap sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
          Pickup · {areaLabel(d.pickup_location)}
        </Typography>
      ) : null}
      <Typography variant="caption" noWrap sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
        {formatDeliveryOrderId(d)}
        {recipients ? ` · ${recipients}` : ""}
      </Typography>
      <DeliveryTaskBadges delivery={d} />
      {mode === "running" ? (
        <Typography variant="caption" noWrap sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
          Knight · {d.knight_name?.trim() || "Unassigned"}
          {d.pickup_time_window ? ` · Pickup ${fmtDatetimeLocal(d.pickup_time_window)}` : ""}
        </Typography>
      ) : null}

      <Stack
        direction="row"
        spacing={1}
        sx={{
          mt: 1.25,
          pt: 1.25,
          borderTop: 1,
          borderColor: "divider",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "default",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <FulfillmentBadge status={d.fulfillment_status} />
        <DeliveryLifecycleActions
          delivery={d}
          knights={knights}
          compact
          variant={mode}
          onEditFull={() => onPreview(d)}
        />
      </Stack>
    </Box>
  );
}

function JobLane({
  title,
  subtitle,
  countLabel,
  rows,
  knights,
  emptyMessage,
  mode,
  onPreview,
}: {
  title: string;
  subtitle: string;
  countLabel: string;
  rows: Delivery[];
  knights: KnightOpt[];
  emptyMessage: string;
  mode: "pending" | "running";
  onPreview: (delivery: Delivery) => void;
}) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: { xs: 200, lg: 420 },
        p: 1,
        borderRadius: 1,
        bgcolor: gray.lane,
      }}
    >
      <Box sx={{ px: 1, pt: 0.75, pb: 1.25 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="h2">{title}</Typography>
          <Chip size="small" label={`${rows.length} ${countLabel}`} />
        </Stack>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
          {subtitle}
        </Typography>
      </Box>
      {rows.length === 0 ? (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 2, py: 4 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center" }}>
            {emptyMessage}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {rows.map((d) => (
            <JobCard key={d.id} delivery={d} knights={knights} mode={mode} onPreview={onPreview} />
          ))}
        </Stack>
      )}
    </Box>
  );
}

function DraftOrdersTable({ rows, emptyMessage }: { rows: DraftOrder[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return (
      <EmptyState message={emptyMessage} minHeight={200} />
    );
  }

  return (
    <TableContainer sx={{ ...tableShellSx, overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Order · route</TableCell>
            <TableCell>Recipient</TableCell>
            <TableCell sx={{ width: "6rem" }} align="right">
              Price
            </TableCell>
            <TableCell sx={{ width: "12rem" }} align="right">
              Retry window
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={o.id}>
              <TableCell sx={{ verticalAlign: "top", py: 1.25 }}>
                <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                  {o.order_code ?? "—"}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                  {(o.pickup_address ?? "—") + " → " + (o.delivery_address ?? "—")}
                </Typography>
              </TableCell>
              <TableCell sx={{ verticalAlign: "top", pt: 1.5 }}>
                <Typography variant="body2">{o.recipient_name ?? "—"}</Typography>
              </TableCell>
              <TableCell
                align="right"
                sx={{ verticalAlign: "top", pt: 1.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
              >
                {money(o.total_price)}
              </TableCell>
              <TableCell align="right" sx={{ verticalAlign: "top", pt: 1.5 }}>
                <Typography variant="body2">
                  {o.expires_at ? `Until ${fmtDatetimeLocal(o.expires_at)}` : "Expired"}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function RefundPendingTable({ rows, emptyMessage }: { rows: CancelledOrder[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return (
      <EmptyState message={emptyMessage} minHeight={200} />
    );
  }

  return (
    <TableContainer sx={{ ...tableShellSx, overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Order · route</TableCell>
            <TableCell>Reason</TableCell>
            <TableCell sx={{ width: "7rem" }} align="right">
              Refund
            </TableCell>
            <TableCell sx={{ width: "10rem" }}>Status</TableCell>
            <TableCell sx={{ width: "9rem" }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {row.order_code || "—"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {[row.pickup_address, row.delivery_address].filter(Boolean).join(" → ") || "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{row.reason_label}</Typography>
                  {row.reason_note ? (
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                      {row.reason_note}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                  {formatPaise(cancelledRefundPaise(row))}
                </TableCell>
                <TableCell>
                  <Chip size="small" color={refundStatusInfo(row.refund_status).color} label={refundStatusInfo(row.refund_status).label} />
                </TableCell>
                <TableCell>
                  {row.refund_status === "failed" ? (
                    <RetryRefundButton id={row.id} amountPaise={cancelledRefundPaise(row)} />
                  ) : null}
                </TableCell>
              </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DraftOrdersPanel({ rows }: { rows: DraftOrder[] }) {
  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column", pb: 2 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 2, flexShrink: 0 }}
        >
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <DraftsIcon color="primary" fontSize="small" />
              <Typography variant="h2">Draft orders</Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
              Confirmed, but the customer didn&apos;t pay in time — the app reverted these to draft so they can retry.
            </Typography>
          </Box>
          <Chip variant="outlined" color="primary" label={`${rows.length} draft`} />
        </Stack>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <DraftOrdersTable rows={rows} emptyMessage="No draft orders — nothing has gone unpaid." />
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardShell(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const {
    viewDate,
    periodStart,
    workDay,
    deliveries,
    unpaidCount,
    reviewCount,
    period,
    revenue,
    pendingOrders,
    draftOrders,
    runningOrders,
    refundPendingOrders,
    knights,
    clients,
    rateTiers,
    isAdmin = false,
    charts,
  } = props;

  const pendingCount = pendingOrders.length;
  const draftCount = draftOrders.length;
  const runningCount = runningOrders.length;
  const refundCount = refundPendingOrders.length;

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), 300);
    };

    const deliveries = new EventSource("/api/deliveries/stream");
    deliveries.addEventListener("change", refresh);

    const refunds = new EventSource("/api/refunds/stream");
    refunds.addEventListener("change", refresh);

    return () => {
      if (debounce) clearTimeout(debounce);
      deliveries.close();
      refunds.close();
    };
  }, [router]);

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 2 }}
      >
        <Tab
          icon={<AssignmentIcon fontSize="small" />}
          iconPosition="start"
          label={
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <span>Orders</span>
              {pendingCount + runningCount > 0 ? (
                <Chip size="small" color="primary" label={pendingCount + runningCount} />
              ) : null}
            </Stack>
          }
        />
        <Tab
          icon={<PaymentsOutlinedIcon fontSize="small" />}
          iconPosition="start"
          label={
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <span>Refunds in progress</span>
              {refundCount > 0 ? <Chip size="small" color="warning" label={refundCount} /> : null}
            </Stack>
          }
        />
        <Tab
          icon={<DraftsIcon fontSize="small" />}
          iconPosition="start"
          label={
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <span>Draft orders</span>
              {draftCount > 0 ? <Chip size="small" color="primary" label={draftCount} /> : null}
            </Stack>
          }
        />
        <Tab
          icon={<BusinessCenterIcon fontSize="small" />}
          iconPosition="start"
          label={
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <span>Business Overview</span>
              {unpaidCount + reviewCount > 0 ? (
                <Chip size="small" color="warning" label={unpaidCount + reviewCount} />
              ) : null}
            </Stack>
          }
        />
      </Tabs>

      {tab === 0 && (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
            alignItems: "stretch",
          }}
        >
          <JobLane
            title="New jobs to approve"
            subtitle="Confirm paid app orders, then assign a knight"
            countLabel="pending"
            rows={pendingOrders}
            knights={knights}
            emptyMessage="No new jobs waiting for approval."
            mode="pending"
            onPreview={setSelectedDelivery}
          />
          <JobLane
            title="Current running jobs"
            subtitle="Accepted or active — pickup through delivery"
            countLabel="running"
            rows={runningOrders}
            knights={knights}
            emptyMessage="No jobs currently running."
            mode="running"
            onPreview={setSelectedDelivery}
          />
        </Box>
      )}

      {tab === 1 && (
        <Card>
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
              <Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <PaymentsOutlinedIcon color="primary" fontSize="small" />
                  <Typography variant="h2">Refunds in progress</Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
                  Paid cancellations before pickup are refunded in full, automatically. Only a failed refund needs you.
                </Typography>
              </Box>
              <Chip variant="outlined" color="warning" label={`${refundCount} open`} />
            </Stack>
            <RefundPendingTable rows={refundPendingOrders} emptyMessage="No refunds in progress." />
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: "1fr",
            minHeight: { lg: 360 },
          }}
        >
          <DraftOrdersPanel rows={draftOrders} />
        </Box>
      )}

      {tab === 3 && (
        <BusinessOverview
          viewDate={viewDate}
          periodStart={periodStart}
          workDay={workDay}
          deliveriesToday={deliveries.length}
          revenueToday={revenue}
          unpaidCount={unpaidCount}
          reviewCount={reviewCount}
          period={period}
          charts={charts}
        />
      )}

      {selectedDelivery ? (
        <DeliveryPreviewModal
          delivery={selectedDelivery}
          knights={knights}
          clients={clients}
          rateTiers={rateTiers}
          isAdmin={isAdmin}
          onClose={() => setSelectedDelivery(null)}
          onSaved={(delivery) => {
            setSelectedDelivery(delivery);
            router.refresh();
          }}
          onDeleted={() => {
            setSelectedDelivery(null);
            router.refresh();
          }}
        />
      ) : null}
    </Box>
  );
}
