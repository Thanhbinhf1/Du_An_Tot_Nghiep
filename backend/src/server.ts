import { uploadDirectory } from "./config/uploadStorage.js";
import "dotenv/config";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import connectDB from "./config/db.js";

import "./models/categoryModel.js";
import "./models/brandModel.js";
import Order from "./models/orderModel.js";
import { ensurePaymentIndexes } from "./models/paymentModel.js";

import productRoutes from "./routes/productRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import catalogRoutes from "./routes/catalogRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { StorefrontContentController } from "./controllers/storefrontContentController.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productCommentRoutes from "./routes/productCommentRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import { ContactController } from "./controllers/contactController.js";

import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";

const app: Application = express();

// Middlewares
app.use(cors());
app.use("/api/chat", chatRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  "/uploads",
  express.static(uploadDirectory),
);

// Health check route
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "API Backend VSC_BAPD đang hoạt động.",
  });
});

// Routes nghiệp vụ
app.use("/api/auth", authRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/admin", adminRoutes);
app.get("/api/storefront-content/home", StorefrontContentController.publicHero);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/reviews", productCommentRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.post("/api/contact", ContactController.create);
// Error handling middlewares (phải nằm cuối)
app.use(notFound);
app.use(errorHandler);

// Khởi động server
const PORT = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
  await connectDB();
  await Promise.all([Order.init(), ensurePaymentIndexes()]);
  app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
};

startServer().catch((error: unknown) => {
  console.error("Không thể khởi động server:", error);
  process.exitCode = 1;
});
