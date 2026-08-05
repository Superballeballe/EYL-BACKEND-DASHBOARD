import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { getSessionUser } from "@/lib/server/session";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Nav user={{ email: user.email, name: user.name, role: user.role }} />
      <main className="min-w-0 flex-1 bg-[var(--background)]">
        <div className="mx-auto max-w-[104rem] px-6 py-7">{children}</div>
      </main>
    </div>
  );
}
