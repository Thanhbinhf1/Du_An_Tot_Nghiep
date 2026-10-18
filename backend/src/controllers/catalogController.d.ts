import type { Request, Response, NextFunction } from "express";
export declare class CatalogController {
    static getCategories(_req: Request, res: Response, next: NextFunction): Promise<void>;
    static getProducts(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getProduct(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=catalogController.d.ts.map