import type { QueryFilter } from "mongoose";
import type { IOrder } from "../models/orderModel.js";
import { AppError } from "../middlewares/AppError.js";

// These filters drive both dashboard counts and the order lists they open.
export const orderQueues = {
  ready: {
    order_status: "pending",
    $or: [{ payment_status: "success" }, { payment_method: "COD", payment_status: "pending" }],
  },
  awaiting_payment: {
    order_status: "pending", payment_method: { $ne: "COD" }, payment_status: "pending",
  },
  packing: { order_status: "processing" },
  delivery_issue: { order_status: "delivery_failed" },
  incoming_return: { order_status: "returning" },
  refund_due: { order_status: { $in: ["cancelled", "returned"] }, payment_status: "success" },
} satisfies Record<string, QueryFilter<IOrder>>;

export function orderQueueFilter(queue: unknown): QueryFilter<IOrder> {
  if (queue === undefined || queue === "" || queue === "all") return {};
  if (typeof queue !== "string" || !Object.hasOwn(orderQueues, queue)) {
    throw new AppError("Nhóm công việc không hợp lệ.", 400);
  }
  return orderQueues[queue as keyof typeof orderQueues];
}
