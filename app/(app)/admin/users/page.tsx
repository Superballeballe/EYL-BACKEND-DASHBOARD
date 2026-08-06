import { redirect } from "next/navigation";
import AdminUsersBoard from "@/components/AdminUsersBoard";
import { getSessionUser, listDashboardUsers, listPendingInvites } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const [users, invites] = await Promise.all([listDashboardUsers(), listPendingInvites()]);

  return <AdminUsersBoard initialUsers={users} initialInvites={invites} currentUserId={user.id} />;
}
