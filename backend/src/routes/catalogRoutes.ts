import { Router } from "express";
import { CatalogController } from "../controllers/catalogController.js";

const router = Router();

router.get("/categories", CatalogController.getCategories);
router.get("/store-info", CatalogController.storeInfo);
router.get("/outfits", CatalogController.getOutfits);
router.get("/best-sellers", CatalogController.getBestSellers);
router.get("/size-chart", CatalogController.getSizeChart);
router.get("/size-recommendations", CatalogController.recommendSize);
router.post("/size-recommendations", CatalogController.recommendSize);
router.get("/products", CatalogController.getProducts);
router.get("/products/:id", CatalogController.getProduct);

export default router;
