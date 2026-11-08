"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { EmptyState } from "@/components/ui";
import { addDays, formatDay, type Holiday } from "@/lib/holidays";
import { RADIUS, tableShellSx } from "@/lib/surface";

const WHERE = "The EYL app, the WhatsApp bot and the knight app";

async function send(url: string, init: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    if (res.ok) return null;
    const body = await res.json().catch(() => ({}));
    return body.error || "That didn't save. Try again.";
  } catch {
    return "Couldn't reach the server. Check your connection and try again.";
  }
}

export default function HolidaysBoard({ holidays, today }: { holidays: Holiday[]; today: string }) {
  const router = useRouter();
  const closedToday = holidays.some((h) => h.day === today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState(addDays(today, 1));
  const [note, setNote] = useState("");

  const run = async (url: string, init: RequestInit, after?: () => void) => {
    setBusy(true);
    setError(null);
    const failed = await send(url, init);
    setBusy(false);
    if (failed) return setError(failed);
    after?.();
    router.refresh();
  };

  const toggleToday = () =>
    closedToday
      ? run(`/api/holidays/${today}`, { method: "DELETE" })
      : run("/api/holidays", { method: "POST", body: JSON.stringify({ day: today }) });

  const addDay = () =>
    run("/api/holidays", { method: "POST", body: JSON.stringify({ day, note }) }, () => setNote(""));

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: `${RADIUS}px` }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Not working today</Typography>
            <Typography variant="body2" color="text.secondary">
              {formatDay(today)}.{" "}
              {closedToday
                ? "The EYL app and the WhatsApp bot show “Not accepting orders today”; knights see “no new jobs”. Orders already placed still run."
                : "Turn on to stop new orders for the rest of today."}
            </Typography>
          </Box>
          <Switch
            checked={closedToday}
            onChange={toggleToday}
            disabled={busy}
            slotProps={{ input: { "aria-label": "Not working today" } }}
          />
        </Stack>
        {closedToday ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            No new bookings today from the app or WhatsApp. Turn it off to take orders again straight away.
          </Alert>
        ) : null}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: `${RADIUS}px` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>Close another day</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {WHERE} take no orders on that day, and no pickup can be booked for it.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "flex-start" } }}>
          <TextField
            type="date"
            label="Day"
            size="small"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today, max: addDays(today, 365) } }}
          />
          <TextField
            label="Note (optional)"
            size="small"
            placeholder="e.g. Diwali"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <Button variant="contained" onClick={addDay} disabled={busy || !day}>
            Close day
          </Button>
        </Stack>
      </Paper>

      {holidays.length === 0 ? (
        <EmptyState message="No closed days coming up. Orders are open every day." />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Day</TableCell>
                <TableCell>Note</TableCell>
                <TableCell>Closed by</TableCell>
                <TableCell align="right" sx={{ width: 120 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {holidays.map((h) => (
                <TableRow key={h.day}>
                  <TableCell>
                    {formatDay(h.day)}
                    {h.day === today ? " (today)" : ""}
                  </TableCell>
                  <TableCell>{h.note || "—"}</TableCell>
                  <TableCell>{h.created_by || "—"}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => run(`/api/holidays/${h.day}`, { method: "DELETE" })}
                      disabled={busy}
                    >
                      Reopen
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
