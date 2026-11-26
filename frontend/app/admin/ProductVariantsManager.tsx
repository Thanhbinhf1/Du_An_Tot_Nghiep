import AdminProductWorkspace from "./AdminProductWorkspace";
import type { readApiEnvelope } from "@/lib/api";
export type AdminRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
export type AdminPaginatedRequest = <T>(path: string, init?: RequestInit) => ReturnType<typeof readApiEnvelope<T>>;
export default AdminProductWorkspace;
