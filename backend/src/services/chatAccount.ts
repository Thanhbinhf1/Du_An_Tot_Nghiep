import type { Types } from "mongoose";
import Order, { type IOrder } from "../models/orderModel.js";
import Address from "../models/addressModel.js";
import { customerOrderActions } from "../controllers/orderController.js";
import { AppError } from "../middlewares/AppError.js";
import { configuredPaymentMethods, checkoutPaymentMethodIssue, type SupportedPaymentMethod } from "../config/paymentMethods.js";
import { getCheckoutCart } from "./checkoutCart.js";
import { calculateCheckoutPrice, previewCouponDiscount } from "./checkoutPricing.js";
import { getProvince, provinces } from "./addressLocations.js";
import { fold, type ChatTurn } from "./chatIntent.js";
import { vnd, type Reply } from "./chatShopping.js";

const login = { label: "Đăng nhập", href: "/dang-nhap?returnTo=%2Forders" };
const orderList = { label: "Đơn hàng của tôi", href: "/orders" };
const support = { label: "Liên hệ shop", href: "/contact" };
const checkout = { label: "Đến thanh toán", href: "/checkout" };
const cart = { label: "Xem giỏ hàng", href: "/cart" };

export type OrderCard = {
  kind: "order"; id: string; code: string; href: string;
  status: IOrder["order_status"]; paymentStatus: IOrder["payment_status"]; paymentMethod: IOrder["payment_method"];
  updatedAt: Date; trackingNumber?: string; estimatedDelivery?: Date; refundAmount?: number;
  actions: { cancel: boolean; pay: boolean; returnRequest: boolean };
};
const orderFields = "order_status payment_status payment_method final_amount tracking_number estimated_delivery updated_at created_at refund.amount";

export async function readOrders(turn: ChatTurn, userId?: Types.ObjectId): Promise<Reply<OrderCard> & { selected?: string }> {
  if (!userId) return { text: "Bạn đăng nhập để mình tra đơn thuộc tài khoản của bạn nhé.", links: [login] };
  const reference = turn.orderId;
  const suffix = reference?.length === 8 ? reference.toLowerCase() : undefined;
  const orders = await Order.find({
    user_id: userId,
    ...(suffix ? { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: `${suffix}$` } } }
      : reference ? { _id: reference } : {}),
  }).select(orderFields).sort({ created_at: -1, _id: -1 }).limit(5).lean().maxTimeMS(3500);
  if (!orders.length) return {
    text: reference ? "Mình không thể mở đơn này. Bạn hãy chọn đơn trong danh sách của tài khoản hoặc liên hệ shop." : "Tài khoản của bạn chưa có đơn hàng.",
    links: [orderList, support],
  };
  const cards = orders.map((order): OrderCard => {
    const id = String(order._id);
    return {
      kind: "order", id, code: id.slice(-8).toUpperCase(), href: `/orders/${id}`,
      status: order.order_status, paymentStatus: order.payment_status, paymentMethod: order.payment_method,
      updatedAt: order.updated_at ?? order.created_at,
      ...(order.tracking_number ? { trackingNumber: order.tracking_number } : {}),
      ...(order.estimated_delivery ? { estimatedDelivery: order.estimated_delivery } : {}),
      ...(order.payment_status === "refunded" && order.refund ? { refundAmount: order.refund.amount } : {}),
      actions: { ...customerOrderActions(order), returnRequest: order.order_status === "completed" },
    };
  });
  const selected = cards.length === 1 ? cards[0] : undefined;
  if (!selected) return { text: "Bạn muốn kiểm tra đơn nào? Chọn một đơn bên dưới hoặc mở danh sách đầy đủ.", question: true, cards, links: [orderList] };
  const payment = selected.paymentStatus === "pending" && selected.paymentMethod !== "COD" ? " Đơn đang chờ xác nhận thanh toán."
    : selected.paymentStatus === "refunded" ? " Hệ thống đã ghi nhận hoàn tiền."
      : selected.paymentStatus === "success" ? " Hệ thống đã ghi nhận thanh toán."
        : selected.paymentStatus === "failed" ? " Giao dịch thanh toán thất bại." : "";
  const delivery = selected.status === "delivery_failed" ? " Giao hàng thất bại và đang chờ xử lý."
    : selected.status === "returning" ? " Kiện hàng đang được hoàn về shop."
      : selected.status === "returned" ? " Shop đã ghi nhận kết quả kiểm hàng hoàn." : "";
  const details = turn.orderAction === "cancel" && !selected.actions.cancel ? " Đơn này hiện không có thao tác hủy trực tuyến."
    : turn.orderAction === "return" && !selected.actions.returnRequest ? " Đơn này hiện chưa có thao tác yêu cầu đổi trả trực tuyến."
      : selected.actions.cancel ? " Bạn có thể hủy trong trang chi tiết đơn."
        : selected.actions.returnRequest ? " Trang chi tiết có biểu mẫu gửi yêu cầu đổi hoặc trả để shop xét điều kiện."
          : " Xem trang chi tiết để kiểm tra các thao tác đang khả dụng.";
  return {
    text: `Đây là cập nhật cho đơn #${selected.code}.${payment}${delivery}${details}`,
    cards,
    links: [orderList, support],
    selected: selected.id,
  };
}

