// backend/src/types/auth.ts
export type UserRole = "customer" | "staff" | "admin";

export interface IJwtPayload {
  id: string;
  role: UserRole;
  iat?: number; // Thời gian phát hành (jsonwebtoken tự sinh)
  exp?: number; // Thời gian hết hạn (jsonwebtoken tự sinh)
}
