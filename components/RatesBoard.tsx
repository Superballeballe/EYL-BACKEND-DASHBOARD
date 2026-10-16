"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
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
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RateTierForm, { APP_PRICE_PROVIDER } from "@/components/RateTierForm";
import { EmptyState } from "@/components/ui";
import { money } from "@/lib/format";
import { panelSx, tableShellSx } from "@/lib/surface";
import type { RateTier } from "@/lib/types";

export default function RatesBoard({ tiers }: { tiers: RateTier[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RateTier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RateTier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [provider, setProvider] = useState("all");

  const providers = useMemo(
    () => [...new Set(tiers.map((t) => t.provider))].sort(),
    [tiers],
  );

  const rows = useMemo(
    () => (provider === "all" ? tiers : tiers.filter((t) => t.provider === provider)),
    [provider, tiers],
  );

  async function removeTier() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/rates/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setDeleteTarget(null);
      router.refresh();
      return;
    }
    const d = await res.json().catch(() => ({}));
    setDeleteError(d.error || "Delete failed");
  }

  const closeForm = () => {
    setOpen(false);
    setEditTarget(null);
  };

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
          ...panelSx,
        }}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="provider-filter">Provider</InputLabel>
          <Select
            labelId="provider-filter"
            label="Provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <MenuItem value="all">All Providers</MenuItem>
            {providers.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Showing {rows.length} tier{rows.length === 1 ? "" : "s"}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Add rate tier
          </Button>
        </Stack>
      </Stack>

      {rows.length === 0 ? (
        <EmptyState message="No rate tiers yet. Add one to get started." />
      ) : (
        <TableContainer sx={tableShellSx}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Provider</TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Range (Km)</TableCell>
                <TableCell>Fee (₹)</TableCell>
                <TableCell>Fee Ex-GST</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right"> </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>
                    <Chip size="small" label={t.provider} variant="outlined" />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{t.label ?? "—"}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>
                    {t.min_km ?? "?"} – {t.max_km ?? "?"}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {money(t.fee)}
                  </TableCell>
                  <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {money(t.fee_ex_gst)}
                  </TableCell>
                  <TableCell>
                    {t.is_current ? (
                      <Chip size="small" color="primary" label="current" />
                    ) : (
                      <Chip size="small" variant="outlined" label="old" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                      <Tooltip title="Edit rate card">
                        <IconButton
                          size="small"
                          aria-label={`Edit ${t.label ?? "rate card"}`}
                          onClick={() => setEditTarget(t)}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete rate card">
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={`Delete ${t.label ?? "rate card"}`}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(t);
                          }}
                        >
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open || !!editTarget} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 6 }}>
          {editTarget ? "Edit rate tier" : "Add rate tier"}
          <IconButton
            aria-label="Close"
            onClick={closeForm}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <RateTierForm
            key={editTarget?.id ?? "new"}
            tier={editTarget ?? undefined}
            onSuccess={closeForm}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete rate card?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {deleteTarget?.label || "This rate card"} ({deleteTarget?.provider},{" "}
            {deleteTarget?.min_km ?? "?"} – {deleteTarget?.max_km ?? "?"} km) will be deleted. This
            cannot be undone.
          </Typography>
          {deleteTarget?.provider === APP_PRICE_PROVIDER && deleteTarget.is_current ? (
            <Typography variant="body2" color="warning.main" sx={{ mt: 1.5 }}>
              This is a live app price band. Unless another current band covers this range, the app
              will refuse bookings at these distances. To pause it instead, edit it and switch off
              Current.
            </Typography>
          ) : null}
          {deleteError ? (
            <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
              {deleteError}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={removeTier} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
