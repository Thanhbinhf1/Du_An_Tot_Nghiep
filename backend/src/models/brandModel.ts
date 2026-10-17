import mongoose, { Document, Schema } from "mongoose";

export interface IBrand extends Document {
  name: string;
  slug: string;
  description: string;
  logo?: string;
  status: boolean;
  created_at: Date;
  updated_at: Date;
}

const brandSchema = new Schema<IBrand>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: "",
    },
    logo: {
      type: String,
      default: "",
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

const Brand = mongoose.model<IBrand>("Brand", brandSchema);

export default Brand;
