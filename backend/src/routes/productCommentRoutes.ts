import { Router } from "express";
import { ProductCommentController } from "../controllers/productCommentController.js";
import { ReviewReportController } from "../controllers/reviewReportController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/:productKey", ProductCommentController.getForProduct);
router.get("/:productKey/eligibility", protect, ProductCommentController.getEligibility);
router.post("/:productKey", protect, ProductCommentController.saveForProduct);
router.post("/:productKey/reports/:reviewId", protect, ReviewReportController.create);

export default router;
