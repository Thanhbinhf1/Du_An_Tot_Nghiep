import type { Request, Response, NextFunction } from "express";
import type { IUser } from "../models/userModel.js";
export interface AuthRequest extends Request {
    user?: IUser;
}
export declare const protect: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=authMiddleware.d.ts.map