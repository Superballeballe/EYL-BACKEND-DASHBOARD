import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import DeliveryForm from "@/components/DeliveryForm";
import DeleteButton from "@/components/DeleteButton";
import { getDeliveryFormOptions } from "@/lib/server/formOptions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/format";
import type { Delivery } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await supabaseAdmin().from("deliveries").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const delivery = data as Delivery;
  const { knights, clients, rateTiers } = await getDeliveryFormOptions();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Edit delivery"
        subtitle={`${delivery.sender_name ?? "—"} · ${fmtDate(delivery.task_date)}`}
        action={
          <DeleteButton endpoint={`/api/deliveries/${id}`} redirectTo="/deliveries" />
        }
      />
      <DeliveryForm
        mode="edit"
        id={id}
        initial={delivery}
        knights={knights}
        clients={clients}
        rateTiers={rateTiers}
      />
    </div>
  );
}
