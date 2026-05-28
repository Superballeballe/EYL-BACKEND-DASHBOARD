"use client";

import { useCallback, useEffect, useState } from "react";

type KnightOpt = { id: string; display_name: string; role: string | null; default_location: string | null };

type Row = {
  knight_name: string;
  knight_id: string | null;
  role: "walker" | "biker";
  location: string;
  shift_time: string;
  status: "working" | "leave" | "half_day";
};

const emptyRow = (role: "walker" | "biker"): Row => ({
  knight_name: "",
  knight_id: null,
  role,
  location: "",
  shift_time: "",
  status: "working",
});

export default function LineupEditor({
  knights,
  initialDate,
}: {
  knights: KnightOpt[];
  initialDate: string;
}) {
  const [date, setDate] = useState(initialDate);
  const [note, setNote] = useState("");
  const [isSunday, setIsSunday] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/lineup?date=${d}`);
      const data = await res.json();
      setNote(data.work_day?.note ?? "");
      setIsSunday(Boolean(data.work_day?.is_sunday) || /sun/i.test(new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })));
      const loaded: Row[] = (data.assignments ?? []).map((a: any) => ({
        knight_name: a.knight_name ?? a.knights?.display_name ?? "",
        knight_id: a.knight_id ?? null,
        role: a.role === "biker" ? "biker" : "walker",
        location: a.location ?? "",
        shift_time: a.shift_time ?? "",
        status: a.status ?? "working",
      }));
      setRows(loaded);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function onNameChange(i: number, name: string) {
    const k = knights.find((x) => x.display_name.toLowerCase() === name.trim().toLowerCase());
    update(i, {
      knight_name: name,
      knight_id: k?.id ?? null,
      ...(k && !rows[i].location && k.default_location ? { location: k.default_location } : {}),
    });
  }
  function addRow(role: "walker" | "biker") {
    setRows((r) => [...r, emptyRow(role)]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/lineup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_date: date,
          is_sunday: isSunday,
          note: note || null,
          assignments: rows
            .filter((r) => r.knight_name.trim())
            .map((r, i) => ({ ...r, position: i })),
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setMsg(`Saved · ${d.walker_count} walkers, ${d.biker_count} bikers.`);
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error || "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  const walkers = rows.map((r, i) => ({ r, i })).filter((x) => x.r.role === "walker");
  const bikers = rows.map((r, i) => ({ r, i })).filter((x) => x.r.role === "biker");

  return (
    <div className="space-y-5">
      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isSunday} onChange={(e) => setIsSunday(e.target.checked)} />
          Sunday
        </label>
        <div className="flex-1 min-w-[12rem]">
          <label className="label">Day note</label>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='e.g. "Karim on leave"'
          />
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving || loading}>
          {saving ? "Saving…" : "Save lineup"}
        </button>
      </div>

      {msg && <div className="card p-3 text-sm bg-[#e7f6ec] border-[#bfe3cb]">{msg}</div>}
      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      <datalist id="lineup-knights">
        {knights.map((k) => (
          <option key={k.id} value={k.display_name} />
        ))}
      </datalist>

      <RoleTable title="Walkers" rows={walkers} onName={onNameChange} update={update} remove={removeRow} add={() => addRow("walker")} />
      <RoleTable title="Bikers" rows={bikers} onName={onNameChange} update={update} remove={removeRow} add={() => addRow("biker")} />
    </div>
  );
}

function RoleTable({
  title,
  rows,
  onName,
  update,
  remove,
  add,
}: {
  title: string;
  rows: { r: Row; i: number }[];
  onName: (i: number, v: string) => void;
  update: (i: number, patch: Partial<Row>) => void;
  remove: (i: number) => void;
  add: () => void;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">
          {title} <span className="text-[var(--muted)] font-normal">({rows.length})</span>
        </h2>
        <button className="btn btn-secondary" onClick={add}>
          + Add
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">None added.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(({ r, i }) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <input
                className="input sm:col-span-3"
                list="lineup-knights"
                value={r.knight_name}
                onChange={(e) => onName(i, e.target.value)}
                placeholder="Knight"
              />
              <input
                className="input sm:col-span-3"
                value={r.location}
                onChange={(e) => update(i, { location: e.target.value })}
                placeholder="Location"
              />
              <input
                className="input sm:col-span-3"
                value={r.shift_time}
                onChange={(e) => update(i, { shift_time: e.target.value })}
                placeholder="Shift time"
              />
              <select
                className="select sm:col-span-2"
                value={r.status}
                onChange={(e) => update(i, { status: e.target.value as Row["status"] })}
              >
                <option value="working">Working</option>
                <option value="half_day">Half day</option>
                <option value="leave">Leave</option>
              </select>
              <button className="btn btn-danger sm:col-span-1" onClick={() => remove(i)} title="Remove">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
