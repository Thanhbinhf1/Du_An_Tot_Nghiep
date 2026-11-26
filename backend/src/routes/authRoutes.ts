import { Router } from "express";
import { normalizeRequestBody } from "../middlewares/requestBodyMiddleware.js";
import { AuthController } from "../controllers/authController.js";
import { AuthService } from "../services/authService.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();
router.use(normalizeRequestBody);

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);
router.get("/google", (_req, res) => {
  res.json({ status: "success", data: { clientId: process.env.GOOGLE_CLIENT_ID?.trim() || null } });
});
router.post("/google", async (req, res) => {
  const result = await AuthService.loginGoogle(req.body?.credential);
  res.json({ status: "success", data: result });
});
router.get("/me", protect, AuthController.getMe);
router.patch("/me", protect, AuthController.updateMe);
router.patch("/password", protect, AuthController.changePassword);

export default router;
