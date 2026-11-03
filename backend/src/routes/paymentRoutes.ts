import { Router } from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { PaymentController } from "../controllers/paymentController.js";

const router = Router();

router.use(protect);

router.post("/bank-transfer", PaymentController.createBankTransfer);

router.get("/order/:orderId", PaymentController.getPaymentByOrder);

router.patch("/:id/confirm", PaymentController.confirmBankTransfer);

export default router;
