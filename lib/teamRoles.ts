export const DASHBOARD_ROLES = ["admin", "operator"] as const;
export type TeamRole = (typeof DASHBOARD_ROLES)[number];

export function isTeamRole(value: unknown): value is TeamRole {
  return typeof value === "string" && (DASHBOARD_ROLES as readonly string[]).includes(value);
}

/**
 * Why an admin may not change a teammate's role, or null when allowed.
 * Admins never change their own role, and the last active admin stays admin,
 * so the team always keeps someone who can manage it.
 */
export function roleChangeError(input: {
  actorId: string;
  target: { id: string; role: TeamRole; active: boolean };
  role: TeamRole;
  activeAdmins: number;
}): string | null {
  const { actorId, target, role, activeAdmins } = input;
  if (target.id === actorId) return "You cannot change your own role.";
  if (target.role === role) return `Already ${role === "admin" ? "an admin" : "an operator"}.`;
  if (target.role === "admin" && target.active && role !== "admin" && activeAdmins <= 1) {
    return "Cannot change the last admin. Make someone else an admin first.";
  }
  return null;
}
