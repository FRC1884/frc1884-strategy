// Roles for the hub. The sign-in code a person enters decides their role.
// Shared by the server (route guards) and the web app (which tabs to show).

export const ROLES = ["scout", "manager", "strategist", "lead"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  scout: "Scout",
  manager: "Scout manager",
  strategist: "Strategist",
  lead: "Lead",
};

// What each area of the hub requires. A lead can do everything.
export const PERMISSIONS = {
  scout: ["scout", "manager", "strategist", "lead"],
  manage: ["manager", "lead"],
  strategy: ["strategist", "lead"],
  admin: ["lead"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
