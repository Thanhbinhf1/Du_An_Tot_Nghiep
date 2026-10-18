import type { Request, Response, NextFunction } from "express";
export declare class AdminController {
    static createCategory(req: Request, res: Response, next: NextFunction): Promise<void>;
    static updateCategory(req: Request, res: Response, next: NextFunction): Promise<void>;
    static deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void>;
    static createProduct(req: Request, res: Response, next: NextFunction): Promise<void>;
    static updateProduct(req: Request, res: Response, next: NextFunction): Promise<void>;
    static deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=adminController.d.ts.map