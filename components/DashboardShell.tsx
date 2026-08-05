"use client";

import Link from "next/link";
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
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { useState } from "react";
import DeliveryLifecycleActions from "@/components/DeliveryLifecycleActions";
import { EmptyState } from "@/components/ui";
import BusinessOverview, { type ChartBundle } from "@/components/BusinessOverview";
import { fmtDatetimeLocal, money, routeAreaLabel } from "@/lib/format";
import { formatSerialCode } from "@/lib/serial";
import { gray, tableShellSx } from "@/lib/surface";
import type { Delivery, WorkDay } from "@/lib/types";

type KnightOpt = { id: string; display_name: string };

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
  runningOrders: Delivery[];
  knights: KnightOpt[];
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
}: {
  rows: Delivery[];
  knights: KnightOpt[];
  emptyMessage: string;
  mode?: "pending" | "running";
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
            <TableCell sx={{ width: "7rem" }}>Knight</TableCell>
            <TableCell sx={{ width: "4.5rem" }} align="right">
              Fees
            </TableCell>
            <TableCell sx={{ width: mode === "running" ? "9rem" : "11.5rem", pr: 1 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.id} hover sx={ROW_ACCENT[d.fulfillment_status] ?? undefined}>
              <TableCell sx={{ verticalAlign: "top", py: 1.25 }}>
                {mode === "pending" ? (
                  <>
                    <Typography
                      component={Link}
                      href={`/deliveries/${d.id}/edit`}
                      variant="body2"
                      color="primary"
                      sx={{ fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                    >
                      {d.sender_name ?? "—"}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.35 }}>
                      {routeAreaLabel(d.pickup_location, d.drop_location)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.35 }}>
                      {formatSerialCode(d.mode_of_booking, d.serial_no, d.app_order_id)}
                      {d.drop_recipient_name ? ` · ${d.drop_recipient_name}` : ""}
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography
                      component={Link}
                      href={`/deliveries/${d.id}/edit`}
                      variant="body2"
                      color="primary"
                      sx={{ fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                    >
                      {d.sender_name ?? "—"}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                      {routeAreaLabel(d.pickup_location, d.drop_location)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                      {formatSerialCode(d.mode_of_booking, d.serial_no, d.app_order_id)}
                      {d.drop_recipient_name ? ` · ${d.drop_recipient_name}` : ""}
                    </Typography>
                    {d.pickup_time_window ? (
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                        Pickup {fmtDatetimeLocal(d.pickup_time_window)}
                      </Typography>
                    ) : null}
                  </>
                )}
              </TableCell>
              <TableCell sx={{ verticalAlign: "top", pt: 1.5 }}>
                <Typography variant="body2">{d.knight_name ?? "—"}</Typography>
              </TableCell>
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
                />
              </TableCell>
            </TableRow>
          ))}
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
          <OrdersTable rows={rows} knights={knights} emptyMessage={emptyMessage} mode={mode} />
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardShell(props: Props) {
  const [tab, setTab] = useState(0);
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
    runningOrders,
    knights,
    charts,
  } = props;

  const pendingCount = pendingOrders.length;
  const runningCount = runningOrders.length;
  const bothEmpty = pendingCount === 0 && runningCount === 0;

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
          {!bothEmpty ? (
            <Stack
              direction="row"
              spacing={1}
              sx={{ mb: 2, flexWrap: "wrap" }}
              useFlexGap
            >
              <Chip label={`${pendingCount} pending approval`} color={pendingCount ? "primary" : "default"} variant="outlined" />
              <Chip label={`${runningCount} in progress`} color={runningCount ? "primary" : "default"} variant="outlined" />
              <Chip label={`${deliveries.length} today`} variant="outlined" />
              <Chip label={`${money(revenue)} revenue`} variant="outlined" />
            </Stack>
          ) : null}

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
                />
              </>
            )}
          </Box>
        </Box>
      )}

      {tab === 1 && (
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
    </Box>
  );
}
