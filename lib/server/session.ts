import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  cookieSecure,
  createSessionToken,
  parseSessionToken,
  readSessionCookie,
  type SessionPayload,
} from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type DashboardRole = "admin" | "operator";

export type DashboardUser = {
  id: string;
  email: string;
  name: string | null;
  role: DashboardRole;
  active: boolean;
  invited_by: string | null;
  created_at: string;
  last_login_at: string | null;
  email_verified_at: string | null;
};

const USER_COLUMNS =
  "id, email, name, role, active, invited_by, created_at, last_login_at, email_verified_at";

export async function countDashboardUsers(): Promise<number> {
  const db = supabaseAdmin();
  const { count, error } = await db
    .from("dashboard_users")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function getUserByEmail(email: string): Promise<DashboardUser | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("dashboard_users")
    .select(USER_COLUMNS)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return (data as DashboardUser | null) ?? null;
}

export async function getUserById(id: string): Promise<DashboardUser | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("dashboard_users").select(USER_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as DashboardUser | null) ?? null;
}

export async function getUserWithPassword(email: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("dashboard_users")
    .select(`${USER_COLUMNS}, password_hash`)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data as (DashboardUser & { password_hash: string }) | null;
}

export async function listDashboardUsers(): Promise<DashboardUser[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("dashboard_users")
    .select(USER_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DashboardUser[];
}

export async function createDashboardUser(input: {
  email: string;
  passwordHash: string;
  name?: string | null;
  role: DashboardRole;
  invitedBy?: string | null;
  emailVerified?: boolean;
}) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("dashboard_users")
    .insert({
      email: input.email.trim().toLowerCase(),
      password_hash: input.passwordHash,
      name: input.name?.trim() || null,
      role: input.role,
      invited_by: input.invitedBy ?? null,
      email_verified_at: input.emailVerified ? new Date().toISOString() : null,
    })
    .select(USER_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("DUPLICATE_EMAIL");
    throw error;
  }
  return data as DashboardUser;
}

export async function countActiveAdmins(): Promise<number> {
  const db = supabaseAdmin();
  const { count, error } = await db
    .from("dashboard_users")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("active", true);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteDashboardUser(userId: string) {
  const db = supabaseAdmin();
  const { error } = await db.from("dashboard_users").delete().eq("id", userId);
  if (error) throw error;
}

export async function getPendingInviteByEmail(email: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("dashboard_invites")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type DashboardInvite = {
  id: string;
  email: string;
  role: DashboardRole;
  expires_at: string;
  created_at: string;
  invited_by: string;
};

export async function listPendingInvites(): Promise<DashboardInvite[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("dashboard_invites")
    .select("id, email, role, expires_at, created_at, invited_by")
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DashboardInvite[];
}

export async function getPendingInviteById(id: string): Promise<DashboardInvite | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("dashboard_invites")
    .select("id, email, role, expires_at, created_at, invited_by")
    .eq("id", id)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return (data as DashboardInvite | null) ?? null;
}

export async function deleteInvite(id: string) {
  const db = supabaseAdmin();
  const { error } = await db.from("dashboard_invites").delete().eq("id", id).is("accepted_at", null);
  if (error) throw error;
}

export async function updatePasswordHash(userId: string, passwordHash: string) {
  const db = supabaseAdmin();
  const { error } = await db.from("dashboard_users").update({ password_hash: passwordHash }).eq("id", userId);
  if (error) throw error;
}

export async function touchLastLogin(userId: string) {
  const db = supabaseAdmin();
  const { error } = await db
    .from("dashboard_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function createInvite(input: {
  email: string;
  role: DashboardRole;
  invitedBy: string;
  token: string;
  expiresAt: Date;
}) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("dashboard_invites")
    .insert({
      email: input.email.trim().toLowerCase(),
      role: input.role,
      invited_by: input.invitedBy,
      token: input.token,
      expires_at: input.expiresAt.toISOString(),
    })
    .select("id, email, role, token, expires_at, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function getInviteByToken(token: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("dashboard_invites")
    .select("id, email, role, token, expires_at, accepted_at, invited_by")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function markInviteAccepted(id: string) {
  const db = supabaseAdmin();
  await db.from("dashboard_invites").update({ accepted_at: new Date().toISOString() }).eq("id", id);
}

export async function markEmailVerified(userId: string) {
  const db = supabaseAdmin();
  await db
    .from("dashboard_users")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", userId);
}

export async function createEmailVerification(userId: string, token: string, expiresAt: Date) {
  const db = supabaseAdmin();
  await db.from("dashboard_email_verifications").delete().eq("user_id", userId);
  const { error } = await db.from("dashboard_email_verifications").insert({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;
}

export async function getEmailVerificationByToken(token: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("dashboard_email_verifications")
    .select("id, user_id, token, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteEmailVerification(id: string) {
  const db = supabaseAdmin();
  await db.from("dashboard_email_verifications").delete().eq("id", id);
}

export async function sessionFromRequest(req: Request): Promise<SessionPayload | null> {
  const secret = process.env.SESSION_SECRET || "";
  const token = readSessionCookie(req.headers.get("cookie"));
  return parseSessionToken(token, secret);
}

export async function sessionFromCookies(): Promise<SessionPayload | null> {
  const secret = process.env.SESSION_SECRET || "";
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return parseSessionToken(token, secret);
}

export async function getSessionUser(): Promise<DashboardUser | null> {
  const session = await sessionFromCookies();
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || !user.active || !user.email_verified_at) return null;
  if (!user.last_login_at) {
    await touchLastLogin(user.id);
    return { ...user, last_login_at: new Date().toISOString() };
  }
  return user;
}

export async function requireSessionUser(): Promise<DashboardUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin(): Promise<DashboardUser> {
  const user = await requireSessionUser();
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

export function attachSessionCookie(res: NextResponse, token: string, req: Request) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(req),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

export async function issueSessionResponse(req: Request, userId: string, body: Record<string, unknown> = { ok: true }) {
  const secret = process.env.SESSION_SECRET || "";
  if (!secret) {
    return NextResponse.json({ error: "SESSION_SECRET is not configured" }, { status: 500 });
  }
  await touchLastLogin(userId);
  const token = await createSessionToken(secret, userId);
  const res = NextResponse.json(body);
  return attachSessionCookie(res, token, req);
}
