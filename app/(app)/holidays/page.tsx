import Typography from "@mui/material/Typography";
import AutoRefresh from "@/components/AutoRefresh";
import HolidaysBoard from "@/components/HolidaysBoard";
import { PageHeader } from "@/components/ui";
import { istDayKey } from "@/lib/holidays";
import { listUpcomingHolidays } from "@/lib/server/holidays";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SUBTITLE = "Days EYL takes no orders: the app, the WhatsApp bot and the knight app all follow this page";

export default async function HolidaysPage() {
  const now = new Date();
  try {
    const holidays = await listUpcomingHolidays(supabaseAdmin(), now);
    return (
      <div>
        <AutoRefresh />
        <PageHeader title="Holidays" subtitle={SUBTITLE} />
        <HolidaysBoard holidays={holidays} today={istDayKey(now)} />
      </div>
    );
  } catch (e) {
    console.error("[holidays] load failed", e);
    return (
      <div>
        <PageHeader title="Holidays" subtitle={SUBTITLE} />
        <Typography color="error" sx={{ p: 2 }}>
          Couldn&apos;t load the closed days. Refresh to try again.
        </Typography>
      </div>
    );
  }
}
