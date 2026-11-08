import Link from "next/link";
import Alert from "@mui/material/Alert";
import { istDayKey } from "@/lib/holidays";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Server component: on a closed day, every dashboard page says so (ops can still work). */
export default async function HolidayBanner() {
  const { data, error } = await supabaseAdmin()
    .from("service_holidays")
    .select("day")
    .eq("day", istDayKey())
    .maybeSingle();
  if (error) {
    console.error("[holiday-banner] load failed", error.code, error.message);
    return null;
  }
  if (!data) return null;
  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      Holiday today: the EYL app and the WhatsApp bot take no new orders.{" "}
      <Link href="/holidays">Manage holidays</Link>
    </Alert>
  );
}
