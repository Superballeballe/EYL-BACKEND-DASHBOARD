"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import { money } from "@/lib/format";

export default function RefundCustomerButton({
  id,
  amount,
}: {
  id: string;
  amount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refund() {
    if (!window.confirm(`Refund ${money(amount)} to the customer via Razorpay?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cancelled-orders/${id}/refund`, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(data.error || "Refund failed");
        return;
      }
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="small" variant="contained" disabled={busy} onClick={refund}>
      {busy ? "Refunding…" : `Refund ${money(amount)}`}
    </Button>
  );
}
