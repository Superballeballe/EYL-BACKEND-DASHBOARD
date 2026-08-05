"use client";

import { useState } from "react";
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

type KnightOpt = { id: string; display_name: string; role: string | null };

export default function SalaryRecordForm({
  knights,
  knightId,
  defaultMonth = "",
  onSuccess,
}: {
  knights?: KnightOpt[];
  knightId?: string;
  defaultMonth?: string;
  onSuccess?: () => void;
}) {
  const [knight, setKnight] = useState(knightId ?? "");
  const [month, setMonth] = useState(defaultMonth);
  const [travel, setTravel] = useState("");
  const [salary, setSalary] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const kid = knightId ?? knight;
    if (!kid) {
      setErr("Select a knight");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/salaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        knight_id: kid,
        month: month.length === 7 ? `${month}-01` : month,
        travel: travel || 0,
        salary: salary || 0,
      }),
    });
    setBusy(false);
    if (res.ok) {
      if (!knightId) {
        setKnight("");
        setTravel("");
        setSalary("");
      } else {
        setTravel("");
        setSalary("");
      }
      onSuccess?.();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Save failed");
    }
  }

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2.5}>
        {!knightId && knights ? (
          <FormControl fullWidth size="small" required>
            <InputLabel id="salary-knight">Knight</InputLabel>
            <Select
              labelId="salary-knight"
              label="Knight"
              value={knight}
              onChange={(e) => setKnight(e.target.value)}
            >
              {knights.map((k) => (
                <MenuItem key={k.id} value={k.id}>
                  {k.display_name}
                  {k.role ? ` · ${k.role}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        <TextField
          size="small"
          fullWidth
          required
          type="month"
          label="Month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Stack direction="row" spacing={2}>
          <TextField
            size="small"
            fullWidth
            type="number"
            label="Travel (₹)"
            value={travel}
            onChange={(e) => setTravel(e.target.value)}
            slotProps={{ htmlInput: { step: 0.01 } }}
          />
          <TextField
            size="small"
            fullWidth
            type="number"
            label="Salary (₹)"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            slotProps={{ htmlInput: { step: 0.01 } }}
          />
        </Stack>

        {err ? <Alert severity="error">{err}</Alert> : null}

        <Button type="submit" variant="contained" disabled={busy} fullWidth>
          {busy ? "Saving…" : "+ Save salary"}
        </Button>
      </Stack>
    </Box>
  );
}
