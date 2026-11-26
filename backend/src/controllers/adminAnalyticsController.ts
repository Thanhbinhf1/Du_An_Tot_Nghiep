import type { Request, Response, NextFunction } from "express";
import { orderQueues } from "../services/adminOrderQueues.js";
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import OrderStatusHistory from "../models/orderStatusHistoryModel.js";
import InventoryMovement from "../models/inventoryMovementModel.js";
import { recognizedOrder, completionDate, merchandising } from "../services/adminAnalytics.js";

export class AdminAnalyticsController {
  static async activity(_req: Request, res: Response, next: NextFunction) {
    try {
      const [orders, inventory] = await Promise.all([
        OrderStatusHistory.find().select("order_id status changed_by created_at").sort({ created_at: -1, _id: -1 }).limit(50)
          .populate<{ changed_by: { name: string } | null }>("changed_by", "name").lean(),
        InventoryMovement.find().select("variant_id kind actor_id created_at stock_delta quarantine_delta").sort({ created_at: -1, _id: -1 }).limit(50)
          .populate<{ actor_id: { name: string } | null; variant_id: { sku: string } | null }>([{ path: "actor_id", select: "name" }, { path: "variant_id", select: "sku" }]).lean(),
      ]);
      res.json({ status: "success", data: {
        orders: orders.map((item) => ({
          id: String(item._id), orderId: String(item.order_id), action: item.status, actor: item.changed_by?.name, at: item.created_at,
        })),
        inventory: inventory.map((item) => ({
          id: String(item._id), sku: item.variant_id?.sku, action: item.kind, actor: item.actor_id?.name, at: item.created_at,
          stockDelta: item.stock_delta, quarantineDelta: item.quarantine_delta ?? 0,
        })),
      } });
    } catch (error) { next(error); }
  }

  static async dashboard(_req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      // Mốc tháng theo múi giờ Việt Nam, không phụ thuộc timezone của hosting.
      const local = new Date(now.getTime() + 7 * 3600_000);
      const year = local.getUTCFullYear(), month = local.getUTCMonth();
      const since = new Date(Date.UTC(year, month - 5, 1) - 7 * 3600_000);
      const today = Date.UTC(year, month, local.getUTCDate());
      const recentSince = new Date(today - 41 * 86400_000 - 7 * 3600_000);
      type RevenueBucket = { _id: string; revenue: number; orders: number };
      const [totalOrders, pendingOrders, totalProducts, totalCustomers, statuses, revenue, timeline, recentOrders, goods, queueCounts] = await Promise.all([
        Order.countDocuments(), Order.countDocuments({ order_status: "pending" }), Product.countDocuments({ status: true }), User.countDocuments({ role: "customer" }),
        Order.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$order_status", count: { $sum: 1 } } }]),
        Order.aggregate([{ $match: recognizedOrder }, { $group: { _id: null, revenue: { $sum: "$final_amount" } } }]),
        Order.aggregate<{ month: RevenueBucket[]; day: RevenueBucket[] }>([
          { $match: recognizedOrder },
          { $set: { recognized_at: completionDate } },
          { $match: { recognized_at: { $gte: since, $lte: now } } },
          { $facet: {
            month: [{ $group: { _id: { $dateToString: { date: "$recognized_at", format: "%Y-%m", timezone: "Asia/Ho_Chi_Minh" } }, revenue: { $sum: "$final_amount" }, orders: { $sum: 1 } } }],
            day: [
              { $match: { recognized_at: { $gte: recentSince } } },
              { $group: { _id: { $dateToString: { date: "$recognized_at", format: "%Y-%m-%d", timezone: "Asia/Ho_Chi_Minh" } }, revenue: { $sum: "$final_amount" }, orders: { $sum: 1 } } },
            ],
          } },
        ]),
        Order.find().select("receiver_name receiver_phone final_amount order_status payment_method created_at").sort({ created_at: -1 }).limit(6).lean(), merchandising(now),
        Order.aggregate([{ $facet: Object.fromEntries(Object.entries(orderQueues).map(([key, filter]) => [key, [{ $match: filter }, { $count: "total" }]])) }]),
      ]);
      const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(Date.UTC(year, month - 5 + i, 1));
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        const value = timeline[0]?.month.find((item) => item._id === key);
        return { label: `T${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`, revenue: value?.revenue ?? 0, orders: value?.orders ?? 0 };
      });
      const dailyRevenue = Array.from({ length: 42 }, (_, index) => {
        const date = new Date(today - (41 - index) * 86400_000).toISOString().slice(0, 10);
        const value = timeline[0]?.day.find((item) => item._id === date);
        return { date, revenue: value?.revenue ?? 0, orders: value?.orders ?? 0 };
      });
      res.json({ status: "success", data: {
        metrics: { totalOrders, pendingOrders, totalProducts, totalCustomers, totalRevenue: revenue[0]?.revenue ?? 0, lowStockCount: goods.lowStockCount },
        queues: Object.fromEntries(Object.keys(orderQueues).map(key => [key, queueCounts[0]?.[key]?.[0]?.total ?? 0])),
        ordersByStatus: Object.fromEntries(statuses.map((item) => [item._id, item.count])), monthlyRevenue, dailyRevenue, recentOrders, ...goods,
        salesWindowDays: 30,
      } });
    } catch (error) { next(error); }
  }
}
