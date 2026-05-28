"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type KnightOpt = { id: string; display_name: string; role: string | null };
type Cell = { travel: string; salary: string };

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SalaryGrid({ knights }: { knights: KnightOpt[] }) {
  const [month, setMonth] = useState(currentMonth());
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(
    async (m: string) => {
      setLoading(true);
      setMsg(null);
      const res = await fetch(`/api/salaries?month=${m}-01`);
      const data = await res.json();
      const next: Record<string, Cell> = {};
      for (const k of knights) next[k.id] = { travel: "", salary: "" };
      for (const s of data.data ?? []) {
        next[s.knight_id] = {
          travel: s.travel != null ? String(s.travel) : "",
          salary: s.salary != null ? String(s.salary) : "",
        };
      }
      setCells(next);
      setLoading(false);
    },
    [knights],
  );

  useEffect(() => {
    load(month);
  }, [month, load]);

  function set(knightId: string, field: keyof Cell, value: string) {
    setCells((c) => ({ ...c, [knightId]: { ...c[knightId], [field]: value } }));
  }

  const totals = useMemo(() => {
    let travel = 0,
      salary = 0;
    for (const k of knights) {
      travel += Number(cells[k.id]?.travel) || 0;
      salary += Number(cells[k.id]?.salary) || 0;
    }
    return { travel, salary, total: travel + salary };
  }, [cells, knights]);

  async function saveAll() {
    setSaving(true);
    setMsg(null);
    const toSave = knights.filter((k) => {
      const c = cells[k.id];
      return c && (c.travel !== "" || c.salary !== "");
    });
    let okCount = 0;
    for (const k of toSave) {
      const c = cells[k.id];
      const res = await fetch("/api/salaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knight_id: k.id,
          month: `${month}-01`,
          travel: c.travel || 0,
          salary: c.salary || 0,
        }),
      });
      if (res.ok) okCount++;
    }
    setSaving(false);
    setMsg(`Saved ${okCount} of ${toSave.length} rows.`);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Month</label>
          <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={saveAll} disabled={saving || loading}>
          {saving ? "Saving…" : "Save all"}
        </button>
        {msg && <span className="text-sm text-[#1a7f37]">{msg}</span>}
        {loading && <span className="text-sm text-[var(--muted)]">Loading…</span>}
      </div>

      <div className="card overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th>Knight</th>
              <th>Role</th>
              <th>Travel (₹)</th>
              <th>Salary (₹)</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {knights.map((k) => {
              const c = cells[k.id] ?? { travel: "", salary: "" };
              const total = (Number(c.travel) || 0) + (Number(c.salary) || 0);
              return (
                <tr key={k.id}>
                  <td className="font-medium">{k.display_name}</td>
                  <td className="text-xs text-[var(--muted)]">{k.role ?? "—"}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="input w-28"
                      value={c.travel}
                      onChange={(e) => set(k.id, "travel", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="input w-28"
                      value={c.salary}
                      onChange={(e) => set(k.id, "salary", e.target.value)}
                    />
                  </td>
                  <td className="font-medium">₹{total.toLocaleString("en-IN")}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td colSpan={2}>Total</td>
              <td>₹{totals.travel.toLocaleString("en-IN")}</td>
              <td>₹{totals.salary.toLocaleString("en-IN")}</td>
              <td>₹{totals.total.toLocaleString("en-IN")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
