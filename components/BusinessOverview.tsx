"use client";

import Link from "next/link";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import { fmtDate, money } from "@/lib/format";
import { chart, gray } from "@/lib/surface";
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
  positive: "primary.main",
  danger: "error.main",
  warn: "warning.main",
} as const;

type Tone = keyof typeof TONE;

function compactMoney(n: number): string {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}k`;
  return money(n);
}

function OverviewSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={0.5}
          sx={{ justifyContent: "space-between", alignItems: { sm: "baseline" }, mb: 2 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {subtitle}
            </Typography>
          ) : null}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function MetricTile({
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
  tone?: Tone;
}) {
  const inner = (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: gray.surface,
        height: "100%",
        transition: "background-color .15s",
        ...(href ? { "&:hover": { bgcolor: gray.hover } } : null),
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, display: "block", mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color: TONE[tone], lineHeight: 1.2 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );

  if (!href) return inner;
  return (
    <Box component={Link} href={href} sx={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
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

function ChartHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h2">{title}</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
        {subtitle}
      </Typography>
    </Box>
  );
}

const axisSx = {
  "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": { stroke: gray.border },
  "& .MuiChartsAxis-tickLabel": { fill: gray.muted, fontSize: 11 },
};

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
  const months = charts.months;
  const labels = months.map((m) => m.label);
  const cumulative = months.reduce<number[]>((acc, m) => {
    acc.push((acc.length ? acc[acc.length - 1] : 0) + m.revenue);
    return acc;
  }, []);

  const collectionRate =
    period.paidAmount + period.unpaidAmount > 0
      ? `${Math.round((period.paidAmount / (period.paidAmount + period.unpaidAmount)) * 100)}%`
      : "—";

  const hasRevenueData = months.some((m) => m.revenue > 0) || charts.ytdRevenue > 0;
  const hasDeliveryData = months.some((m) => m.deliveries > 0) || charts.ytdDeliveries > 0;
  const hasPaymentData = months.some((m) => m.paid > 0 || m.unpaid > 0);
  const statusTotal = charts.statusBreakdown.reduce((s, x) => s + x.count, 0);
  const periodLabel = fmtDate(periodStart);

  const countAxis = [{ tickNumber: 4, valueFormatter: (v: number | null) => String(Math.round(v ?? 0)) }];
  const moneyAxis = [{ tickNumber: 4, valueFormatter: (v: number | null) => compactMoney(v ?? 0) }];

  return (
    <Stack spacing={2.5}>
      {workDay?.note ? (
        <Alert severity="info">
          <strong>Note:</strong> {workDay.note}
        </Alert>
      ) : null}

      <OverviewSection title="Today" subtitle={fmtDate(viewDate)}>
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" } }}>
          <MetricTile label="Deliveries" value={deliveriesToday} href={`/deliveries?date=${viewDate}`} />
          <MetricTile label="Revenue" value={money(revenueToday)} tone="positive" hint="Fees collected today" />
          <MetricTile
            label="Unpaid"
            value={unpaidCount}
            tone={unpaidCount ? "danger" : "default"}
            href={unpaidCount ? `/deliveries?date=${viewDate}&payment_status=unpaid` : undefined}
          />
          <MetricTile
            label="Needs review"
            value={reviewCount}
            tone={reviewCount ? "warn" : "default"}
            href="/deliveries?needs_review=true"
          />
        </Box>
      </OverviewSection>

      <OverviewSection title={`Since ${periodLabel}`} subtitle="Period totals">
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" } }}>
          <MetricTile
            label="Paid amount"
            value={money(period.paidAmount)}
            tone="positive"
            hint={`${period.paidCount} ${period.paidCount === 1 ? "delivery" : "deliveries"}`}
            href={`/deliveries?payment_status=paid&from=${periodStart}`}
          />
          <MetricTile label="Collection rate" value={collectionRate} hint="Paid ÷ (paid + unpaid fees)" />
          <MetricTile label="Deliveries" value={period.count} hint="Non-cancelled in period" />
        </Box>
      </OverviewSection>

      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ justifyContent: "space-between", alignItems: { md: "flex-start" }, mb: 2 }}
          >
            <ChartHeader title="Year to date" subtitle="Revenue trend and cumulative total" />
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Box sx={{ px: 1.5, py: 1, borderRadius: 1, bgcolor: gray.surface, minWidth: 120 }}>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                  YTD revenue
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.main" }}>
                  {money(charts.ytdRevenue)}
                </Typography>
              </Box>
              <Box
                component={Link}
                href={`/deliveries?from=${viewDate.slice(0, 4)}-01-01`}
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  bgcolor: gray.surface,
                  minWidth: 120,
                  textDecoration: "none",
                  color: "inherit",
                  "&:hover": { bgcolor: gray.hover },
                }}
              >
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                  YTD deliveries
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {charts.ytdDeliveries}
                </Typography>
              </Box>
            </Stack>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {!hasRevenueData ? (
            <ChartEmpty message="No revenue recorded yet this year. Charts will appear once deliveries are logged." />
          ) : (
            <LineChart
              xAxis={[{ data: labels, scaleType: "point", tickLabelStyle: { fontSize: 11 } }]}
              yAxis={moneyAxis}
              series={[
                {
                  id: "monthly",
                  label: "Monthly",
                  data: months.map((m) => m.revenue),
                  color: chart.light,
                  area: true,
                  showMark: true,
                  valueFormatter: (v) => money(v ?? 0),
                },
                {
                  id: "ytd",
                  label: "Cumulative",
                  data: cumulative,
                  color: chart.main,
                  showMark: true,
                  valueFormatter: (v) => money(v ?? 0),
                },
              ]}
              height={260}
              margin={{ left: 56, right: 16, top: 16, bottom: 28 }}
              grid={{ horizontal: true }}
              sx={{
                ...axisSx,
                "& .MuiAreaElement-series-monthly": { fillOpacity: 0.2 },
              }}
            />
          )}
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          alignItems: "stretch",
        }}
      >
        <Card sx={{ height: "100%" }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
            <ChartHeader title="Monthly deliveries" subtitle="Volume by month" />
            {!hasDeliveryData ? (
              <ChartEmpty message="No deliveries logged this year yet." />
            ) : (
              <BarChart
                xAxis={[{ data: labels, scaleType: "band", tickLabelStyle: { fontSize: 11 } }]}
                yAxis={countAxis}
                series={[
                  {
                    data: months.map((m) => m.deliveries),
                    label: "Deliveries",
                    color: chart.main,
                    valueFormatter: (v) => `${v ?? 0}`,
                  },
                ]}
                height={240}
                margin={{ left: 44, right: 12, top: 12, bottom: 28 }}
                grid={{ horizontal: true }}
                borderRadius={4}
                sx={axisSx}
              />
            )}
          </CardContent>
        </Card>

        <Card sx={{ height: "100%" }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
            <ChartHeader title="Paid vs unpaid" subtitle="Fees collected vs outstanding" />
            {!hasPaymentData ? (
              <ChartEmpty message="No payment data recorded this year yet." />
            ) : (
              <BarChart
                xAxis={[{ data: labels, scaleType: "band", tickLabelStyle: { fontSize: 11 } }]}
                yAxis={moneyAxis}
                series={[
                  {
                    data: months.map((m) => m.paid),
                    label: "Paid",
                    color: chart.main,
                    stack: "pay",
                    valueFormatter: (v) => money(v ?? 0),
                  },
                  {
                    data: months.map((m) => m.unpaid),
                    label: "Unpaid",
                    color: chart.soft,
                    stack: "pay",
                    valueFormatter: (v) => money(v ?? 0),
                  },
                ]}
                height={240}
                margin={{ left: 52, right: 12, top: 12, bottom: 28 }}
                grid={{ horizontal: true }}
                borderRadius={4}
                sx={axisSx}
              />
            )}
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <ChartHeader title="Fulfillment mix" subtitle="Deliveries by status (YTD)" />
          {statusTotal === 0 ? (
            <ChartEmpty message="No fulfillment status breakdown available yet." />
          ) : (
            <BarChart
              layout="horizontal"
              yAxis={[
                {
                  data: charts.statusBreakdown.map((s) => s.status),
                  scaleType: "band",
                  width: 96,
                  tickLabelStyle: { fontSize: 12 },
                },
              ]}
              xAxis={countAxis}
              series={[
                {
                  data: charts.statusBreakdown.map((s) => s.count),
                  label: "Orders",
                  color: chart.main,
                  valueFormatter: (v) => `${Math.round(v ?? 0)}`,
                },
              ]}
              height={Math.min(280, Math.max(180, charts.statusBreakdown.length * 40 + 64))}
              margin={{ left: 8, right: 16, top: 8, bottom: 24 }}
              grid={{ vertical: true }}
              borderRadius={4}
              sx={axisSx}
            />
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
