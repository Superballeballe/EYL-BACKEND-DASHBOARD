"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteButton({
  endpoint,
  redirectTo,
  label = "Delete",
  confirmText = "Delete this record? This cannot be undone.",
}: {
  endpoint: string;
  redirectTo: string;
  label?: string;
  confirmText?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(confirmText)) return;
    setBusy(true);
    const res = await fetch(endpoint, { method: "DELETE" });
    if (res.ok) {
      router.push(redirectTo);
      router.refresh();
    } else {
      setBusy(false);
      // The server's reason, e.g. "Issued invoices must be cancelled with a credit note".
      const data = await res.json().catch(() => ({}));
      alert(typeof data?.error === "string" && data.error ? data.error : "Delete failed");
    }
  }

  return (
    <button type="button" className="btn btn-danger" onClick={onDelete} disabled={busy}>
      {busy ? "Deleting…" : label}
    </button>
  );
}
