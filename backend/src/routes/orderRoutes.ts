import { Router } from "express";
import { OrderController } from "../controllers/orderController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);
router.post("/", OrderController.create);
router.get("/mine", OrderController.getMine);

export default router;
