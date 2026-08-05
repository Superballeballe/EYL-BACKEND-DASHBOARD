"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";

const PROVIDERS = ["eyl", "eyl_cake", "fudpro", "wefast", "uber", "porter"];

export default function RateTierForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    provider: "eyl",
    label: "",
    min_km: "",
    max_km: "",
    fee: "",
    fee_ex_gst: "",
    gst_amount: "",
    is_current: true,
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
    const res = await fetch("/api/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    setBusy(false);
    if (res.ok) {
      setV({
        provider: v.provider,
        label: "",
        min_km: "",
        max_km: "",
        fee: "",
        fee_ex_gst: "",
        gst_amount: "",
        is_current: true,
      });
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
            {PROVIDERS.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          fullWidth
          label="Label"
          placeholder="e.g. 0 kms - 3 kms"
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
            label="Fee (₹)"
            slotProps={{ htmlInput: { step: 0.01 } }}
            value={v.fee}
            onChange={(e) => set("fee", e.target.value)}
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
        </Stack>

        {err ? <Alert severity="error">{err}</Alert> : null}

        <Button type="submit" variant="contained" disabled={busy} fullWidth>
          {busy ? "Saving…" : "+ Add tier"}
        </Button>
      </Stack>
    </Box>
  );
}
