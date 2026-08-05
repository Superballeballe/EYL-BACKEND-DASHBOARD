import { redirect } from "next/navigation";
import ProfileForm from "@/components/ProfileForm";
import { getSessionUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <ProfileForm
      user={{
        email: user.email,
        name: user.name,
        role: user.role,
      }}
    />
  );
}
