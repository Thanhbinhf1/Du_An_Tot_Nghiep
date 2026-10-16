import { Router } from "express";
import { AuthController } from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";
// Tạm thời comment roleMiddleware vì chưa có route nào xài tới ở bước này
// import { authorize } from '../middlewares/roleMiddleware.js';

const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);

// Gọi route để test JWT Middleware
router.get("/me", protect, AuthController.getMe);

export default router;
