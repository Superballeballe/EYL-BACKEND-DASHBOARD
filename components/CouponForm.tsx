"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
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

import type { MonthlyCoupon } from "@/lib/types";

type CouponFormProps = {
  couponId?: string;
  onSuccess?: (coupon: MonthlyCoupon) => void;
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
  const [v, setV] = useState({
    year_month: initial?.year_month ?? currentYearMonth(),
    code: initial?.code ?? "",
    type: initial?.type ?? "percent",
    value: initial?.value != null ? String(initial.value) : "10",
    label: initial?.label ?? "",
    active: initial?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setType(type: "percent" | "flat") {
    setV((s) => {
      const next = { ...s, type };
      if (type === "percent") {
        const n = Math.min(100, Math.max(1, Number(s.value) || 10));
        next.value = String(n);
      }
      return next;
    });
  }

  const percentValue = Math.min(100, Math.max(1, Number(v.value) || 10));

  function set(k: string, val: string | boolean) {
    setV((s) => ({ ...s, [k]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const label =
      v.label.trim() ||
      (v.type === "percent" ? `${percentValue}% off` : `₹${v.value} off`);
    const payload = { ...v, label, value: v.type === "percent" ? percentValue : v.value };
    const res = await fetch(couponId ? `/api/coupons/${couponId}` : "/api/coupons", {
      method: couponId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      const saved = (await res.json()) as MonthlyCoupon;
      onSuccess?.(saved);
      return;
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
            onChange={(e) => setType(e.target.value as "percent" | "flat")}
          >
            <MenuItem value="percent">Percent off</MenuItem>
            <MenuItem value="flat">Flat ₹ off</MenuItem>
          </Select>
        </FormControl>

        {v.type === "percent" ? (
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              {percentValue}% off
            </Typography>
            <Slider
              value={percentValue}
              min={1}
              max={100}
              step={1}
              marks={[
                { value: 1, label: "1%" },
                { value: 100, label: "100%" },
              ]}
              valueLabelDisplay="auto"
              valueLabelFormat={(n) => `${n}%`}
              onChange={(_, val) => set("value", String(val))}
            />
          </Box>
        ) : (
          <TextField
            size="small"
            fullWidth
            type="number"
            label="Amount (₹)"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            value={v.value}
            onChange={(e) => set("value", e.target.value)}
            required
          />
        )}

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
          {busy ? "Saving…" : couponId ? "Save changes" : "Create coupon"}
        </Button>
      </Stack>
    </Box>
  );
}
