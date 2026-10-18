import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const databaseUrl = process.env.DATABASE ?? process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("Thiếu cấu hình DATABASE hoặc DATABASE_URL");
    }
    const conn = await mongoose.connect(databaseUrl);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Lỗi kết nối MongoDB: ${(error as Error).message}`);
    process.exit(1); // Dừng toàn bộ server nếu không kết nối được Database
  }
};

export default connectDB;
