import express from "express";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Fashion API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/products", productRoutes);
console.log("Product routes registered");

export default app;
