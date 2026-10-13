"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Box, Card, Stack, Typography } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import PercentOutlinedIcon from "@mui/icons-material/PercentOutlined";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import { fmtDate, money } from "@/lib/format";
import { chart, FOCUS, gray } from "@/lib/surface";
import type { WorkDay } from "@/lib/types";

export type MonthPoint = {
  key: string;
  label: string;
  deliveries: number;
  revenue: number;
  paid: number;
  unpaid: number;
};

export type StatusPoint = { status: string; count: number };

export type ChartBundle = {
  months: MonthPoint[];
  statusBreakdown: StatusPoint[];
  ytdRevenue: number;
  ytdDeliveries: number;
};

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
  deliveriesToday: number;
  revenueToday: number;
  unpaidCount: number;
  reviewCount: number;
  period: Period;
  charts: ChartBundle;
};

const TONE = {
  default: "text.primary",
  danger: "error.main",
  warn: "warning.main",
} as const;

type Tone = keyof typeof TONE;

function compactMoney(n: number): string {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}k`;
  return money(n);
}

/** A titled card whose figures sit side by side, split by hairlines. */
function FigureCard({ title, columns, children }: { title: string; columns: number; children: React.ReactNode }) {
  return (
    <Card>
      <Typography variant="h2" sx={{ px: 2.5, py: 2 }}>
        {title}
      </Typography>
      {/* The 1px gap over a divider-coloured ground draws the rules, however the grid wraps. */}
      <Box
        sx={{
          display: "grid",
          gap: "1px",
          gridTemplateColumns: { xs: "1fr 1fr", lg: `repeat(${columns}, 1fr)` },
          bgcolor: "divider",
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        {children}
      </Box>
    </Card>
  );
}

function Figure({
  icon,
  label,
  value,
  hint,
  href,
  tone = "default",
  quiet = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: Tone;
  /** Nothing to report: the figure recedes to gray. */
  quiet?: boolean;
}) {
  const inner = (
    <Box
      sx={{
        height: "100%",
        p: 2.5,
        bgcolor: "background.paper",
        transition: "background-color .15s",
        ...(href ? { "&:hover": { bgcolor: gray.surface } } : null),
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            bgcolor: gray.hover,
            color: "text.secondary",
            "& svg": { fontSize: 16 },
          }}
        >
          {icon}
        </Box>
        <Typography variant="subtitle2">{label}</Typography>
      </Stack>
      <Typography variant="h4" sx={{ mt: 2, color: quiet ? "text.secondary" : TONE[tone], fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );

  if (!href) return inner;
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        display: "block",
        color: "inherit",
        textDecoration: "none",
        "&:focus-visible": { outline: `2px solid ${FOCUS}`, outlineOffset: -2 },
      }}
    >
      {inner}
    </Box>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        py: 6,
        px: 2,
        borderRadius: 1,
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: gray.surface,
      }}
    >
      <ShowChartIcon sx={{ color: "text.disabled", fontSize: 32 }} />
      <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center" }}>
        {message}
      </Typography>
    </Box>
  );
}

type MetricId = "revenue" | "deliveries" | "paid" | "unpaid";

/** Each year-to-date measure, and the measure drawn in gray behind it for comparison (same unit only). */
const METRICS: { id: MetricId; label: string; isMoney: boolean; against?: MetricId; empty: string }[] = [
  { id: "revenue", label: "Revenue", isMoney: true, empty: "No revenue recorded yet this year." },
  { id: "deliveries", label: "Deliveries", isMoney: false, empty: "No deliveries logged this year yet." },
  { id: "paid", label: "Paid", isMoney: true, against: "unpaid", empty: "No payment data recorded this year yet." },
  { id: "unpaid", label: "Unpaid", isMoney: true, against: "paid", empty: "No payment data recorded this year yet." },
];

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
      <Box sx={{ width: 14, height: 2, borderRadius: 1, bgcolor: color }} />
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
    </Stack>
  );
}

export default function BusinessOverview({
  viewDate,
  periodStart,
  workDay,
  deliveriesToday,
  revenueToday,
  unpaidCount,
  reviewCount,
  period,
  charts,
}: Props) {
  const [metricId, setMetricId] = useState<MetricId>("revenue");
  const months = charts.months;
  const labels = months.map((m) => m.label);
  const sum = (pick: (m: MonthPoint) => number) => months.reduce((total, m) => total + pick(m), 0);

  const series: Record<MetricId, number[]> = {
    revenue: months.map((m) => m.revenue),
    deliveries: months.map((m) => m.deliveries),
    paid: months.map((m) => m.paid),
    unpaid: months.map((m) => m.unpaid),
  };
  const totals: Record<MetricId, number> = {
    revenue: charts.ytdRevenue,
    deliveries: charts.ytdDeliveries,
    paid: sum((m) => m.paid),
    unpaid: sum((m) => m.unpaid),
  };

  const metric = METRICS.find((m) => m.id === metricId) ?? METRICS[0];
  const against = METRICS.find((m) => m.id === metric.against);
  const format = (v: number | null) => (metric.isMoney ? money(v ?? 0) : `${Math.round(v ?? 0)}`);
  const hasData = totals[metric.id] > 0 || series[metric.id].some((v) => v > 0) || Boolean(against && totals[against.id] > 0);

  const collectionRate =
    period.paidAmount + period.unpaidAmount > 0
      ? `${Math.round((period.paidAmount / (period.paidAmount + period.unpaidAmount)) * 100)}%`
      : "—";

  const statusTotal = charts.statusBreakdown.reduce((s, x) => s + x.count, 0);
  const statusMax = Math.max(1, ...charts.statusBreakdown.map((s) => s.count));
  const periodLabel = fmtDate(periodStart);

  return (
    <Stack spacing={2}>
      {workDay?.note ? (
        <Alert severity="info">
          <strong>Note:</strong> {workDay.note}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ px: 0.5, alignItems: "baseline", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
          <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
            Performance
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {fmtDate(viewDate)}
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Period since {periodLabel}
        </Typography>
      </Stack>

      <FigureCard title="Today" columns={4}>
        <Figure
          icon={<LocalShippingOutlinedIcon />}
          label="Deliveries"
          value={deliveriesToday}
          quiet={!deliveriesToday}
          hint="View today's deliveries"
          href={`/deliveries?date=${viewDate}`}
        />
        <Figure
          icon={<CurrencyRupeeOutlinedIcon />}
          label="Revenue"
          value={money(revenueToday)}
          quiet={!revenueToday}
          hint="Fees collected today"
        />
        <Figure
          icon={<HourglassEmptyOutlinedIcon />}
          label="Unpaid"
          value={unpaidCount}
          tone="danger"
          quiet={!unpaidCount}
          hint={unpaidCount ? "View unpaid deliveries" : "Nothing outstanding"}
          href={unpaidCount ? `/deliveries?date=${viewDate}&payment_status=unpaid` : undefined}
        />
        <Figure
          icon={<FactCheckOutlinedIcon />}
          label="Needs review"
          value={reviewCount}
          tone="warn"
          quiet={!reviewCount}
          hint="Open the review list"
          href="/deliveries?needs_review=true"
        />
      </FigureCard>

      <FigureCard title={`Since ${periodLabel}`} columns={3}>
        <Figure
          icon={<CurrencyRupeeOutlinedIcon />}
          label="Paid amount"
          value={money(period.paidAmount)}
          quiet={!period.paidAmount}
          hint={`${period.paidCount} ${period.paidCount === 1 ? "delivery" : "deliveries"}`}
          href={`/deliveries?payment_status=paid&from=${periodStart}`}
        />
        <Figure
          icon={<PercentOutlinedIcon />}
          label="Collection rate"
          value={collectionRate}
          quiet={collectionRate === "—"}
          hint="Paid ÷ (paid + unpaid fees)"
        />
        <Figure
          icon={<LocalShippingOutlinedIcon />}
          label="Deliveries"
          value={period.count}
          quiet={!period.count}
          hint="Non-cancelled in period"
        />
      </FigureCard>

      <Card>
        <Stack direction="row" spacing={2} sx={{ px: 2.5, pt: 2, alignItems: "baseline", justifyContent: "space-between" }}>
          <Typography variant="h2">
            Year to date
          </Typography>
          <Typography
            component={Link}
            href={`/deliveries?from=${viewDate.slice(0, 4)}-01-01`}
            variant="body2"
            sx={{ color: "text.secondary", textDecoration: "none", "&:hover": { color: "text.primary", textDecoration: "underline" } }}
          >
            View this year&apos;s deliveries
          </Typography>
        </Stack>

        <Stack direction="row" role="tablist" aria-label="Year-to-date measure" useFlexGap sx={{ px: 1.5, pt: 1.5, flexWrap: "wrap" }}>
          {METRICS.map((m) => {
            const selected = m.id === metric.id;
            return (
              <Box
                key={m.id}
                component="button"
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setMetricId(m.id)}
                sx={{
                  minWidth: 112,
                  p: 1,
                  border: "none",
                  borderRadius: "8px",
                  bgcolor: "transparent",
                  color: selected ? "text.primary" : "#8a8a8a",
                  font: "inherit",
                  textAlign: "left",
                  cursor: "pointer",
                  "&:hover": { bgcolor: gray.surface },
                  "&:focus-visible": { outline: `2px solid ${FOCUS}`, outlineOffset: 1 },
                }}
              >
                <Typography variant="subtitle2" sx={{ color: selected ? "text.primary" : "text.secondary" }}>
                  {m.label}
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.25, fontVariantNumeric: "tabular-nums" }}>
                  {m.isMoney ? money(totals[m.id]) : totals[m.id]}
                </Typography>
              </Box>
            );
          })}
        </Stack>

        <Box sx={{ px: 1.5, pb: 2 }}>
          {!hasData ? (
            <Box sx={{ px: 1, pt: 2 }}>
              <ChartEmpty message={metric.empty} />
            </Box>
          ) : (
            <>
              <LineChart
                xAxis={[{ data: labels, scaleType: "point", disableLine: true, disableTicks: true }]}
                yAxis={[
                  {
                    disableLine: true,
                    disableTicks: true,
                    tickNumber: 4,
                    valueFormatter: (v: number | null) => (metric.isMoney ? compactMoney(v ?? 0) : `${Math.round(v ?? 0)}`),
                  },
                ]}
                series={[
                  ...(against
                    ? [
                        {
                          id: against.id,
                          label: against.label,
                          data: series[against.id],
                          color: chart.context,
                          curve: "monotoneX" as const,
                          showMark: false,
                          valueFormatter: format,
                        },
                      ]
                    : []),
                  {
                    id: metric.id,
                    label: metric.label,
                    data: series[metric.id],
                    color: chart.main,
                    curve: "monotoneX" as const,
                    showMark: false,
                    valueFormatter: format,
                  },
                ]}
                height={280}
                margin={{ left: 8, right: 16, top: 16, bottom: 8 }}
                grid={{ horizontal: true }}
                hideLegend
                sx={{
                  "& .MuiChartsAxis-tickLabel": { fill: gray.muted, fontSize: 11 },
                  "& .MuiChartsGrid-line": { stroke: gray.stripe },
                  "& .MuiLineElement-root": { strokeWidth: 2 },
                }}
              />
              {against ? (
                <Stack direction="row" spacing={2} sx={{ px: 1, pt: 0.5 }}>
                  <LegendKey color={chart.main} label={metric.label} />
                  <LegendKey color={chart.context} label={against.label} />
                </Stack>
              ) : null}
            </>
          )}
        </Box>
      </Card>

      <Card>
        <Stack direction="row" spacing={2} sx={{ px: 2.5, pt: 2, pb: 1, alignItems: "baseline", justifyContent: "space-between" }}>
          <Typography variant="h2">
            Fulfillment mix
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Deliveries by status, year to date
          </Typography>
        </Stack>
        {statusTotal === 0 ? (
          <Box sx={{ px: 2.5, pb: 2.5 }}>
            <ChartEmpty message="No fulfillment status breakdown available yet." />
          </Box>
        ) : (
          <Box sx={{ px: 2.5, pb: 1 }}>
            {charts.statusBreakdown.map((row) => (
              <Box
                key={row.status}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "minmax(88px, 140px) 1fr 48px 48px",
                  alignItems: "center",
                  gap: 2,
                  py: 1.25,
                  borderTop: 1,
                  borderColor: gray.stripe,
                }}
              >
                <Typography variant="subtitle2">{row.status}</Typography>
                <Box sx={{ height: 8 }}>
                  <Box
                    sx={{
                      height: "100%",
                      width: `${(row.count / statusMax) * 100}%`,
                      minWidth: row.count ? 4 : 0,
                      borderRadius: "0 4px 4px 0",
                      bgcolor: chart.main,
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {row.count}
                </Typography>
                <Typography variant="body2" sx={{ textAlign: "right", color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
                  {Math.round((row.count / statusTotal) * 100)}%
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Card>
    </Stack>
  );
}
