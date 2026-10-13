"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { formatPaise, isLeaseActive, resolveNoteError, reviewKindLabel, reviewRefundPaise } from "@/lib/refunds";
import type { PaymentReview } from "@/lib/types";

type Mode = "refund" | "resolve" | null;

/** "Refund this payment" / "Mark resolved" for one open payment review (via ops-refund). */
export default function PaymentReviewActions({ review }: { review: PaymentReview }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = reviewRefundPaise(review);
  const leased = isLeaseActive(review.lease_until);

  function open(next: Mode) {
    setMode(next);
    setNote("");
    setReference("");
    setError(null);
  }

  async function submit() {
    if (mode === "resolve") {
      const noteError = resolveNoteError(note);
      if (noteError) {
        setError(noteError);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/refunds/reviews/${review.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_action: mode,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(mode === "resolve" && reference.trim() ? { reference: reference.trim() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "That didn't go through. Refresh and check the review before trying again.");
        return;
      }
      setMode(null);
      router.refresh();
    } catch (e) {
      console.error("[reviews] action failed", e);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
        <Button
          size="small"
          variant="contained"
          color="error"
          disabled={leased || !amount}
          onClick={() => open("refund")}
        >
          Refund this payment
        </Button>
        <Button size="small" variant="outlined" disabled={leased} onClick={() => open("resolve")}>
          Mark resolved
        </Button>
      </Stack>
      {leased ? (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", textAlign: "right" }}>
          A refund is running. Try again in a few minutes.
        </Typography>
      ) : null}

      <Dialog open={mode !== null} onClose={() => (busy ? null : setMode(null))} maxWidth="xs" fullWidth>
        <DialogTitle>{mode === "refund" ? "Refund this payment?" : "Mark resolved"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {mode === "refund" ? (
              <Typography variant="body2">
                Refund <strong>{formatPaise(amount)}</strong> to the customer via Razorpay for payment{" "}
                <code>{review.razorpay_payment_id}</code> ({reviewKindLabel(review.kind)}
                {review.order_code ? `, order ${review.order_code}` : ""}). This can&apos;t be undone.
              </Typography>
            ) : (
              <Typography variant="body2">
                Close this review without a refund from here, e.g. it was refunded in the Razorpay dashboard or handled
                with the customer. The note is required.
              </Typography>
            )}
            <TextField
              size="small"
              label={mode === "resolve" ? "Note (required)" : "Note (optional)"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
            {mode === "resolve" ? (
              <TextField
                size="small"
                label="Razorpay refund id (optional)"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 120 } }}
              />
            ) : null}
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setMode(null)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={mode === "refund" ? "error" : "primary"}
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Working…" : mode === "refund" ? `Refund ${formatPaise(amount)}` : "Mark resolved"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
