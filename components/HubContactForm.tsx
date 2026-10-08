"use client";

import { useState } from "react";
import { Alert, Box, Button, FormControlLabel, Stack, Switch, TextField } from "@mui/material";
import type { HubContact } from "@/lib/types";

type HubContactFormProps = {
  contactId?: string;
  onSuccess?: (contact: HubContact) => void;
  initial?: Partial<Pick<HubContact, "label" | "description" | "phone" | "sort_order" | "active">>;
};

export default function HubContactForm({ contactId, onSuccess, initial }: HubContactFormProps) {
  const [v, setV] = useState({
    label: initial?.label ?? "",
    description: initial?.description ?? "",
    phone: initial?.phone ?? "+91",
    sort_order: String(initial?.sort_order ?? 0),
    active: initial?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(k: keyof typeof v, val: string | boolean) {
    setV((s) => ({ ...s, [k]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const payload = { ...v, sort_order: Number(v.sort_order) || 0 };
    const res = await fetch(contactId ? `/api/hub-contacts/${contactId}` : "/api/hub-contacts", {
      method: contactId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      onSuccess?.((await res.json()) as HubContact);
      return;
    }
    const d = await res.json().catch(() => ({}));
    const fieldErrors = d.details?.fieldErrors as Record<string, string[]> | undefined;
    const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : undefined;
    setErr(firstFieldError || d.error || "Save failed");
  }

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2.5}>
        <TextField
          size="small"
          fullWidth
          label="Label"
          placeholder="Dispatch"
          value={v.label}
          onChange={(e) => set("label", e.target.value)}
          slotProps={{ htmlInput: { maxLength: 40 } }}
          helperText={`${v.label.length}/40`}
          required
        />

        <TextField
          size="small"
          fullWidth
          label="Description (optional)"
          placeholder="Pickup issues"
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          helperText="Shown under the label in the app's sheet"
        />

        <TextField
          size="small"
          fullWidth
          label="Phone"
          placeholder="+919876543210"
          value={v.phone}
          onChange={(e) => set("phone", e.target.value)}
          helperText="+ and the country code, e.g. +919876543210"
          required
        />

        <TextField
          size="small"
          fullWidth
          type="number"
          label="Sort order"
          value={v.sort_order}
          onChange={(e) => set("sort_order", e.target.value)}
          slotProps={{ htmlInput: { step: 1 } }}
          helperText="Lower numbers show first; equal numbers sort by label"
        />

        <FormControlLabel
          control={<Switch checked={v.active} onChange={(e) => set("active", e.target.checked)} />}
          label="Active (shown in the app)"
        />

        {err ? <Alert severity="error">{err}</Alert> : null}

        <Button type="submit" variant="contained" disabled={busy} fullWidth>
          {busy ? "Saving…" : contactId ? "Save changes" : "Add contact"}
        </Button>
      </Stack>
    </Box>
  );
}
