"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { money } from "@/lib/format";
import { APP_HANDLING_FEES } from "@/lib/pricing/handlingFees";
import { tableShellSx } from "@/lib/surface";
import type { PricingSurcharge } from "@/lib/types";

type FeeRow = { option: string; fee: PricingSurcharge };

/** What the customer is charged for the option, before GST. */
function chargeLabel(fee: PricingSurcharge) {
  return fee.is_current && fee.amount > 0 ? `${money(fee.amount)} + GST` : "Free";
}

export default function HandlingFeesBoard({ fees }: { fees: PricingSurcharge[] }) {
  const [editTarget, setEditTarget] = useState<FeeRow | null>(null);

  const rows: FeeRow[] = [];
  const missing: string[] = [];
  for (const { code, option } of APP_HANDLING_FEES) {
    const fee = fees.find((f) => f.code === code);
    if (fee) rows.push({ option, fee });
    else missing.push(option);
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        Handling fees
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
        Live app prices. Added before 18% GST when the customer picks the option; 0 or switched off
        means free.
      </Typography>

      {missing.length > 0 ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          No fee row for {missing.join(", ")}: the app charges nothing for it. Apply the EYL-APP
          migration 20261019120000_handling_fees_per_option.sql.
        </Alert>
      ) : null}

      {rows.length > 0 ? (
        <TableContainer sx={tableShellSx}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Option</TableCell>
                <TableCell>Fee ex-GST (₹)</TableCell>
                <TableCell>Customer is charged</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right"> </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.fee.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{row.option}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {money(row.fee.amount)}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {chargeLabel(row.fee)}
                  </TableCell>
                  <TableCell>
                    {row.fee.is_current ? (
                      <Chip size="small" color="primary" label="on" />
                    ) : (
                      <Chip size="small" variant="outlined" label="off" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit handling fee">
                      <IconButton
                        size="small"
                        aria-label={`Edit ${row.option} fee`}
                        onClick={() => setEditTarget(row)}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pr: 6 }}>
          {editTarget?.option} handling fee
          <IconButton
            aria-label="Close"
            onClick={() => setEditTarget(null)}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          {editTarget ? (
            <HandlingFeeForm
              key={editTarget.fee.id}
              fee={editTarget.fee}
              onSuccess={() => setEditTarget(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function HandlingFeeForm({ fee, onSuccess }: { fee: PricingSurcharge; onSuccess: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(fee.amount));
  const [isCurrent, setIsCurrent] = useState(fee.is_current);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/handling-fees/${fee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // An empty or non-numeric field goes up as null and is refused by the API.
      body: JSON.stringify({ amount: amount.trim() === "" ? null : Number(amount), is_current: isCurrent }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
      onSuccess();
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
        <Alert severity="info">
          Live app price. Customers who pick this option pay this fee plus 18% GST on their next
          booking. Set 0 to keep it free.
        </Alert>

        <TextField
          size="small"
          fullWidth
          type="number"
          label="Fee ex-GST (₹)"
          slotProps={{ htmlInput: { step: 1, min: 0 } }}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <FormControlLabel
          control={<Switch checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} />}
          label={
            <Typography variant="body2">
              On {isCurrent ? "" : "(switched off: the option is free)"}
            </Typography>
          }
        />

        {err ? <Alert severity="error">{err}</Alert> : null}

        <Button type="submit" variant="contained" disabled={busy} fullWidth>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </Stack>
    </Box>
  );
}
