export interface IRegisterData {
    name: string;
    email: string;
    password: string;
    phone?: string;
}
export declare class AuthService {
    private static generateToken;
    static registerUser(data: IRegisterData): Promise<{
        _id: import("mongoose").Types.ObjectId;
        name: string;
        email: string;
        role: import("../types/auth.js").UserRole;
        token: string;
    }>;
    static loginUser(email: string, password: string): Promise<{
        _id: import("mongoose").Types.ObjectId;
        name: string;
        email: string;
        password?: string;
        phone?: string;
        role: import("../types/auth.js").UserRole;
        is_blocked: boolean;
        auth_provider: "local" | "google";
        createdAt?: Date;
        updatedAt?: Date;
        token: string;
        __v: number;
    }>;
}
//# sourceMappingURL=authService.d.ts.map