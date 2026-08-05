"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";

export default function KnightForm({
  mode,
  id,
  initial,
  onSuccess,
}: {
  mode: "new" | "edit";
  id?: string;
  initial?: Record<string, unknown> | null;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState({
    full_name: (initial?.full_name as string) ?? "",
    display_name: (initial?.display_name as string) ?? "",
    role: (initial?.role as string) ?? "",
    joining_date: (initial?.joining_date as string) ?? "",
    default_location: (initial?.default_location as string) ?? "",
    active: (initial?.active as boolean) ?? true,
    note: (initial?.note as string) ?? "",
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
    const res = await fetch(mode === "new" ? "/api/knights" : `/api/knights/${id}`, {
      method: mode === "new" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    setBusy(false);
    if (res.ok) {
      if (mode === "new") {
        setV({
          full_name: "",
          display_name: "",
          role: "",
          joining_date: "",
          default_location: "",
          active: true,
          note: "",
        });
      }
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            size="small"
            fullWidth
            required
            label="Full name"
            value={v.full_name}
            onChange={(e) => set("full_name", e.target.value)}
          />
          <TextField
            size="small"
            fullWidth
            required
            label="Display name"
            placeholder="e.g. Vilas"
            value={v.display_name}
            onChange={(e) => set("display_name", e.target.value)}
          />
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel id="knight-role-label">Role</InputLabel>
            <Select
              labelId="knight-role-label"
              label="Role"
              value={v.role}
              onChange={(e) => set("role", e.target.value)}
            >
              <MenuItem value="">—</MenuItem>
              <MenuItem value="walker">Walker</MenuItem>
              <MenuItem value="biker">Biker</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            fullWidth
            type="date"
            label="Joining date"
            value={v.joining_date}
            onChange={(e) => set("joining_date", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
          <TextField
            size="small"
            fullWidth
            label="Default location"
            value={v.default_location}
            onChange={(e) => set("default_location", e.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={v.active}
                onChange={(e) => set("active", e.target.checked)}
                color="primary"
              />
            }
            label="Active"
            sx={{ ml: 0, minWidth: 110 }}
          />
        </Stack>

        <TextField
          size="small"
          fullWidth
          label="Note"
          value={v.note}
          onChange={(e) => set("note", e.target.value)}
        />

        {err ? <Alert severity="error">{err}</Alert> : null}

        <Button type="submit" variant="contained" disabled={busy} fullWidth={mode === "new"}>
          {busy ? "Saving…" : mode === "new" ? "+ Add knight" : "Save changes"}
        </Button>
      </Stack>
    </Box>
  );
}