const explanations: Record<SupportedPaymentMethod, string> = {
  COD: "COD — thanh toán khi nhận hàng.",
  BankTransfer: "Chuyển khoản ngân hàng — dùng thông tin trên trang thanh toán và chờ shop xác nhận giao dịch.",
  MoMo: "MoMo — chọn tại checkout, xác nhận bên MoMo rồi đợi hệ thống cập nhật.",
  SePay: "SePay — thanh toán bằng mã QR tại checkout, hệ thống cập nhật khi nhận đối soát.",
};
export async function paymentAdvice(userId?: Types.ObjectId): Promise<Reply> {
  const methods = configuredPaymentMethods();
  let applicable = methods;
  if (userId) {
    try {
      const { rows, subtotal } = await getCheckoutCart(userId);
      if (rows.length) {
        const price = await calculateCheckoutPrice(subtotal, { method: "Standard", code: "" });
        applicable = methods.filter((method) => !checkoutPaymentMethodIssue(method, price.final_amount));
      }
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) throw error;
    }
  }
  const inactive = [
    "VNPay đã ngừng tạo giao dịch mới.",
    ...(["BankTransfer", "MoMo"] as const).filter((method) => !methods.includes(method))
      .map((method) => `${method === "BankTransfer" ? "Chuyển khoản ngân hàng" : method} hiện chưa khả dụng.`),
  ];
  const limited = methods.length !== applicable.length ? " Một số phương thức có giới hạn theo tổng tiền. Checkout sẽ đối chiếu lại sau khi chọn giao hàng và ưu đãi." : "";
  return { text: [applicable.map((method) => explanations[method]).join("\n"), inactive.join(" ") + limited,
    "Bạn kiểm tra trạng thái giao dịch trong chi tiết đơn. Giữ riêng mật khẩu, OTP và thông tin thẻ."].filter(Boolean).join("\n"), links: [checkout] };
}

export async function couponAdvice(turn: ChatTurn, userId?: Types.ObjectId): Promise<Reply> {
  if (!turn.coupon) return { text: "Bạn muốn kiểm tra mã giảm giá nào?", question: true, links: [cart] };
  try {
    const saved = userId ? await getCheckoutCart(userId) : undefined;
    const subtotal = saved?.rows.length ? saved.subtotal : turn.amount;
    if (subtotal === undefined) return { text: "Bạn cho mình tổng tiền hàng trước phí vận chuyển để kiểm tra mã nhé?", question: true, links: [cart] };
    const { discount } = await previewCouponDiscount(turn.coupon, subtotal);
    return { text: `Mã ${turn.coupon} dự kiến giảm ${vnd(discount)} trên tiền hàng ${vnd(subtotal)}. Checkout sẽ kiểm tra lại khi bạn đặt hàng.`, links: [checkout] };
  } catch (error) {
    if (error instanceof AppError && error.statusCode < 500) return { text: error.message, links: [cart] };
    throw error;
  }
}

const placeName = (name: string) => fold(name).replace(/^(?:tinh|thanh pho|tp\.?|phuong|xa|dac khu)\s+/, "");
const includesPlace = (text: string, place: string) => ` ${text.replace(/[^a-z0-9]+/g, " ")} `.includes(` ${place} `);
const aliases: Record<string, string[]> = { "ho chi minh": ["tp hcm", "hcm", "sai gon", "tphcm"], "ha noi": ["hn"] };
const deliveryPolicy = { label: "Chính sách giao hàng", href: "/shipping" };

