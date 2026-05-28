import { PageHeader } from "@/components/ui";
import DeliveryForm from "@/components/DeliveryForm";
import { getDeliveryFormOptions } from "@/lib/server/formOptions";

export const dynamic = "force-dynamic";

export default async function NewDeliveryPage() {
  const { knights, clients, rateTiers } = await getDeliveryFormOptions();
  return (
    <div className="max-w-4xl">
      <PageHeader title="New delivery" subtitle="Log a new booking" />
      <DeliveryForm mode="new" knights={knights} clients={clients} rateTiers={rateTiers} />
    </div>
  );
}
