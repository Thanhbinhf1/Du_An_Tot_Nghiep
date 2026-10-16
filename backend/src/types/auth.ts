export type UserRole = "customer" | "staff" | "admin";

export interface IJwtPayload {
  id: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
