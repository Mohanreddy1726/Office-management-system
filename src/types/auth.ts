export type UserRole = "super_admin" | "hr_admin" | "manager" | "employee";

export interface SessionPayload {
  userId: string;
  employeeId?: string;
  email: string;
  name: string;
  role: UserRole;
  branch: string;
}

export const AUTH_COOKIE_NAME = "rendesk_token";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  manager: "Manager / Team Lead",
  employee: "Employee",
};
