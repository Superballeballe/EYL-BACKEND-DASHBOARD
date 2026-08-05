"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import FilterListIcon from "@mui/icons-material/FilterList";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SearchIcon from "@mui/icons-material/Search";
import { todayISO } from "@/lib/format";

type KnightOpt = { id: string; display_name: string };

export type DeliveriesFilterValues = {
  q: string;
  from: string;
  to: string;
  knightId: string;
  paymentStatus: string;
  fulfillmentStatus: string;
};

export type DeliveriesFiltersProps = {
  values: DeliveriesFilterValues;
  knights: KnightOpt[];
  total: number;
  hasFilters: boolean;
  dateSummary?: string;
  action?: React.ReactNode;
};

type DatePreset = "today" | "week" | "month" | "all";

function localIsoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function presetRange(preset: DatePreset): { from: string; to: string } {
  const today = todayISO();
  if (preset === "today") return { from: today, to: today };
  if (preset === "all") return { from: "", to: "" };
  if (preset === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return { from: localIsoDate(d), to: today };
  }
  const d = new Date();
  return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`, to: today };
}

function activePreset(from: string, to: string): DatePreset | null {
  const today = todayISO();
  if (!from && !to) return "all";
  if (from === today && to === today) return "today";

  const week = presetRange("week");
  if (from === week.from && to === week.to) return "week";

  const month = presetRange("month");
  if (from === month.from && to === month.to) return "month";

  return null;
}

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

export default function DeliveriesFilters({
  values,
  knights,
  total,
  hasFilters,
  dateSummary,
  action,
}: DeliveriesFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [from, setFrom] = useState(values.from);
  const [to, setTo] = useState(values.to);
  const preset = activePreset(from, to);

  const hasActiveFilters = Boolean(
    values.q || values.from || values.to || values.knightId || values.paymentStatus || values.fulfillmentStatus,
  );

  const summaryParts = [
    `${total} record${total === 1 ? "" : "s"}`,
    dateSummary,
    hasFilters ? "filtered" : null,
  ].filter(Boolean);

  function applyPreset(next: DatePreset) {
    const range = presetRange(next);
    setFrom(range.from);
    setTo(range.to);
    queueMicrotask(() => formRef.current?.requestSubmit());
  }

  return (
    <Box
      ref={formRef}
      component="form"
      method="get"
      action="/deliveries"
      sx={{
        mb: 2.5,
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        overflow: "hidden",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          p: 2,
          alignItems: { sm: "center" },
          justifyContent: "space-between",
          bgcolor: "grey.50",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h1">Deliveries</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
            {summaryParts.join(" · ")}
          </Typography>
        </Box>
        {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
      </Stack>

      <Divider />

      <Box sx={{ p: 2, pt: 1.5 }}>
        <Typography
          variant="overline"
          sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: "0.06em", display: "block", mb: 1 }}
        >
          Find a delivery
        </Typography>
        <TextField
          name="q"
          size="small"
          fullWidth
          defaultValue={values.q}
          placeholder="APPEYL-12, sender, recipient, pickup/drop address, invoice no…"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mt: 0 }}
        />
        <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: "text.secondary" }}>
          Booking ID, names, locations, or invoice number
        </Typography>
      </Box>

      <Divider />

      <Box sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", mb: 1.5 }}
        >
          <Typography
            variant="overline"
            sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: "0.06em", mb: 0 }}
          >
            Task date range
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            {PRESETS.map(({ id, label }) => (
              <Chip
                key={id}
                label={label}
                size="small"
                clickable
                variant={preset === id ? "filled" : "outlined"}
                color={preset === id ? "primary" : "default"}
                onClick={() => applyPreset(id)}
              />
            ))}
          </Stack>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
          <TextField
            name="from"
            size="small"
            type="date"
            label="From"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: { xs: "100%", sm: 160 } }}
          />
          <ArrowForwardIcon fontSize="small" sx={{ color: "text.disabled", display: { xs: "none", sm: "block" } }} />
          <TextField
            name="to"
            size="small"
            type="date"
            label="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: { xs: "100%", sm: 160 } }}
          />
          <Typography variant="caption" sx={{ color: "text.secondary", flex: 1, minWidth: 140 }}>
            Leave either end blank for open-ended ranges
          </Typography>
        </Stack>
      </Box>

      <Divider />

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        useFlexGap
        sx={{ p: 2, flexWrap: "wrap", alignItems: { md: "flex-end" } }}
      >
        <FormControl size="small" sx={{ width: { xs: "100%", sm: 180 } }}>
          <InputLabel id="del-knight-label">Knight</InputLabel>
          <Select name="knight_id" labelId="del-knight-label" label="Knight" defaultValue={values.knightId}>
            <MenuItem value="">All knights</MenuItem>
            {knights.map((k) => (
              <MenuItem key={k.id} value={k.id}>
                {k.display_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ width: { xs: "100%", sm: 150 } }}>
          <InputLabel id="del-pay-label">Payment</InputLabel>
          <Select name="payment_status" labelId="del-pay-label" label="Payment" defaultValue={values.paymentStatus}>
            <MenuItem value="">Any payment</MenuItem>
            <MenuItem value="paid">Paid</MenuItem>
            <MenuItem value="unpaid">Unpaid</MenuItem>
            <MenuItem value="partial">Partial</MenuItem>
            <MenuItem value="free">Free</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ width: { xs: "100%", sm: 150 } }}>
          <InputLabel id="del-status-label">Status</InputLabel>
          <Select name="status" labelId="del-status-label" label="Status" defaultValue={values.fulfillmentStatus}>
            <MenuItem value="">Any status</MenuItem>
            <MenuItem value="booked">Booked</MenuItem>
            <MenuItem value="accepted">Accepted</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>

        <Stack direction="row" spacing={1} sx={{ ml: { md: "auto" }, width: { xs: "100%", md: "auto" } }}>
          <Button type="submit" variant="contained" startIcon={<FilterListIcon />} sx={{ flex: { xs: 1, md: "none" } }}>
            Search
          </Button>
          {hasActiveFilters ? (
            <Button component={Link} href="/deliveries" variant="outlined" startIcon={<RestartAltIcon />}>
              Reset
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}
