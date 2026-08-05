import { redirect } from "next/navigation";
import AdminUsersBoard from "@/components/AdminUsersBoard";
import { getSessionUser, listDashboardUsers } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const users = await listDashboardUsers();

  return <AdminUsersBoard initialUsers={users} currentUserId={user.id} />;
}
