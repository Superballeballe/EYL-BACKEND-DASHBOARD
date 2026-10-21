import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import NewOrderAlert from "@/components/NewOrderAlert";
import { countOpenPaymentReviews } from "@/lib/server/refundsData";
import { getSessionUser } from "@/lib/server/session";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const reviewCount = await countOpenPaymentReviews().catch(() => 0);

  return (
    <div className="grid min-h-screen grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_1fr] bg-[var(--background)]">
      {/* Nav renders two grid items: the top bar across both columns, then the sidebar. */}
      <Nav user={{ email: user.email, name: user.name, role: user.role }} reviewCount={reviewCount} />
      <NewOrderAlert />
      <main className="min-w-0 bg-[var(--background)]">
        <div className="mx-auto max-w-[104rem] px-6 py-5">{children}</div>
      </main>
    </div>
  );
}
