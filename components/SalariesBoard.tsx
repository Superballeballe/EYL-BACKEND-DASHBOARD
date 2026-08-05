"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import SalaryRecordForm from "@/components/SalaryRecordForm";
import { EmptyState } from "@/components/ui";
import { money } from "@/lib/format";
import { tableShellSx } from "@/lib/surface";

type KnightOpt = { id: string; display_name: string; role: string | null };
type Cell = { travel: string; salary: string };

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SalariesBoard({ knights }: { knights: KnightOpt[] }) {
  const [month, setMonth] = useState(currentMonth());
  const [role, setRole] = useState("all");
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (role === "all") return knights;
    return knights.filter((k) => k.role === role);
  }, [knights, role]);

  const load = useCallback(
    async (m: string) => {
      setLoading(true);
      setMsg(null);
      const res = await fetch(`/api/salaries?month=${m}-01`);
      const data = await res.json();
      const next: Record<string, Cell> = {};
      for (const k of knights) next[k.id] = { travel: "", salary: "" };
      for (const s of data.data ?? []) {
        next[s.knight_id] = {
          travel: s.travel != null ? String(s.travel) : "",
          salary: s.salary != null ? String(s.salary) : "",
        };
      }
      setCells(next);
      setLoading(false);
    },
    [knights],
  );

  useEffect(() => {
    if (knights.length > 0) load(month);
  }, [month, load, knights.length]);

  function setCell(knightId: string, field: keyof Cell, value: string) {
    setCells((c) => ({ ...c, [knightId]: { ...c[knightId], [field]: value } }));
  }

  const totals = useMemo(() => {
    let travel = 0;
    let salary = 0;
    for (const k of filtered) {
      travel += Number(cells[k.id]?.travel) || 0;
      salary += Number(cells[k.id]?.salary) || 0;
    }
    return { travel, salary, total: travel + salary };
  }, [cells, filtered]);

  async function saveAll() {
    setSaving(true);
    setMsg(null);
    const toSave = filtered.filter((k) => {
      const c = cells[k.id];
      return c && (c.travel !== "" || c.salary !== "");
    });
    let okCount = 0;
    for (const k of toSave) {
      const c = cells[k.id];
      const res = await fetch("/api/salaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knight_id: k.id,
          month: `${month}-01`,
          travel: c.travel || 0,
          salary: c.salary || 0,
        }),
      });
      if (res.ok) okCount++;
    }
    setSaving(false);
    setMsg(`Saved ${okCount} of ${toSave.length} rows.`);
    await load(month);
  }

  if (knights.length === 0) {
    return (
      <EmptyState message="Add knights first (or run the import), then record salaries here." />
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: { sm: "center" },
          mb: 2.5,
          p: 2,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
          <TextField
            size="small"
            type="month"
            label="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="salary-role">Role</InputLabel>
            <Select
              labelId="salary-role"
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <MenuItem value="all">All roles</MenuItem>
              <MenuItem value="walker">Walker</MenuItem>
              <MenuItem value="biker">Biker</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Showing {filtered.length} knight{filtered.length === 1 ? "" : "s"}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<SaveIcon />}
            onClick={saveAll}
            disabled={saving || loading}
          >
            {saving ? "Saving…" : "Save all"}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Record salary
          </Button>
        </Stack>
      </Stack>

      {msg ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg(null)}>
          {msg}
        </Alert>
      ) : null}

      {loading ? (
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Loading…
        </Typography>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState message="No knights match this filter." />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Knight</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Travel (₹)</TableCell>
                <TableCell>Salary (₹)</TableCell>
                <TableCell>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((k) => {
                const c = cells[k.id] ?? { travel: "", salary: "" };
                const total = (Number(c.travel) || 0) + (Number(c.salary) || 0);
                return (
                  <TableRow key={k.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{k.display_name}</TableCell>
                    <TableCell>
                      {k.role ? (
                        <Chip size="small" label={k.role} variant="outlined" />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={c.travel}
                        onChange={(e) => setCell(k.id, "travel", e.target.value)}
                        slotProps={{ htmlInput: { step: 0.01 } }}
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={c.salary}
                        onChange={(e) => setCell(k.id, "salary", e.target.value)}
                        slotProps={{ htmlInput: { step: 0.01 } }}
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {money(total)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow sx={{ bgcolor: "#f8fafc" }}>
                <TableCell colSpan={2} sx={{ fontWeight: 700 }}>
                  Total
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{money(totals.travel)}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{money(totals.salary)}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{money(totals.total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 6 }}>
          Record salary
          <IconButton
            aria-label="Close"
            onClick={() => setOpen(false)}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <SalaryRecordForm
            knights={knights}
            defaultMonth={month}
            onSuccess={() => {
              setOpen(false);
              load(month);
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
