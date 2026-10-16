import "dotenv/config";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
dotenv.config();

const app: Application = express();

// Middleware cơ bản
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);
app.use("/api/users"); //

// Route kiểm tra server
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "API Backend VSC_BAPD đang hoạt động!",
  });
});

const PORT = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
};

startServer().catch((error: unknown) => {
  console.error("Không thể khởi động server:", error);
  process.exit(1);
});
