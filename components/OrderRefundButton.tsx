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
    let body: { note?: string; amount_paise?: number } = {};
    if (kind === "refund_after_pickup") {
      // Picked up: never automatic. Ops choose the amount (full by default) and say why.
      const full = amountRupees ?? 0;
      const raw = window.prompt(
        `This order was picked up, so nothing is refunded automatically.\nAmount to refund in ₹ (full payment is ${money(full)}):`,
        full ? String(full) : "",
      );
      if (raw === null) return;
      const rupees = Number(raw.replace(/[₹,\s]/g, ""));
      if (!Number.isFinite(rupees) || rupees <= 0 || (full > 0 && rupees > full)) {
        window.alert(`Enter an amount above ₹0${full ? ` and up to ${money(full)}` : ""}.`);
        return;
      }
      const note = (window.prompt("Why is this order being refunded? (required, for the audit log)", "") ?? "").trim();
      if (note.length < 3) {
        window.alert("A note is required for refunds after pickup.");
        return;
      }
      if (!window.confirm(`Refund ${money(rupees)} to the customer via Razorpay now? This can only be done once per payment.`)) return;
      body = { note, amount_paise: Math.round(rupees * 100) };
    } else {
      const amount = amountRupees ? ` of ${money(amountRupees)}` : "";
      if (!window.confirm(`This cancelled order has no refund queued. Refund the payment${amount} in full to the customer via Razorpay now?`)) return;
      const note = (window.prompt("Note for the audit log (why this refund):", "") ?? "").trim();
      body = note ? { note } : {};
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/refunds/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
