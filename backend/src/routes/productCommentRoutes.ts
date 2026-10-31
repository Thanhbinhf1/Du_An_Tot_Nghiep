import { Router } from "express";
import { ProductCommentController } from "../controllers/productCommentController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/:productKey", ProductCommentController.getForProduct);
router.post("/:productKey", protect, ProductCommentController.saveForProduct);

export default router;
