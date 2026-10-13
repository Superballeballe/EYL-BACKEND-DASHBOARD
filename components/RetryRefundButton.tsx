"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import { formatPaise } from "@/lib/refunds";

/** Retry a failed cancellation refund through ops-refund (explicit ops click). */
export default function RetryRefundButton({ id, amountPaise }: { id: string; amountPaise: number | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function retry() {
    const amount = amountPaise ? ` of ${formatPaise(amountPaise)}` : "";
    if (!window.confirm(`Retry the refund${amount} to the customer via Razorpay now?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cancelled-orders/${id}/refund`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(data.error || "The retry didn't go through. Refresh and check the refund status.");
        return;
      }
      router.refresh();
    } catch (e) {
      console.error("[refunds] retry failed", e);
      window.alert("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="small" variant="contained" color="error" disabled={busy} onClick={retry}>
      {busy ? "Retrying…" : "Retry refund"}
    </Button>
  );
}
