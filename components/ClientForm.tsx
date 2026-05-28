"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClientForm({
  mode,
  id,
  initial,
}: {
  mode: "new" | "edit";
  id?: string;
  initial?: Record<string, any> | null;
}) {
  const router = useRouter();
  const [v, setV] = useState({
    client_name: initial?.client_name ?? "",
    company_name: initial?.company_name ?? "",
    gst_no: initial?.gst_no ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    note: initial?.note ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(k: string, val: string) {
    setV((s) => ({ ...s, [k]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch(mode === "new" ? "/api/clients" : `/api/clients/${id}`, {
      method: mode === "new" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    setBusy(false);
    if (res.ok) {
      if (mode === "new") setV({ client_name: "", company_name: "", gst_no: "", phone: "", address: "", note: "" });
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Save failed");
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="label">Client name</label>
        <input className="input" value={v.client_name} onChange={(e) => set("client_name", e.target.value)} required />
      </div>
      <div>
        <label className="label">Company name</label>
        <input className="input" value={v.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} />
      </div>
      <div>
        <label className="label">GST no.</label>
        <input className="input" value={v.gst_no ?? ""} onChange={(e) => set("gst_no", e.target.value)} />
      </div>
      <div>
        <label className="label">Phone</label>
        <input className="input" value={v.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Address</label>
        <textarea className="textarea" rows={2} value={v.address ?? ""} onChange={(e) => set("address", e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Note</label>
        <input className="input" value={v.note ?? ""} onChange={(e) => set("note", e.target.value)} />
      </div>
      {err && <p className="text-sm text-[#b42318] sm:col-span-2">{err}</p>}
      <div className="sm:col-span-2">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : mode === "new" ? "Add client" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
