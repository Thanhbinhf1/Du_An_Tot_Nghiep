import mongoose, { Document, Schema } from "mongoose";

export interface ICoupon extends Document {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_value: number;
  max_discount?: number | null;
  usage_limit: number;
  used_count: number;
  start_date: Date;
  end_date: Date;
  status: boolean;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    discount_type: {
      type: String,
      enum: ["percent", "fixed"],
      default: "percent",
    },

    discount_value: {
      type: Number,
      required: true,
      min: 0,
    },

    min_order_value: {
      type: Number,
      default: 0,
      min: 0,
    },

    max_discount: {
      type: Number,
      default: null,
      min: 0,
    },

    usage_limit: {
      type: Number,
      required: true,
      min: 1,
    },

    used_count: {
      type: Number,
      default: 0,
      min: 0,
    },

    start_date: {
      type: Date,
      required: true,
    },

    end_date: {
      type: Date,
      required: true,
    },

    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: false,
  },
);

// Không cho discount percent > 100%
couponSchema.path("discount_value").validate(function (value: number) {
  if (this.discount_type === "percent" && value > 100) {
    return false;
  }

  return true;
}, "Phần trăm giảm giá không được vượt quá 100%");

const Coupon = mongoose.model<ICoupon>("Coupon", couponSchema);

export default Coupon;