export async function shippingAdvice(turn: ChatTurn, userId?: Types.ObjectId): Promise<Reply & { province?: string }> {
  try {
    const [saved, address] = await Promise.all([
      userId ? getCheckoutCart(userId) : undefined,
      userId ? Address.findOne({ user_id: userId, is_default: true }).select("province_code ward_code").lean() : undefined,
    ]);
    const subtotal = saved?.rows.length ? saved.subtotal : turn.amount;
    const provinceText = turn.province ?? "";
    const province = provinces.find(({ name }) => {
      const place = placeName(name);
      return [place, ...(aliases[place] ?? [])].some((name) => includesPlace(provinceText, name));
    });
    const location = province ? getProvince(province.code) : undefined;
    const ward = location?.wards.find(({ name }) => {
      const nameOnly = placeName(name);
      return nameOnly !== placeName(location.name) && includesPlace(provinceText, nameOnly);
    });
    const codes = location ? { province_code: location.code, ward_code: ward?.code } : address;
    const context = province ? { province: placeName(province.name) } : {};
    const links = [deliveryPolicy, checkout];
    if (turn.express && (!codes?.province_code || !codes.ward_code)) return {
      text: province ? `Bạn ở phường, xã hoặc đặc khu nào tại ${province.name} để mình kiểm tra giao hỏa tốc?` :
        "Bạn gửi tỉnh/thành và phường/xã nhận hàng để mình kiểm tra giao hỏa tốc nhé?", question: true, links, ...context,
    };
    const price = await calculateCheckoutPrice(subtotal ?? 0, { method: "Standard", code: "", location: codes ?? null });
    if (turn.express && !price.express_available) return {
      text: `Khu vực này chưa hỗ trợ giao hỏa tốc. ${subtotal !== undefined ? `Phí giao tiêu chuẩn dự kiến ${vnd(price.standard_shipping_fee)}.` : "Bạn có thể xem báo giá giao tiêu chuẩn tại checkout."}`, links, ...context,
    };
    const cost = turn.express ? `Phí giao hỏa tốc dự kiến ${vnd(price.express_shipping_fee)}.`
      : subtotal === undefined ? `Phí giao tiêu chuẩn từ ${vnd(price.standard_shipping_fee)}. Miễn phí từ tổng tiền hàng ${vnd(price.free_shipping_threshold)}.`
      : `Phí giao tiêu chuẩn dự kiến ${vnd(price.standard_shipping_fee)} với tiền hàng ${vnd(subtotal)}.`;
    const destination = location ?? (codes?.province_code && provinces.some((item) => item.code === codes.province_code)
      ? getProvince(codes.province_code) : undefined);
    const hasUrbanWindow = destination && ["ha noi", "ho chi minh"].includes(placeName(destination.name));
    const eta = turn.express
      ? " Thời gian giao hỏa tốc còn tùy khu vực và đơn vị vận chuyển. Xem khung dự kiến trong chính sách giao hàng."
      : destination
        ? ` Theo chính sách giao hàng, thời gian tiêu chuẩn đến ${destination.name} dự kiến ${hasUrbanWindow ? "1–3 ngày làm việc tùy khu vực" : "3–5 ngày làm việc"}.`
        : " Bạn có thể xem khung thời gian dự kiến theo khu vực trong chính sách giao hàng.";
    return { text: cost + eta, links, ...context };
  } catch (error) {
    if (error instanceof AppError && error.statusCode < 500) return { text: error.message, links: [cart, deliveryPolicy] };
    throw error;
  }
}

export async function cartAdvice(userId?: Types.ObjectId): Promise<Reply> {
  if (!userId) return { text: "Bạn đăng nhập để xem giỏ và thêm sản phẩm nhé.",
    links: [{ label: "Đăng nhập", href: "/dang-nhap?returnTo=%2Fcart" }] };
  const { rows } = await getCheckoutCart(userId);
  return { text: "Bạn có thể chọn biến thể và bấm “Thêm vào giỏ” ngay trên thẻ sản phẩm. Giỏ hàng có thông tin số lượng và giá hiện tại.",
    links: rows.length ? [cart, checkout] : [cart, { label: "Xem sản phẩm", href: "/products" }] };
}
