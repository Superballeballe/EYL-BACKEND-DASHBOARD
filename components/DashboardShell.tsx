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
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DeliveryLifecycleActions from "@/components/DeliveryLifecycleActions";
import DeliveryTaskBadges from "@/components/DeliveryTaskBadges";
import { DeliveryPreviewModal } from "@/components/DeliveryTable";
import { EmptyState } from "@/components/ui";
import BusinessOverview, { type ChartBundle } from "@/components/BusinessOverview";
import { fmtDatetimeLocal, money, routeAreaLabel, areaLabel } from "@/lib/format";
import { getDeliveryStops } from "@/lib/deliveryRouteDetails";
import { formatStopRouteSummary } from "@/lib/deliveryTaskBadges";
import { formatDeliveryOrderId } from "@/lib/serial";
import { gray, tableShellSx } from "@/lib/surface";
import type { Delivery, DraftOrder, WorkDay } from "@/lib/types";

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
  knights: KnightOpt[];
  clients: ClientOpt[];
  rateTiers: RateTierOpt[];
  isAdmin?: boolean;
  charts: ChartBundle;
};

const ROW_ACCENT: Record<string, object> = {
  booked: { boxShadow: "inset 4px 0 0 #2563eb" },
  accepted: { boxShadow: "inset 4px 0 0 #3b82f6" },
  active: { boxShadow: "inset 4px 0 0 #60a5fa" },
  completed: { boxShadow: "inset 4px 0 0 #93c5fd" },
  cancelled: { boxShadow: "inset 4px 0 0 #cbd5e1", opacity: 0.85 },
};

