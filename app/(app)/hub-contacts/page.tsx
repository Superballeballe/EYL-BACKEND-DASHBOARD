import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import HubContactsBoard from "@/components/HubContactsBoard";
import { HUB_CONTACT_COLUMNS } from "@/lib/server/hubContacts";
import type { HubContact } from "@/lib/types";
import Typography from "@mui/material/Typography";

export const dynamic = "force-dynamic";

const SUBTITLE = "Numbers behind “Call the Hub” in the EYL mobile app";

export default async function HubContactsPage() {
  const { data, error } = await supabaseAdmin()
    .from("hub_contacts")
    .select(HUB_CONTACT_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) {
    return (
      <div>
        <PageHeader title="Hub contacts" subtitle={SUBTITLE} />
        <Typography color="error" sx={{ p: 2 }}>
          Failed to load: {error.message}
        </Typography>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Hub contacts" subtitle={SUBTITLE} />
      <HubContactsBoard contacts={(data ?? []) as HubContact[]} />
    </div>
  );
}
