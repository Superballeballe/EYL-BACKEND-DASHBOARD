import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import ClientForm from "@/components/ClientForm";
import DeleteButton from "@/components/DeleteButton";
import type { Client } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await supabaseAdmin().from("clients").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const client = data as Client;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={client.client_name}
        subtitle={client.company_name ?? undefined}
        action={
          <div className="flex gap-2">
            <Link href="/clients" className="btn btn-secondary">← All clients</Link>
            <DeleteButton endpoint={`/api/clients/${id}`} redirectTo="/clients" label="Delete client" />
          </div>
        }
      />
      <div className="card p-5">
        <ClientForm mode="edit" id={id} initial={client} />
      </div>
    </div>
  );
}
