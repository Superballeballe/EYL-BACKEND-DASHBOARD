import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import KnightForm from "@/components/KnightForm";
import SalaryForm from "@/components/SalaryForm";
import DeleteButton from "@/components/DeleteButton";
import { fmtMonth, money } from "@/lib/format";
import type { Knight, KnightSalary } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KnightDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = supabaseAdmin();
  const [{ data: knight }, { data: salaries }] = await Promise.all([
    db.from("knights").select("*").eq("id", id).maybeSingle(),
    db.from("knight_salaries").select("*").eq("knight_id", id).order("month", { ascending: false }),
  ]);
  if (!knight) notFound();
  const k = knight as Knight;
  const sals = (salaries ?? []) as KnightSalary[];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={k.display_name}
        subtitle={k.full_name}
        action={
          <div className="flex gap-2">
            <Link href="/knights" className="btn btn-secondary">← All knights</Link>
            <DeleteButton endpoint={`/api/knights/${id}`} redirectTo="/knights" label="Delete knight" />
          </div>
        }
      />

      <div className="card p-5 mb-5">
        <h2 className="font-bold mb-4">Details</h2>
        <KnightForm mode="edit" id={id} initial={k} />
      </div>

      <div className="card p-5">
        <h2 className="font-bold mb-4">Salary history</h2>
        <div className="mb-5">
          <SalaryForm knightId={id} />
        </div>
        {sals.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No salary records yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Month</th>
                <th>Travel</th>
                <th>Salary</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sals.map((s) => (
                <tr key={s.id}>
                  <td>{fmtMonth(s.month)}</td>
                  <td>{money(s.travel)}</td>
                  <td>{money(s.salary)}</td>
                  <td className="font-medium">{money(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
