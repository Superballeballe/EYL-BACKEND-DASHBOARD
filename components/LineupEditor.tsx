"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
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
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import TodayIcon from "@mui/icons-material/Today";
import { EmptyState } from "@/components/ui";
import { fmtDate, isSundayISO, todayISO, weekdayLong } from "@/lib/format";
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
  shift_time: "09:00 – 18:00",
  status: "working",
});

const STATUS_LABEL: Record<Row["status"], string> = {
  working: "Working",
  leave: "Leave",
  half_day: "Half day",
};

const SHIFT_PRESETS = [
  { label: "Morning", start: "08:00", end: "14:00" },
  { label: "Full day", start: "09:00", end: "18:00" },
  { label: "Evening", start: "14:00", end: "20:30" },
] as const;

function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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

const timeFieldSx = { "& .MuiOutlinedInput-root": { bgcolor: "#fff" }, minWidth: 118 };

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
          knight_name:
            (a.knight_name as string) ?? (a.knights as { display_name?: string })?.display_name ?? "",
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

  const linedIds = useMemo(
    () => new Set(rows.filter((r) => r.knight_id).map((r) => r.knight_id as string)),
    [rows],
  );
  const linedNames = useMemo(
    () => new Set(rows.filter((r) => r.knight_name.trim()).map((r) => r.knight_name.trim().toLowerCase())),
    [rows],
  );

  const onLeave = useMemo(
    () =>
      knights.filter(
        (k) => !linedIds.has(k.id) && !linedNames.has(k.display_name.toLowerCase()),
      ),
    [knights, linedIds, linedNames],
  );

  const availableKnights = useMemo(
    () =>
      knights.filter(
        (k) => !linedIds.has(k.id) && !linedNames.has(k.display_name.toLowerCase()),
      ),
    [knights, linedIds, linedNames],
  );

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function pickKnight(i: number, knightId: string) {
    const k = knights.find((x) => x.id === knightId);
    if (!k) {
      update(i, { knight_id: null, knight_name: "" });
      return;
    }
    update(i, {
      knight_id: k.id,
      knight_name: k.display_name,
      location: rows[i]?.location?.trim() ? rows[i].location : (k.default_location ?? ""),
    });
  }

  function addRow(role: "walker" | "biker") {
    setRows((r) => [...r, emptyRow(role)]);
  }

  function addKnightFromLeave(k: KnightOpt) {
    const role: "walker" | "biker" = k.role === "biker" ? "biker" : "walker";
    setRows((r) => [
      ...r,
      {
        knight_name: k.display_name,
        knight_id: k.id,
        role,
        location: k.default_location ?? "",
        shift_time: "09:00 – 18:00",
        status: "working",
      },
    ]);
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
        setMsg(
          `Saved · ${d.walker_count} walkers, ${d.biker_count} bikers${onLeave.length ? ` · ${onLeave.length} on leave` : ""}.`,
        );
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
  const isToday = date === todayISO();

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
          sx={{ p: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <ButtonGroup variant="outlined" size="small">
              <IconButton
                aria-label="Previous day"
                onClick={() => setDate((d) => shiftDate(d, -1))}
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: "4px 0 0 4px" }}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <Button
                startIcon={<TodayIcon />}
                onClick={() => setDate(todayISO())}
                disabled={isToday}
                sx={{ px: 1.5 }}
              >
                Today
              </Button>
              <IconButton
                aria-label="Next day"
                onClick={() => setDate((d) => shiftDate(d, 1))}
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: "0 4px 4px 0" }}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </ButtonGroup>

            <TextField
              size="small"
              type="date"
              label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {fmtDate(date)}
              </Typography>
              {weekday ? (
                <Chip
                  size="small"
                  label={weekday}
                  color={sunday ? "warning" : "default"}
                  variant={sunday ? "filled" : "outlined"}
                />
              ) : null}
              {isToday ? <Chip size="small" color="primary" variant="outlined" label="Today" /> : null}
              {sunday ? (
                <Typography variant="caption" sx={{ color: "warning.dark" }}>
                  Sunday shift
                </Typography>
              ) : null}
            </Stack>
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
          availableKnights={availableKnights}
          knights={knights}
          pickKnight={pickKnight}
          update={update}
          remove={removeRow}
          onAdd={() => addRow("walker")}
        />
        <RoleTable
          title="Bikers"
          rows={bikers}
          availableKnights={availableKnights}
          knights={knights}
          pickKnight={pickKnight}
          update={update}
          remove={removeRow}
          onAdd={() => addRow("biker")}
        />
      </Box>

      <Box sx={{ mt: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
          <Typography variant="h2">Available / on leave</Typography>
          <Chip
            size="small"
            label={onLeave.length}
            variant="outlined"
            color={onLeave.length ? "warning" : "default"}
          />
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
          Tap a knight to add them to today&apos;s lineup (defaults to full-day shift).
        </Typography>
        {onLeave.length === 0 ? (
          <EmptyState message="Everyone active is already on this day's lineup." compact />
        ) : (
          <TableContainer sx={tableShellSx}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Knight</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {onLeave.map((k) => (
                  <TableRow key={k.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{k.display_name}</TableCell>
                    <TableCell sx={{ textTransform: "capitalize" }}>{k.role ?? "—"}</TableCell>
                    <TableCell>
                      <Chip size="small" label="Not scheduled" color="warning" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => addKnightFromLeave(k)}
                      >
                        Add to lineup
                      </Button>
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
  availableKnights,
  knights,
  pickKnight,
  update,
  remove,
  onAdd,
}: {
  title: string;
  rows: { r: Row; i: number }[];
  availableKnights: KnightOpt[];
  knights: KnightOpt[];
  pickKnight: (i: number, knightId: string) => void;
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
        <EmptyState message={`No ${title.toLowerCase()} yet — add a row or pick someone below.`} />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Knight</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Shift</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" sx={{ width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(({ r, i }) => {
                const { start, end } = parseShiftRange(r.shift_time);
                const options = [
                  ...knights.filter((k) => k.id === r.knight_id),
                  ...availableKnights,
                ];
                const seen = new Set<string>();
                const uniqueOptions = options.filter((k) => {
                  if (seen.has(k.id)) return false;
                  seen.add(k.id);
                  return true;
                });

                return (
                  <TableRow key={`${title}-${i}`} hover>
                    <TableCell sx={{ minWidth: 140 }}>
                      <Select
                        size="small"
                        fullWidth
                        displayEmpty
                        value={r.knight_id ?? ""}
                        onChange={(e) => pickKnight(i, e.target.value)}
                        sx={{ bgcolor: "#fff" }}
                        renderValue={(value) => {
                          if (!value) return <em style={{ color: "#94a3b8" }}>Select knight</em>;
                          return knights.find((k) => k.id === value)?.display_name ?? r.knight_name;
                        }}
                      >
                        <MenuItem value="">
                          <em>Select knight</em>
                        </MenuItem>
                        {uniqueOptions.map((k) => (
                          <MenuItem key={k.id} value={k.id}>
                            {k.display_name}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell sx={{ minWidth: 110 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={r.location}
                        onChange={(e) => update(i, { location: e.target.value })}
                        placeholder="Area / hub"
                        sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff" } }}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 260 }}>
                      <Stack spacing={0.75}>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                          <TextField
                            size="small"
                            type="time"
                            label="Start"
                            value={start}
                            onChange={(e) =>
                              update(i, { shift_time: formatShiftRange(e.target.value, end) })
                            }
                            slotProps={{
                              inputLabel: { shrink: true },
                              htmlInput: { step: 900 },
                            }}
                            sx={timeFieldSx}
                          />
                          <Typography variant="caption" sx={{ color: "text.secondary", pt: 1 }}>
                            →
                          </Typography>
                          <TextField
                            size="small"
                            type="time"
                            label="End"
                            value={end}
                            onChange={(e) =>
                              update(i, { shift_time: formatShiftRange(start, e.target.value) })
                            }
                            slotProps={{
                              inputLabel: { shrink: true },
                              htmlInput: { step: 900 },
                            }}
                            sx={timeFieldSx}
                          />
                        </Stack>
                        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                          {SHIFT_PRESETS.map((p) => {
                            const active = start === p.start && end === p.end;
                            return (
                              <Chip
                                key={p.label}
                                size="small"
                                label={p.label}
                                variant={active ? "filled" : "outlined"}
                                color={active ? "primary" : "default"}
                                onClick={() =>
                                  update(i, { shift_time: formatShiftRange(p.start, p.end) })
                                }
                                sx={{ cursor: "pointer" }}
                              />
                            );
                          })}
                        </Stack>
                      </Stack>
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
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
