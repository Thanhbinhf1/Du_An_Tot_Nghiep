import { Router } from "express";
import { protect, type AuthRequest } from "../middlewares/authMiddleware.js";
import { ProductImageController } from "../controllers/productImageController.js";

const router = Router({ mergeParams: true });

const requireAdmin = (
  req: AuthRequest,
  res: import("express").Response,
  next: import("express").NextFunction,
) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Không có quyền Admin" });
  }
  next();
};

router.get("/", ProductImageController.getImages);
router.get("/:imageId", ProductImageController.getImage);

router.post("/", protect, requireAdmin, ProductImageController.createImage);
router.patch(
  "/:imageId",
  protect,
  requireAdmin,
  ProductImageController.updateImage,
);
router.delete(
  "/:imageId",
  protect,
  requireAdmin,
  ProductImageController.deleteImage,
);

export default router;
