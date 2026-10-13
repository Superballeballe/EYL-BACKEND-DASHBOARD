"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { fmtDateTime } from "@/lib/format";
import {
  AUTO_REFUND_MODE_SCOPE,
  AUTO_REFUND_MODES,
  autoRefundModeLabel,
  formatPaise,
  modeReasonError,
  refundOriginLabel,
  showDryRunList,
  type AutoRefundMode,
  type ModeHistoryEntry,
} from "@/lib/refunds";
import { tableShellSx } from "@/lib/surface";
import type { PaymentRefund } from "@/lib/types";

/** Admin only: AUTO_REFUND_MODE, its history and the dry-run "would refund" list. */
export default function RefundModeControl({
  mode,
  modeRaw,
  updatedAt,
  updatedBy,
  history,
  dryRunRows,
}: {
  mode: AutoRefundMode;
  modeRaw: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  history: ModeHistoryEntry[];
  dryRunRows: PaymentRefund[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState<AutoRefundMode | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(next: AutoRefundMode) {
    setTarget(next);
    setReason("");
    setError(null);
  }

  async function submit() {
    const reasonError = modeReasonError(reason);
    if (reasonError) {
      setError(reasonError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/refunds/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: target, reason: reason.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "The mode was not changed. Refresh and try again.");
        return;
      }
      setTarget(null);
      router.refresh();
    } catch (e) {
      console.error("[refund-mode] change failed", e);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const current = AUTO_REFUND_MODES.find((m) => m.value === mode);

  return (
    <Stack spacing={2.5}>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
            <Typography variant="h2">Auto-refund mode</Typography>
            <Chip size="small" color={mode === "live" ? "success" : "warning"} label={autoRefundModeLabel(mode)} />
          </Stack>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {current?.description}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
            {modeRaw ? `Set ${updatedAt ? fmtDateTime(updatedAt) : ""}${updatedBy ? ` by ${updatedBy}` : ""}.` : "Not set: live is the default."}{" "}
            {AUTO_REFUND_MODE_SCOPE}
          </Typography>
          {mode !== "live" ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {autoRefundModeLabel(mode)} is a temporary safety switch. Switch back to live once the issue is fixed.
            </Alert>
          ) : null}
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
            {AUTO_REFUND_MODES.filter((m) => m.value !== mode).map((m) => (
              <Button
                key={m.value}
                size="small"
                variant={m.value === "live" ? "contained" : "outlined"}
                color={m.value === "live" ? "primary" : "warning"}
                onClick={() => open(m.value)}
              >
                Switch to {m.label.toLowerCase()}
              </Button>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {showDryRunList(mode, dryRunRows.length) ? (
        <Card>
          <CardContent>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
              Would refund (dry run)
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
              What the reconcile job would have refunded in live mode. Nothing here was sent to Razorpay.
            </Typography>
            {dryRunRows.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Nothing yet.
              </Typography>
            ) : (
              <TableContainer sx={{ ...tableShellSx, overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>When</TableCell>
                      <TableCell>Order</TableCell>
                      <TableCell>Payment</TableCell>
                      <TableCell>Why</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dryRunRows.map((r) => (
                      <TableRow key={r.razorpay_payment_id}>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDateTime(r.created_at)}</TableCell>
                        <TableCell>
                          {r.order_id ? <Link href={`/refunds/orders/${r.order_id}`}>Open order</Link> : "—"}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                            {r.razorpay_payment_id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {refundOriginLabel(r.origin)}
                          {r.note ? (
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                              {r.note}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatPaise(r.amount_paise)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <Typography variant="h2" sx={{ mb: 2 }}>
            History
          </Typography>
          {history.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No changes recorded.
            </Typography>
          ) : (
            <TableContainer sx={{ ...tableShellSx, overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>When</TableCell>
                    <TableCell>Change</TableCell>
                    <TableCell>Who · reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((h, i) => (
                    <TableRow key={`${h.at}-${i}`}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDateTime(h.at)}</TableCell>
                      <TableCell>
                        {autoRefundModeLabel(h.from)} → {autoRefundModeLabel(h.to)}
                      </TableCell>
                      <TableCell>{h.note || h.actor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={target !== null} onClose={() => (busy ? null : setTarget(null))} maxWidth="sm" fullWidth>
        <DialogTitle>Switch auto-refund mode to {target ? autoRefundModeLabel(target).toLowerCase() : ""}?</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            {AUTO_REFUND_MODES.map((m) => (
              <Box key={m.value} sx={{ opacity: m.value === target ? 1 : 0.6 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {m.label}
                  {m.value === target ? " (new)" : m.value === mode ? " (current)" : ""}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {m.description}
                </Typography>
              </Box>
            ))}
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {AUTO_REFUND_MODE_SCOPE}
            </Typography>
            <TextField
              size="small"
              label="Reason (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 400 } }}
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" color={target === "live" ? "primary" : "warning"} onClick={submit} disabled={busy}>
            {busy ? "Switching…" : "Switch"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
