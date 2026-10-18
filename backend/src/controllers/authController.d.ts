import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
export declare class AuthController {
    static register(req: Request, res: Response, next: NextFunction): Promise<void>;
    static login(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=authController.d.ts.map