"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SalaryForm({ knightId }: { knightId: string }) {
  const router = useRouter();
  const [month, setMonth] = useState("");
  const [travel, setTravel] = useState("");
  const [salary, setSalary] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/salaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knight_id: knightId, month, travel, salary }),
    });
    setBusy(false);
    if (res.ok) {
      setMonth("");
      setTravel("");
      setSalary("");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Save failed");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label">Month</label>
        <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} required />
      </div>
      <div>
        <label className="label">Travel (₹)</label>
        <input type="number" step="0.01" className="input w-32" value={travel} onChange={(e) => setTravel(e.target.value)} />
      </div>
      <div>
        <label className="label">Salary (₹)</label>
        <input type="number" step="0.01" className="input w-32" value={salary} onChange={(e) => setSalary(e.target.value)} />
      </div>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save month"}
      </button>
      {err && <p className="text-sm text-[#b42318] w-full">{err}</p>}
    </form>
  );
}
