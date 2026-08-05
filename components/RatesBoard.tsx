"use client";

import { useMemo, useState } from "react";
import {
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
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import RateTierForm from "@/components/RateTierForm";
import { EmptyState } from "@/components/ui";
import { money } from "@/lib/format";
import { tableShellSx } from "@/lib/surface";
import type { RateTier } from "@/lib/types";

export default function RatesBoard({ tiers }: { tiers: RateTier[] }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("all");

  const providers = useMemo(
    () => [...new Set(tiers.map((t) => t.provider))].sort(),
    [tiers],
  );

  const rows = useMemo(
    () => (provider === "all" ? tiers : tiers.filter((t) => t.provider === provider)),
    [provider, tiers],
  );

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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 6 }}>
          Add rate tier
          <IconButton
            aria-label="Close"
            onClick={() => setOpen(false)}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <RateTierForm onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
