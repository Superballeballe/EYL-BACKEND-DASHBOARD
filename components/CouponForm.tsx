"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
} from "@mui/material";

function currentYearMonth() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

type CouponFormProps = {
  couponId?: string;
  onSuccess?: () => void;
  initial?: {
    year_month?: string;
    code?: string;
    type?: "percent" | "flat";
    value?: number | string;
    label?: string;
    active?: boolean;
  };
};

export default function CouponForm({ couponId, onSuccess, initial }: CouponFormProps) {
  const router = useRouter();
  const [v, setV] = useState({
    year_month: initial?.year_month ?? currentYearMonth(),
    code: initial?.code ?? "",
    type: initial?.type ?? "percent",
    value: initial?.value != null ? String(initial.value) : "",
    label: initial?.label ?? "",
    active: initial?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(k: string, val: string | boolean) {
    setV((s) => ({ ...s, [k]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch(couponId ? `/api/coupons/${couponId}` : "/api/coupons", {
      method: couponId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
      onSuccess?.();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Save failed");
    }
  }

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2.5}>
        <TextField
          size="small"
          fullWidth
          label="Month (YYYY-MM)"
          placeholder="2026-08"
          value={v.year_month}
          onChange={(e) => set("year_month", e.target.value)}
          required
          disabled={Boolean(couponId)}
          helperText={couponId ? "Month cannot be changed after creation" : undefined}
        />

        <TextField
          size="small"
          fullWidth
          label="Coupon code"
          placeholder="AUG26"
          value={v.code}
          onChange={(e) => set("code", e.target.value.toUpperCase())}
          required
        />

        <FormControl fullWidth size="small">
          <InputLabel id="coupon-type-label">Discount type</InputLabel>
          <Select
            labelId="coupon-type-label"
            label="Discount type"
            value={v.type}
            onChange={(e) => set("type", e.target.value)}
          >
            <MenuItem value="percent">Percent off</MenuItem>
            <MenuItem value="flat">Flat ₹ off</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          fullWidth
          type="number"
          label={v.type === "percent" ? "Percent value" : "Amount (₹)"}
          slotProps={{ htmlInput: { min: 1, step: 1 } }}
          value={v.value}
          onChange={(e) => set("value", e.target.value)}
          required
        />

        <TextField
          size="small"
          fullWidth
          label="Display label"
          placeholder="10% off August"
          value={v.label}
          onChange={(e) => set("label", e.target.value)}
          required
        />

        <FormControlLabel
          control={
            <Switch
              checked={v.active}
              onChange={(e) => set("active", e.target.checked)}
            />
          }
          label="Active"
        />

        {err ? <Alert severity="error">{err}</Alert> : null}

        <Button type="submit" variant="contained" disabled={busy} fullWidth>
          {busy ? "Saving…" : couponId ? "Update coupon" : "Save coupon"}
        </Button>
      </Stack>
    </Box>
  );
}
