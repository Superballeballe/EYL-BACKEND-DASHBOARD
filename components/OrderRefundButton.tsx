"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import { money } from "@/lib/format";

/**
 * Manual refund through ops-refund, shown only where nothing automatic will
 * happen: a paid order after pickup, or a paid cancelled order whose refund
 * was never queued. (A failed refund uses RetryRefundButton.)
 */
export default function OrderRefundButton({
  orderId,
  kind,
  amountRupees,
}: {
  orderId: string;
  kind: "refund_after_pickup" | "start_refund";
  amountRupees: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refund() {
    const amount = amountRupees ? ` of ${money(amountRupees)}` : "";
    const question =
      kind === "refund_after_pickup"
        ? `This order was picked up, so nothing is refunded automatically. Refund the payment${amount} in full to the customer via Razorpay now?`
        : `This cancelled order has no refund queued. Refund the payment${amount} in full to the customer via Razorpay now?`;
    if (!window.confirm(question)) return;
    const note = window.prompt("Note for the audit log (why this refund):", "") ?? "";
    setBusy(true);
    try {
      const res = await fetch(`/api/refunds/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note.trim() ? { note: note.trim() } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(data.error || "The refund didn't go through. Refresh and check the refund status.");
        return;
      }
      router.refresh();
    } catch (e) {
      console.error("[order-refund] failed", e);
      window.alert("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="small" variant="contained" color="error" disabled={busy} onClick={refund}>
      {busy ? "Refunding…" : kind === "refund_after_pickup" ? "Refund after pickup" : "Start refund"}
    </Button>
  );
}
