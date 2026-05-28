"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PROVIDERS = ["eyl", "eyl_cake", "fudpro", "wefast", "uber", "porter"];

export default function RateTierForm() {
  const router = useRouter();
  const [v, setV] = useState({
    provider: "eyl",
    label: "",
    min_km: "",
    max_km: "",
    fee: "",
    fee_ex_gst: "",
    gst_amount: "",
    is_current: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(k: string, val: any) {
    setV((s) => ({ ...s, [k]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    setBusy(false);
    if (res.ok) {
      setV({ ...v, label: "", min_km: "", max_km: "", fee: "", fee_ex_gst: "", gst_amount: "" });
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Save failed");
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="label">Provider</label>
        <select className="select" value={v.provider} onChange={(e) => set("provider", e.target.value)}>
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label">Label</label>
        <input className="input" value={v.label} onChange={(e) => set("label", e.target.value)} placeholder="0 kms - 3 kms" />
      </div>
      <div>
        <label className="label">Min km</label>
        <input type="number" step="0.1" className="input" value={v.min_km} onChange={(e) => set("min_km", e.target.value)} />
      </div>
      <div>
        <label className="label">Max km</label>
        <input type="number" step="0.1" className="input" value={v.max_km} onChange={(e) => set("max_km", e.target.value)} />
      </div>
      <div>
        <label className="label">Fee (₹)</label>
        <input type="number" step="0.01" className="input" value={v.fee} onChange={(e) => set("fee", e.target.value)} />
      </div>
      <div>
        <label className="label">Fee ex-GST</label>
        <input type="number" step="0.01" className="input" value={v.fee_ex_gst} onChange={(e) => set("fee_ex_gst", e.target.value)} />
      </div>
      {err && <p className="text-sm text-[#b42318] col-span-2">{err}</p>}
      <div className="col-span-2">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Add tier"}</button>
      </div>
    </form>
  );
}
