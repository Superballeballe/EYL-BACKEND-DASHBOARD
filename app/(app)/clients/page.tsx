import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import ClientsBoard from "@/components/ClientsBoard";
import type { Client } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { data } = await supabaseAdmin().from("clients").select("*").order("client_name");
  const clients = (data ?? []) as Client[];

  return (
    <div>
      <PageHeader title="Clients" subtitle={`${clients.length} billing records`} />
      <ClientsBoard clients={clients} />
    </div>
  );
}
