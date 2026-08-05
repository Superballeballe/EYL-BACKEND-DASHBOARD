import { redirect } from "next/navigation";

export default function NewDeliveryPage() {
  redirect("/deliveries?new=1");
}
