import { Router } from "express";
import { CouponController } from "../controllers/couponController.js";

const router = Router();

router.post("/validate", CouponController.validate);

export default router;
