import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader, EmptyState } from "@/components/ui";
import KnightForm from "@/components/KnightForm";
import { fmtDate } from "@/lib/format";
import type { Knight } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KnightsPage() {
  const { data } = await supabaseAdmin().from("knights").select("*").order("display_name");
  const knights = (data ?? []) as Knight[];

  return (
    <div className="max-w-5xl">
      <PageHeader title="Knights" subtitle={`${knights.length} delivery staff`} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          {knights.length === 0 ? (
            <EmptyState message="No knights yet. Add one on the right (or run the import)." />
          ) : (
            <div className="card overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>Display</th>
                    <th>Full name</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {knights.map((k) => (
                    <tr key={k.id}>
                      <td className="font-medium">{k.display_name}</td>
                      <td className="text-xs">{k.full_name}</td>
                      <td>{k.role ? <span className="badge badge-gray">{k.role}</span> : "—"}</td>
                      <td>{fmtDate(k.joining_date)}</td>
                      <td>{k.active ? <span className="badge badge-green">active</span> : <span className="badge badge-gray">inactive</span>}</td>
                      <td>
                        <Link href={`/knights/${k.id}`} className="text-[var(--brand)] hover:underline text-sm">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-5 h-fit">
          <h2 className="font-bold mb-4">Add knight</h2>
          <KnightForm mode="new" />
        </div>
      </div>
    </div>
  );
}
