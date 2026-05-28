import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader, EmptyState } from "@/components/ui";
import ClientForm from "@/components/ClientForm";
import type { Client } from "@/lib/types";

export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const q = one((await searchParams).q);
  let query = supabaseAdmin().from("clients").select("*").order("client_name");
  if (q) {
    const t = `%${q}%`;
    query = query.or(`client_name.ilike.${t},company_name.ilike.${t},gst_no.ilike.${t}`);
  }
  const { data } = await query;
  const clients = (data ?? []) as Client[];

  return (
    <div className="max-w-6xl">
      <PageHeader title="Clients" subtitle={`${clients.length} billing records`} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <form method="get" action="/clients" className="flex gap-2">
            <input name="q" defaultValue={q} className="input" placeholder="Search name, company or GST…" />
            <button className="btn btn-primary">Search</button>
            {q && <Link href="/clients" className="btn btn-secondary">Reset</Link>}
          </form>

          {clients.length === 0 ? (
            <EmptyState message="No clients found." />
          ) : (
            <div className="card overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Company</th>
                    <th>GST</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.client_name}</td>
                      <td className="text-xs">{c.company_name ?? "—"}</td>
                      <td className="text-xs">{c.gst_no ?? "—"}</td>
                      <td>
                        <Link href={`/clients/${c.id}`} className="text-[var(--brand)] hover:underline text-sm">
                          Edit
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
          <h2 className="font-bold mb-4">Add client</h2>
          <ClientForm mode="new" />
        </div>
      </div>
    </div>
  );
}
