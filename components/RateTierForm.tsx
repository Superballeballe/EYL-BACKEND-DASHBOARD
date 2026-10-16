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
  Typography,
} from "@mui/material";
import type { RateTier } from "@/lib/types";

const PROVIDERS = ["eyl", "eyl_cake", "fudpro", "wefast", "uber", "porter"];
const GST_RATE = 18;

/** Customer distance bands: the app charges Fee ex-GST + 18% GST for these rows. */
export const APP_PRICE_PROVIDER = "eyl";

const str = (n: number | null | undefined) => (n == null ? "" : String(n));

export default function RateTierForm({
  tier,
  onSuccess,
}: {
  /** Editing this row; omitted to add a new one. */
  tier?: RateTier;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const blank = {
    provider: APP_PRICE_PROVIDER,
    label: "",
    min_km: "",
    max_km: "",
    fee: "",
    fee_ex_gst: "",
    gst_amount: "",
    is_current: true,
  };
  const [v, setV] = useState(
    tier
      ? {
          provider: tier.provider,
          label: tier.label ?? "",
          min_km: str(tier.min_km),
          max_km: str(tier.max_km),
          fee: str(tier.fee),
          fee_ex_gst: str(tier.fee_ex_gst),
          gst_amount: str(tier.gst_amount),
          is_current: tier.is_current,
        }
      : blank,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const providers = PROVIDERS.includes(v.provider) ? PROVIDERS : [v.provider, ...PROVIDERS];

  function set(k: string, val: string | boolean) {
    setV((s) => ({ ...s, [k]: val }));
  }

  /** The fee includes GST: split it into ex-GST and GST (both still editable). */
  function setFee(val: string) {
    const fee = Number(val);
    if (val === "" || !Number.isFinite(fee)) {
      setV((s) => ({ ...s, fee: val }));
      return;
    }
    const exGst = Math.round((fee * 10000) / (100 + GST_RATE)) / 100;
    setV((s) => ({
      ...s,
      fee: val,
      fee_ex_gst: exGst.toFixed(2),
      gst_amount: (Math.round((fee - exGst) * 100) / 100).toFixed(2),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch(tier ? `/api/rates/${tier.id}` : "/api/rates", {
      method: tier ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    setBusy(false);
    if (res.ok) {
      if (!tier) setV({ ...blank, provider: v.provider });
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
        <FormControl fullWidth size="small">
          <InputLabel id="provider-label">Provider</InputLabel>
          <Select
            labelId="provider-label"
            label="Provider"
            value={v.provider}
            onChange={(e) => set("provider", e.target.value)}
          >
            {providers.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {v.provider === APP_PRICE_PROVIDER ? (
          <Alert severity="info">
            Live app price. Customers pay Fee ex-GST (rounded to the rupee) plus 18% GST for
            routes in this range. Max km is inclusive; leave it empty for the last band.
          </Alert>
        ) : null}

        <TextField
          size="small"
          fullWidth
          label="Label"
          placeholder="e.g. 0 - 3 km"
          value={v.label}
          onChange={(e) => set("label", e.target.value)}
        />

        <Stack direction="row" spacing={2}>
          <TextField
            size="small"
            fullWidth
            type="number"
            label="Min km"
            slotProps={{ htmlInput: { step: 0.1 } }}
            value={v.min_km}
            onChange={(e) => set("min_km", e.target.value)}
          />
          <TextField
            size="small"
            fullWidth
            type="number"
            label="Max km"
            slotProps={{ htmlInput: { step: 0.1 } }}
            value={v.max_km}
            onChange={(e) => set("max_km", e.target.value)}
          />
        </Stack>

        <Stack direction="row" spacing={2}>
          <TextField
            size="small"
            fullWidth
            type="number"
            label="Fee incl. GST (₹)"
            slotProps={{ htmlInput: { step: 0.01 } }}
            value={v.fee}
            onChange={(e) => setFee(e.target.value)}
          />
          <TextField
            size="small"
            fullWidth
            type="number"
            label="Fee ex-GST"
            slotProps={{ htmlInput: { step: 0.01 } }}
            value={v.fee_ex_gst}
            onChange={(e) => set("fee_ex_gst", e.target.value)}
          />
          <TextField
            size="small"
            fullWidth
            type="number"
            label="GST"
            slotProps={{ htmlInput: { step: 0.01 } }}
            value={v.gst_amount}
            onChange={(e) => set("gst_amount", e.target.value)}
          />
        </Stack>

        <FormControlLabel
          control={
            <Switch checked={v.is_current} onChange={(e) => set("is_current", e.target.checked)} />
          }
          label={
            <Typography variant="body2">
              Current {v.is_current ? "" : "(switched off: not used for pricing)"}
            </Typography>
          }
        />

        {err ? <Alert severity="error">{err}</Alert> : null}

        <Button type="submit" variant="contained" disabled={busy} fullWidth>
          {busy ? "Saving…" : tier ? "Save changes" : "+ Add tier"}
        </Button>
      </Stack>
    </Box>
  );
}
