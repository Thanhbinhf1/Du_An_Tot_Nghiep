import mongoose = require("mongoose");
("mongoose");

export const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_LOCAL as string);

    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};
