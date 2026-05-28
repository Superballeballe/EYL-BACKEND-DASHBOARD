"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function KnightForm({
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
    full_name: initial?.full_name ?? "",
    display_name: initial?.display_name ?? "",
    role: initial?.role ?? "",
    joining_date: initial?.joining_date ?? "",
    default_location: initial?.default_location ?? "",
    active: initial?.active ?? true,
    note: initial?.note ?? "",
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
    const res = await fetch(mode === "new" ? "/api/knights" : `/api/knights/${id}`, {
      method: mode === "new" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    setBusy(false);
    if (res.ok) {
      if (mode === "new") setV({ full_name: "", display_name: "", role: "", joining_date: "", default_location: "", active: true, note: "" });
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Save failed");
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="flex flex-col">
        <label className="label">Full name</label>
        <input className="input mt-auto" value={v.full_name} onChange={(e) => set("full_name", e.target.value)} required />
      </div>
      <div className="flex flex-col">
        <label className="label">Display name (short)</label>
        <input className="input mt-auto" value={v.display_name} onChange={(e) => set("display_name", e.target.value)} required placeholder="e.g. Vilas" />
      </div>
      <div className="flex flex-col">
        <label className="label">Role</label>
        <select className="select mt-auto" value={v.role ?? ""} onChange={(e) => set("role", e.target.value)}>
          <option value="">—</option>
          <option value="walker">Walker</option>
          <option value="biker">Biker</option>
        </select>
      </div>
      <div className="flex flex-col">
        <label className="label">Joining date</label>
        <input type="date" className="input mt-auto" value={v.joining_date ?? ""} onChange={(e) => set("joining_date", e.target.value)} />
      </div>
      <div className="flex flex-col">
        <label className="label">Default location</label>
        <input className="input mt-auto" value={v.default_location ?? ""} onChange={(e) => set("default_location", e.target.value)} />
      </div>
      <div className="flex items-end gap-2 pb-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} />
          Active
        </label>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Note</label>
        <input className="input" value={v.note ?? ""} onChange={(e) => set("note", e.target.value)} />
      </div>
      {err && <p className="text-sm text-[#b42318] sm:col-span-2">{err}</p>}
      <div className="sm:col-span-2">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : mode === "new" ? "Add knight" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
