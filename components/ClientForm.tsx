"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Stack, TextField } from "@mui/material";

export default function ClientForm({
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
    client_name: (initial?.client_name as string) ?? "",
    company_name: (initial?.company_name as string) ?? "",
    gst_no: (initial?.gst_no as string) ?? "",
    phone: (initial?.phone as string) ?? "",
    address: (initial?.address as string) ?? "",
    note: (initial?.note as string) ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(k: string, val: string) {
    setV((s) => ({ ...s, [k]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch(mode === "new" ? "/api/clients" : `/api/clients/${id}`, {
      method: mode === "new" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    setBusy(false);
    if (res.ok) {
      if (mode === "new") {
        setV({
          client_name: "",
          company_name: "",
          gst_no: "",
          phone: "",
          address: "",
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
            label="Client name"
            value={v.client_name}
            onChange={(e) => set("client_name", e.target.value)}
          />
          <TextField
            size="small"
            fullWidth
            label="Company name"
            value={v.company_name}
            onChange={(e) => set("company_name", e.target.value)}
          />
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            size="small"
            fullWidth
            label="GST no."
            value={v.gst_no}
            onChange={(e) => set("gst_no", e.target.value)}
          />
          <TextField
            size="small"
            fullWidth
            label="Phone"
            value={v.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Stack>

        <TextField
          size="small"
          fullWidth
          multiline
          minRows={2}
          label="Address"
          value={v.address}
          onChange={(e) => set("address", e.target.value)}
        />

        <TextField
          size="small"
          fullWidth
          label="Note"
          value={v.note}
          onChange={(e) => set("note", e.target.value)}
        />

        {err ? <Alert severity="error">{err}</Alert> : null}

        <Button type="submit" variant="contained" disabled={busy} fullWidth={mode === "new"}>
          {busy ? "Saving…" : mode === "new" ? "+ Add client" : "Save changes"}
        </Button>
      </Stack>
    </Box>
  );
}
