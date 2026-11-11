import { UserRole } from "@podrida/shared";

export const adminRoles = [UserRole.admin, UserRole.superuser];

// Mirrors the backend's manageableUserValidator, to hide what the API would refuse: nobody acts on
// themselves, admins only on regular users, superusers on users and admins, nobody on a superuser.
export function canManage(
  me: { id: string; role: UserRole },
  target: { id: string; role: UserRole },
): boolean {
  if (me.id === target.id || target.role === UserRole.superuser) return false;
  if (target.role === UserRole.admin) return me.role === UserRole.superuser;
  return adminRoles.includes(me.role);
}

// Only superusers change roles, and only between USER and ADMIN.
export function canChangeRole(
  me: { id: string; role: UserRole },
  target: { id: string; role: UserRole },
): boolean {
  return me.role === UserRole.superuser && canManage(me, target);
}

export const roleLabels: Record<UserRole, string> = {
  [UserRole.user]: "Player",
  [UserRole.admin]: "Admin",
  [UserRole.superuser]: "Superuser",
};
