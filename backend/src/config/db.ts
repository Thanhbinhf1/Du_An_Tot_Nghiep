import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  const uri = process.env.DATABASE;

  if (!uri) {
    throw new Error("Chưa cấu hình DATABASE trong file .env");
  }

  await mongoose.connect(uri);

  console.log("Kết nối MongoDB Atlas thành công!");
};

export default connectDB;
