"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import { EmptyState } from "@/components/ui";
import { isSundayISO, weekdayLong } from "@/lib/format";
import { tableShellSx } from "@/lib/surface";

type KnightOpt = { id: string; display_name: string; role: string | null; default_location: string | null };

type Row = {
  knight_name: string;
  knight_id: string | null;
  role: "walker" | "biker";
  location: string;
  shift_time: string;
  status: "working" | "leave" | "half_day";
};

const emptyRow = (role: "walker" | "biker"): Row => ({
  knight_name: "",
  knight_id: null,
  role,
  location: "",
  shift_time: "",
  status: "working",
});

const STATUS_LABEL: Record<Row["status"], string> = {
  working: "Working",
  leave: "Leave",
  half_day: "Half day",
};

function toTimeInputValue(raw: string): string {
  const s = raw.trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return "";
  let h = parseInt(m[1], 10);
  const min = m[2] ?? "00";
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function parseShiftRange(raw: string): { start: string; end: string } {
  if (!raw.trim()) return { start: "", end: "" };
  const parts = raw.split(/\s*[-–]\s*/);
  if (parts.length >= 2) {
    return { start: toTimeInputValue(parts[0]), end: toTimeInputValue(parts[1]) };
  }
  return { start: toTimeInputValue(raw), end: "" };
}

function formatShiftRange(start: string, end: string): string {
  if (start && end) return `${start} – ${end}`;
  return start || end || "";
}

const timeFieldSx = { "& .MuiOutlinedInput-root": { bgcolor: "#fff" }, minWidth: 108 };

export default function LineupEditor({
  knights,
  initialDate,
}: {
  knights: KnightOpt[];
  initialDate: string;
}) {
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/lineup?date=${d}`);
      if (!res.ok) throw new Error("Could not load lineup");
      const data = await res.json();
      const loaded: Row[] = (data.assignments ?? [])
        .filter((a: Record<string, unknown>) => a.status !== "leave")
        .map((a: Record<string, unknown>) => ({
        knight_name: (a.knight_name as string) ?? (a.knights as { display_name?: string })?.display_name ?? "",
        knight_id: (a.knight_id as string) ?? null,
        role: a.role === "biker" ? "biker" : "walker",
        location: (a.location as string) ?? "",
        shift_time: (a.shift_time as string) ?? "",
        status: (a.status as Row["status"]) ?? "working",
      }));
      setRows(loaded);
    } catch {
      setErr("Failed to load lineup for this date.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const walkers = useMemo(
    () => rows.map((r, i) => ({ r, i })).filter((x) => x.r.role === "walker"),
    [rows],
  );
  const bikers = useMemo(
    () => rows.map((r, i) => ({ r, i })).filter((x) => x.r.role === "biker"),
    [rows],
  );

  const onLeave = useMemo(() => {
    const linedIds = new Set(rows.filter((r) => r.knight_id).map((r) => r.knight_id));
    const linedNames = new Set(
      rows.filter((r) => r.knight_name.trim()).map((r) => r.knight_name.trim().toLowerCase()),
    );
    return knights.filter(
      (k) => !linedIds.has(k.id) && !linedNames.has(k.display_name.toLowerCase()),
    );
  }, [knights, rows]);

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function onNameChange(i: number, name: string) {
    const k = knights.find((x) => x.display_name.toLowerCase() === name.trim().toLowerCase());
    update(i, {
      knight_name: name,
      knight_id: k?.id ?? null,
      ...(k && !rows[i]?.location && k.default_location ? { location: k.default_location } : {}),
    });
  }

  function addRow(role: "walker" | "biker") {
    setRows((r) => [...r, emptyRow(role)]);
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/lineup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_date: date,
          is_sunday: isSundayISO(date),
          note: null,
          assignments: [
            ...rows
              .filter((r) => r.knight_name.trim())
              .map((r, i) => ({ ...r, position: i })),
            ...onLeave.map((k, i) => ({
              knight_name: k.display_name,
              knight_id: k.id,
              role: k.role === "biker" ? ("biker" as const) : ("walker" as const),
              location: "",
              shift_time: "",
              status: "leave" as const,
              position: rows.length + i,
            })),
          ],
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setMsg(`Saved · ${d.walker_count} walkers, ${d.biker_count} bikers${onLeave.length ? ` · ${onLeave.length} on leave` : ""}.`);
      } else {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  const weekday = weekdayLong(date);
  const sunday = isSundayISO(date);

  return (
    <Box>
      <Box
        sx={{
          mb: 2.5,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          overflow: "hidden",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            p: 2,
            alignItems: { sm: "center" },
            justifyContent: "space-between",
            bgcolor: "grey.50",
          }}
        >
          <Box>
            <Typography variant="h1">Daily Lineup</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
              Who is working, where, and their shift
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {walkers.length} walkers · {bikers.length} bikers
            </Typography>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={save}
              disabled={saving || loading}
            >
              {saving ? "Saving…" : "Save lineup"}
            </Button>
          </Stack>
        </Stack>

        <Divider />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ p: 2, alignItems: { md: "center" }, flexWrap: "wrap" }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <TextField
              size="small"
              type="date"
              label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {weekday ? (
              <Chip
                size="small"
                label={weekday}
                color={sunday ? "warning" : "default"}
                variant={sunday ? "filled" : "outlined"}
              />
            ) : null}
            {sunday ? (
              <Typography variant="caption" sx={{ color: "warning.dark" }}>
                Sunday shift
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      </Box>

      {msg ? (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setMsg(null)}>
          {msg}
        </Alert>
      ) : null}
      {err ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>
          {err}
        </Alert>
      ) : null}

      {loading ? (
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Loading…
        </Typography>
      ) : null}

      <datalist id="lineup-knights">
        {knights.map((k) => (
          <option key={k.id} value={k.display_name} />
        ))}
      </datalist>

      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          alignItems: "start",
        }}
      >
        <RoleTable
          title="Walkers"
          rows={walkers}
          onName={onNameChange}
          update={update}
          remove={removeRow}
          onAdd={() => addRow("walker")}
        />
        <RoleTable
          title="Bikers"
          rows={bikers}
          onName={onNameChange}
          update={update}
          remove={removeRow}
          onAdd={() => addRow("biker")}
        />
      </Box>

      <Box sx={{ mt: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
          <Typography variant="h2">On leave</Typography>
          <Chip size="small" label={onLeave.length} variant="outlined" color={onLeave.length ? "warning" : "default"} />
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
          Active knights not added to today&apos;s lineup
        </Typography>
        {onLeave.length === 0 ? (
          <EmptyState message="Everyone active is on today's lineup." compact />
        ) : (
          <TableContainer sx={tableShellSx}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Knight</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {onLeave.map((k) => (
                  <TableRow key={k.id} hover>
                    <TableCell>{k.display_name}</TableCell>
                    <TableCell sx={{ textTransform: "capitalize" }}>{k.role ?? "—"}</TableCell>
                    <TableCell>
                      <Chip size="small" label="On leave" color="warning" variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
}

function RoleTable({
  title,
  rows,
  onName,
  update,
  remove,
  onAdd,
}: {
  title: string;
  rows: { r: Row; i: number }[];
  onName: (i: number, v: string) => void;
  update: (i: number, patch: Partial<Row>) => void;
  remove: (i: number) => void;
  onAdd: () => void;
}) {
  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="h2">{title}</Typography>
          <Chip size="small" label={rows.length} variant="outlined" />
        </Stack>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={onAdd}>
          Add
        </Button>
      </Stack>

      {rows.length === 0 ? (
        <EmptyState message={`No ${title.toLowerCase()} added yet.`} />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Knight</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Shift (start – end)</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" sx={{ width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(({ r, i }) => (
                <TableRow key={`${title}-${i}`} hover>
                  <TableCell sx={{ minWidth: 120 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={r.knight_name}
                      onChange={(e) => onName(i, e.target.value)}
                      placeholder="Knight"
                      slotProps={{
                        htmlInput: { list: "lineup-knights" },
                      }}
                      sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff" } }}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 110 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={r.location}
                      onChange={(e) => update(i, { location: e.target.value })}
                      placeholder="Location"
                      sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff" } }}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 230 }}>
                    {(() => {
                      const { start, end } = parseShiftRange(r.shift_time);
                      return (
                        <Stack direction="row" spacing={0.75}>
                          <TextField
                            size="small"
                            type="time"
                            label="Start"
                            value={start}
                            onChange={(e) =>
                              update(i, { shift_time: formatShiftRange(e.target.value, end) })
                            }
                            slotProps={{ inputLabel: { shrink: true } }}
                            sx={timeFieldSx}
                          />
                          <TextField
                            size="small"
                            type="time"
                            label="End"
                            value={end}
                            onChange={(e) =>
                              update(i, { shift_time: formatShiftRange(start, e.target.value) })
                            }
                            slotProps={{ inputLabel: { shrink: true } }}
                            sx={timeFieldSx}
                          />
                        </Stack>
                      );
                    })()}
                  </TableCell>
                  <TableCell sx={{ minWidth: 110 }}>
                    <Select
                      size="small"
                      fullWidth
                      value={r.status}
                      onChange={(e) => update(i, { status: e.target.value as Row["status"] })}
                      sx={{ bgcolor: "#fff" }}
                    >
                      <MenuItem value="working">{STATUS_LABEL.working}</MenuItem>
                      <MenuItem value="half_day">{STATUS_LABEL.half_day}</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="Remove row"
                      onClick={() => remove(i)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
