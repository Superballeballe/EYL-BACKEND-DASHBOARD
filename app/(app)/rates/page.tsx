import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader, EmptyState } from "@/components/ui";
import RateTierForm from "@/components/RateTierForm";
import { money } from "@/lib/format";
import type { RateTier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RatesPage() {
  const { data } = await supabaseAdmin()
    .from("rate_tiers")
    .select("*")
    .order("provider")
    .order("min_km", { ascending: true, nullsFirst: true });
  const tiers = (data ?? []) as RateTier[];

  const byProvider = new Map<string, RateTier[]>();
  for (const t of tiers) {
    if (!byProvider.has(t.provider)) byProvider.set(t.provider, []);
    byProvider.get(t.provider)!.push(t);
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title="Rate Cards" subtitle="Km-based pricing used to suggest delivery fees" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {byProvider.size === 0 ? (
            <EmptyState message="No rate tiers yet. Add one on the right (or run the import)." />
          ) : (
            [...byProvider.entries()].map(([provider, rows]) => (
              <div key={provider} className="card p-5">
                <h2 className="font-bold mb-3 uppercase tracking-wide">{provider}</h2>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Range</th>
                      <th>Km</th>
                      <th>Fee</th>
                      <th>Ex-GST</th>
                      <th>GST</th>
                      <th>Current</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr key={t.id}>
                        <td>{t.label ?? "—"}</td>
                        <td className="text-xs text-[var(--muted)]">
                          {t.min_km ?? "?"}–{t.max_km ?? "?"}
                        </td>
                        <td className="font-medium">{money(t.fee)}</td>
                        <td>{money(t.fee_ex_gst)}</td>
                        <td>{money(t.gst_amount)}</td>
                        <td>
                          {t.is_current ? (
                            <span className="badge badge-green">current</span>
                          ) : (
                            <span className="badge badge-gray">old</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        <div className="card p-5 h-fit">
          <h2 className="font-bold mb-4">Add rate tier</h2>
          <RateTierForm />
        </div>
      </div>
    </div>
  );
}
