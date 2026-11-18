import mongoose, { Schema } from "mongoose";

export const reviewReportReasons = ["spam", "abuse", "irrelevant", "other"] as const;

const reviewReportSchema = new Schema(
  {
    review_id: { type: Schema.Types.ObjectId, ref: "ProductComment", required: true },
    reporter_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: reviewReportReasons, required: true },
    details: { type: String, maxlength: 500, default: "" },
    product_key: { type: String, required: true },
    author_name: { type: String, required: true },
    comment: { type: String, required: true },
    rating: { type: Number, required: true },
    dismissed_at: { type: Date, default: null },
    dismissed_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

reviewReportSchema.index({ review_id: 1, reporter_id: 1 }, { unique: true });
reviewReportSchema.index({ dismissed_at: 1, createdAt: -1 });

export default mongoose.model("ReviewReport", reviewReportSchema);
