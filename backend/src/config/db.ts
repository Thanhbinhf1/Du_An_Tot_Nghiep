import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Ép kiểu (as string) để TypeScript hiểu biến môi trường này luôn tồn tại
    const conn = await mongoose.connect(process.env.DATABASE as string);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Lỗi kết nối MongoDB: ${(error as Error).message}`);
    process.exit(1); // Dừng toàn bộ server nếu không kết nối được Database
  }
};

export default connectDB;
