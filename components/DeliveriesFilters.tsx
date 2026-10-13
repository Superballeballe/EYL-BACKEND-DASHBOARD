"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Box, Button, InputAdornment, MenuItem, Select, Stack, TextField } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SearchIcon from "@mui/icons-material/Search";
import { PageHeader } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { panelSx } from "@/lib/surface";

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
  /** The table (or its empty state), rendered under the toolbar. */
  children?: React.ReactNode;
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

const DATE_OPTIONS: { value: DatePreset | "custom"; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

const PAYMENT_OPTIONS = [
  { value: "", label: "Any payment" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "free", label: "Free" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "booked", label: "Booked" },
  { value: "accepted", label: "Accepted" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

/** Query-string name for each filter the deliveries page reads. */
const PARAM: Record<keyof DeliveriesFilterValues, string> = {
  q: "q",
  from: "from",
  to: "to",
  knightId: "knight_id",
  paymentStatus: "payment_status",
  fulfillmentStatus: "status",
};

/** Toolbar controls are the theme's filled fields, drawn as pills. */
const pillSx = { height: 36, borderRadius: "999px", fontSize: "0.8125rem" } as const;

/** A dropdown that reads as a pill: the filter's name, then its value in bold once one is chosen. */
function FilterPill({
  label,
  value,
  unset = "",
  options,
  onChange,
}: {
  label: string;
  value: string;
  /** The option that means "not filtering" — shown as the bare label. */
  unset?: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      size="small"
      displayEmpty
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputProps={{ "aria-label": label }}
      renderValue={(current) => (
        <Box component="span" sx={{ display: "flex", gap: 0.75 }}>
          <Box component="span" sx={{ color: "text.secondary" }}>
            {label}
          </Box>
          {current !== unset ? (
            <Box component="span" sx={{ fontWeight: 600 }}>
              {options.find((option) => option.value === current)?.label ?? current}
            </Box>
          ) : null}
        </Box>
      )}
      sx={pillSx}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
}

export default function DeliveriesFilters({
  values,
  knights,
  total,
  hasFilters,
  dateSummary,
  action,
  children,
}: DeliveriesFiltersProps) {
  const router = useRouter();
  const preset = activePreset(values.from, values.to);
  const [customRange, setCustomRange] = useState(preset === null);

  const summaryParts = [
    `${total} record${total === 1 ? "" : "s"}`,
    dateSummary,
    hasFilters ? "filtered" : null,
  ].filter(Boolean);

  /** The URL is the source of truth: every change navigates to the new filter set, from page one. */
  function apply(changes: Partial<DeliveriesFilterValues>) {
    const next = { ...values, ...changes };
    const params = new URLSearchParams();
    for (const key of Object.keys(PARAM) as (keyof DeliveriesFilterValues)[]) {
      if (next[key]) params.set(PARAM[key], next[key]);
    }
    const query = params.toString();
    router.push(query ? `/deliveries?${query}` : "/deliveries");
  }

  function onDateOption(option: string) {
    if (option === "custom") {
      setCustomRange(true);
      return;
    }
    setCustomRange(false);
    apply(presetRange(option as DatePreset));
  }

  const dateInputSx = { width: 150, "& .MuiFilledInput-root": pillSx } as const;

  return (
    <>
      <PageHeader title="Deliveries" subtitle={summaryParts.join(" · ")} />

      <Box sx={{ ...panelSx, mb: 2.5 }}>
        <Stack
          component="form"
          role="search"
          direction="row"
          spacing={1}
          useFlexGap
          onSubmit={(event) => {
            event.preventDefault();
            apply({ q: String(new FormData(event.currentTarget).get("q") ?? "").trim() });
          }}
          sx={{ p: 2, flexWrap: "wrap", alignItems: "center" }}
        >
          <TextField
            key={values.q}
            name="q"
            size="small"
            defaultValue={values.q}
            placeholder="Search ID, name, address, invoice…"
            slotProps={{
              htmlInput: { "aria-label": "Search by booking ID, names, locations, or invoice number" },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: "text.primary" }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: { xs: "100%", sm: 280 }, "& .MuiFilledInput-root": pillSx }}
          />

          <FilterPill
            label="Date"
            unset="all"
            value={customRange ? "custom" : (preset ?? "custom")}
            options={DATE_OPTIONS}
            onChange={onDateOption}
          />
          {customRange ? (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <TextField
                size="small"
                type="date"
                value={values.from}
                onChange={(event) => apply({ from: event.target.value })}
                slotProps={{ htmlInput: { "aria-label": "Task date from" } }}
                sx={dateInputSx}
              />
              <ArrowForwardIcon sx={{ fontSize: 16, color: "text.disabled" }} />
              <TextField
                size="small"
                type="date"
                value={values.to}
                onChange={(event) => apply({ to: event.target.value })}
                slotProps={{ htmlInput: { "aria-label": "Task date to" } }}
                sx={dateInputSx}
              />
            </Stack>
          ) : null}
          <FilterPill
            label="Status"
            value={values.fulfillmentStatus}
            options={STATUS_OPTIONS}
            onChange={(fulfillmentStatus) => apply({ fulfillmentStatus })}
          />
          <FilterPill
            label="Payment"
            value={values.paymentStatus}
            options={PAYMENT_OPTIONS}
            onChange={(paymentStatus) => apply({ paymentStatus })}
          />
          <FilterPill
            label="Knight"
            value={values.knightId}
            options={[{ value: "", label: "All knights" }, ...knights.map((k) => ({ value: k.id, label: k.display_name }))]}
            onChange={(knightId) => apply({ knightId })}
          />

          <Stack direction="row" spacing={1} sx={{ ml: "auto", alignItems: "center" }}>
            {hasFilters ? (
              <Button
                variant="text"
                onClick={() => {
                  setCustomRange(false);
                  router.push("/deliveries");
                }}
              >
                Clear filters
              </Button>
            ) : null}
            {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
          </Stack>
        </Stack>
      </Box>

      {children}
    </>
  );
}
