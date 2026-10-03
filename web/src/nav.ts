import { can, type Permission, type Role } from "@shared/roles";

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: string;
  permission: Permission;
  // Hidden from roles that have a better home for the same thing.
  hideFor?: Role[];
}

export const NAV: NavItem[] = [
  { id: "scout", label: "Scout", to: "/scout", icon: "scout", permission: "scout", hideFor: ["strategist"] },
  { id: "strategy", label: "Strategy", to: "/strategy", icon: "strategy", permission: "strategy" },
  { id: "picks", label: "Picks", to: "/picks", icon: "picks", permission: "strategy" },
  { id: "manager", label: "Manager", to: "/manager", icon: "manager", permission: "manage" },
  { id: "admin", label: "Admin", to: "/admin", icon: "admin", permission: "admin" },
  { id: "more", label: "More", to: "/more", icon: "more", permission: "scout" },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((item) => can(role, item.permission) && !item.hideFor?.includes(role));
}

export function homeFor(role: Role): string {
  switch (role) {
    case "lead":
    case "strategist":
      return "/strategy";
    case "manager":
      return "/manager";
    default:
      return "/scout";
  }
}