function OrdersTable({
  rows,
  knights,
  emptyMessage,
  mode = "running",
  onPreview,
}: {
  rows: Delivery[];
  knights: KnightOpt[];
  emptyMessage: string;
  mode?: "pending" | "running";
  onPreview: (delivery: Delivery) => void;
}) {
  if (rows.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
          borderRadius: 1,
          border: `1px dashed ${gray.border}`,
          bgcolor: gray.surface,
        }}
      >
        <EmptyState message={emptyMessage} compact />
      </Box>
    );
  }

  return (
    <TableContainer sx={{ ...tableShellSx, overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Sender · route</TableCell>
            {mode === "running" ? (
              <TableCell sx={{ width: "7rem" }}>Knight</TableCell>
            ) : null}
            <TableCell sx={{ width: "4.5rem" }} align="right">
              Fees
            </TableCell>
            <TableCell sx={{ width: mode === "running" ? "9rem" : "11.5rem", pr: 1 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((d) => {
            const stops = getDeliveryStops(d);
            const stopSummary = formatStopRouteSummary(stops);
            return (
            <TableRow
              key={d.id}
              hover
              tabIndex={0}
              role="button"
              aria-label={`Preview delivery for ${d.sender_name ?? "unknown sender"}`}
              sx={{
                cursor: "pointer",
                "&:focus-visible": { bgcolor: "#eff6ff" },
                ...(ROW_ACCENT[d.fulfillment_status] ?? {}),
              }}
              onClick={() => onPreview(d)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onPreview(d);
              }}
            >
              <TableCell sx={{ verticalAlign: "top", py: 1.25 }}>
                {mode === "pending" ? (
                  <>
                    <Typography variant="body2" color="primary" sx={{ fontWeight: 700 }}>
                      {d.sender_name ?? "—"}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.35 }}>
                      {stopSummary ?? routeAreaLabel(d.pickup_location, d.drop_location)}
                    </Typography>
                    {stopSummary ? (
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                        Pickup · {areaLabel(d.pickup_location)}
                      </Typography>
                    ) : null}
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.35 }}>
                      {formatDeliveryOrderId(d)}
                      {stops.length > 1
                        ? stops.map((stop) => stop.contactName).filter(Boolean).length
                          ? ` · ${stops.map((stop) => stop.contactName).filter(Boolean).join(" · ")}`
                          : ""
                        : d.drop_recipient_name
                          ? ` · ${d.drop_recipient_name}`
                          : ""}
                    </Typography>
                    <DeliveryTaskBadges delivery={d} />
                  </>
                ) : (
                  <>
                    <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                      {d.sender_name ?? "—"}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                      {stopSummary ?? routeAreaLabel(d.pickup_location, d.drop_location)}
                    </Typography>
                    {stopSummary ? (
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                        Pickup · {areaLabel(d.pickup_location)}
                      </Typography>
                    ) : null}
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                      {formatDeliveryOrderId(d)}
                      {stops.length > 1
                        ? stops.map((stop) => stop.contactName).filter(Boolean).length
                          ? ` · ${stops.map((stop) => stop.contactName).filter(Boolean).join(" · ")}`
                          : ""
                        : d.drop_recipient_name
                          ? ` · ${d.drop_recipient_name}`
                          : ""}
                    </Typography>
                    <DeliveryTaskBadges delivery={d} />
                    {d.pickup_time_window ? (
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                        Pickup {fmtDatetimeLocal(d.pickup_time_window)}
                      </Typography>
                    ) : null}
                  </>
                )}
              </TableCell>
              {mode === "running" ? (
                <TableCell sx={{ verticalAlign: "top", pt: 1.5 }}>
                  <Typography variant="body2">{d.knight_name ?? "—"}</Typography>
                </TableCell>
              ) : null}
              <TableCell
                align="right"
                sx={{ verticalAlign: "top", pt: 1.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
              >
                {money(d.fees)}
              </TableCell>
              <TableCell align="right" sx={{ verticalAlign: "top", pt: 1, pr: 1 }} onClick={(e) => e.stopPropagation()}>
                <DeliveryLifecycleActions
                  delivery={d}
                  knights={knights}
                  compact
                  variant={mode === "pending" ? "pending" : "running"}
                  onEditFull={() => onPreview(d)}
                />
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function OrdersPanel({
  title,
  subtitle,
  icon,
  count,
  countLabel,
  rows,
  knights,
  emptyMessage,
  mode = "running",
  onPreview,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  count: number;
  countLabel: string;
  rows: Delivery[];
  knights: KnightOpt[];
  emptyMessage: string;
  mode?: "pending" | "running";
  onPreview: (delivery: Delivery) => void;
}) {
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
              {icon}
              <Typography variant="h2">{title}</Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
              {subtitle}
            </Typography>
          </Box>
          <Chip variant="outlined" color="primary" label={`${count} ${countLabel}`} />
        </Stack>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <OrdersTable
            rows={rows}
            knights={knights}
            emptyMessage={emptyMessage}
            mode={mode}
            onPreview={onPreview}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

function DraftOrdersTable({ rows, emptyMessage }: { rows: DraftOrder[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
          borderRadius: 1,
          border: `1px dashed ${gray.border}`,
          bgcolor: gray.surface,
        }}
      >
        <EmptyState message={emptyMessage} compact />
      </Box>
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
    knights,
    clients,
    rateTiers,
    isAdmin = false,
    charts,
  } = props;

  const pendingCount = pendingOrders.length;
  const draftCount = draftOrders.length;
  const runningCount = runningOrders.length;
  const bothEmpty = pendingCount === 0 && runningCount === 0;

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const es = new EventSource("/api/deliveries/stream");

    const onChange = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), 300);
    };

    es.addEventListener("change", onChange);
    return () => {
      if (debounce) clearTimeout(debounce);
      es.close();
    };
  }, [router]);

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider", minHeight: 44 }}
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
        <Box>
          <Box
            sx={{
              display: "grid",
              gap: 2.5,
              gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
              alignItems: "stretch",
              minHeight: { lg: 360 },
            }}
          >
            {bothEmpty ? (
              <Card sx={{ gridColumn: "1 / -1" }}>
                <CardContent sx={{ py: 6 }}>
                  <EmptyState message="No pending or running jobs right now." />
                </CardContent>
              </Card>
            ) : (
              <>
                <OrdersPanel
                  title="New jobs to approve"
                  subtitle="Assign knight and confirm pickup time"
                  icon={<AssignmentIcon color="primary" fontSize="small" />}
                  count={pendingCount}
                  countLabel="pending"
                  rows={pendingOrders}
                  knights={knights}
                  emptyMessage="No new jobs waiting for approval."
                  mode="pending"
                  onPreview={setSelectedDelivery}
                />
                <OrdersPanel
                  title="Current running jobs"
                  subtitle="Accepted or active — pickup through delivery"
                  icon={<LocalShippingIcon color="primary" fontSize="small" />}
                  count={runningCount}
                  countLabel="running"
                  rows={runningOrders}
                  knights={knights}
                  emptyMessage="No jobs currently running."
                  mode="running"
                  onPreview={setSelectedDelivery}
                />
              </>
            )}
          </Box>
        </Box>
      )}

      {tab === 1 && (
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

      {tab === 2 && (
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
