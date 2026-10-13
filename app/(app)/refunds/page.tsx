import AutoRefresh from "@/components/AutoRefresh";
import { PageHeader } from "@/components/ui";
import RefundsBoard from "@/components/RefundsBoard";
import { loadRefundsPageData } from "@/lib/server/refundsData";
import { getSessionUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const TABS: Record<string, number> = { refunds: 0, review: 1, mode: 2 };

export default async function RefundsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, data, user] = await Promise.all([searchParams, loadRefundsPageData(), getSessionUser()]);
  const isAdmin = user?.role === "admin";
  const initialTab = TABS[tab ?? ""] ?? 0;

  return (
    <div>
      <AutoRefresh />
      <PageHeader
        title="Refunds"
        subtitle="Automatic refunds, payments that need review, and the auto-refund mode. The dashboard never refunds on its own."
      />
      <RefundsBoard {...data} isAdmin={isAdmin} initialTab={initialTab === 2 && !isAdmin ? 0 : initialTab} />
    </div>
  );
}
