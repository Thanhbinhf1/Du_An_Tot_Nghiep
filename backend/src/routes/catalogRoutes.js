import { Router } from "express";
import { CatalogController } from "../controllers/catalogController.js";
const router = Router();
router.get("/categories", CatalogController.getCategories);
router.get("/products", CatalogController.getProducts);
router.get("/products/:id", CatalogController.getProduct);
export default router;
//# sourceMappingURL=catalogRoutes.js.map