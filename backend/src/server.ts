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

import productRoutes from "./routes/productRoutes.js";
import authRoutes from "./routes/authRoutes.js";

import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";

const app: Application = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "API Backend F.Style Store đang hoạt động mượt mà!",
  });
});

// Routes Nghiệp vụ
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

// Error Handling Middlewares (Phải nằm cuối)
app.use(notFound);
app.use(errorHandler);

// Khởi động server
const PORT = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🌟 Server đang chạy tại http://localhost:${PORT}`);
  });
};

startServer().catch((error: unknown) => {
  console.error("❌ Không thể khởi động server:", error);
  process.exit(1);
});
