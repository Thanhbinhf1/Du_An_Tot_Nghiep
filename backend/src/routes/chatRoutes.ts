import { Router, json, type ErrorRequestHandler, type NextFunction, type RequestHandler, type Response } from "express";
import { protect, type AuthRequest } from "../middlewares/authMiddleware.js";
import { AppError } from "../middlewares/AppError.js";
import { readChatRequest, readContext, parseTurn, splitQuestions, type ChatTurn } from "../services/chatIntent.js";
import { interpretWithAi, type AiStatus } from "../services/chatAi.js";
import { adviseSize, careAdvice, compareProducts, makeOutfit, preparePurchase, searchProducts, type Reply } from "../services/chatShopping.js";
import { cartAdvice, couponAdvice, paymentAdvice, readOrders, shippingAdvice, type OrderCard } from "../services/chatAccount.js";

const router = Router();
const windowMs = 60_000;
const activeClients = new Map<string, number>();
let expires = 0;
let requests = 0;
const limit: RequestHandler = (req, res, next) => {
  const now = Date.now();
  if (now >= expires) {
    expires = now + windowMs;
    requests = 0;
    activeClients.clear();
  }
  const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const count = activeClients.get(key) ?? 0;
  if (count >= 60 || requests >= 240) {
    res.set("Retry-After", String(Math.ceil((expires - now) / 1000)));
    return next(new AppError("Bạn gửi hơi nhanh. Vui lòng chờ một chút rồi thử lại.", 429));
  }
  requests += 1;
  activeClients.set(key, count + 1);
  next();
};

export async function handleChatMessage(req: AuthRequest, res: Response, next: NextFunction) {
  const controller = new AbortController();
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  res.once("close", disconnect);
  try {
    const request = readChatRequest(req.body);
    let context = request.context;
    let aiStatus: AiStatus = process.env.CHAT_OPENAI_API_KEY?.trim() && process.env.CHAT_OPENAI_MODEL?.trim() ? "ready" : "unconfigured";
    const replies: Reply<NonNullable<Reply["cards"]>[number] | OrderCard>[] = [];
    let question: Reply<NonNullable<Reply["cards"]>[number] | OrderCard> | undefined;
    let questionContext: typeof context | undefined;
    const userId = req.user?._id;
    const pieces = splitQuestions(request.message);
    for (const [index, piece] of (pieces.length ? pieces : [request.message]).entries()) {
      const local = parseTurn(piece, context, request.pageProductId, request.pageColor, request.pageOrderId);
      const { turn, ai }: { turn: ChatTurn; ai: AiStatus } = index === 0
        ? await interpretWithAi(piece, local, controller.signal) : { turn: local, ai: aiStatus };
      if (controller.signal.aborted) return;
      if (ai === "unavailable") aiStatus = ai;
      const shopContext = readContext({
        ...context,
        ...turn,
        filters: ["search", "size", "outfit", "cart"].some((intent) => intent === turn.intent) ? turn.filters : undefined,
        resultProductIds: ["search", "size", "outfit", "compare", "cart"].some((intent) => intent === turn.intent) ? context.resultProductIds : undefined,
        purchasePending: undefined,
        orderId: undefined,
        province: undefined,
        express: turn.intent === "shipping" ? turn.express : undefined,
        amount: turn.intent === "shipping" || turn.intent === "coupon" ? turn.amount : undefined,
      });
      let reply: typeof replies[number];
      if (turn.intent === "greeting" || turn.intent === "thanks") {
        replies.push({
          text: turn.intent === "greeting"
            ? "Chào bạn! Bạn có thể thử lượt tìm bên dưới để mình kiểm tra giá và tồn kho theo màu, size bạn cần."
            : "Không có gì, mình rất vui được giúp bạn!",
          ...(turn.intent === "greeting" ? { suggestions: ["Tìm quần jean đen size L dưới 500k"] } : {}),
        });
        continue;
      }
      if (turn.ordinal !== undefined && !turn.productId) {
        reply = { text: "Mình chưa xác định được mẫu theo số thứ tự đó. Bạn chọn một thẻ đã hiển thị hoặc gửi tên sản phẩm nhé.", question: true };
      } else switch (turn.intent) {
        case "search": reply = await searchProducts(turn.ordinal !== undefined ? {} : turn.filters, turn.productId); break;
        case "compare": reply = await compareProducts(turn); break;
        case "size": reply = await adviseSize(turn); break;
        case "outfit": reply = await makeOutfit(turn); break;
        case "cart": {
          if (!turn.addToCart) { reply = await cartAdvice(userId); break; }
          const result = await preparePurchase(turn, context);
          shopContext.productId = result.productId;
          shopContext.purchasePending = true;
          reply = result;
          break;
        }
        case "coupon": reply = await couponAdvice(turn, userId); break;
        case "payment": reply = await paymentAdvice(userId); break;
        case "shipping": {
          const result = await shippingAdvice(turn, userId);
          shopContext.province = result.province;
          reply = result;
          break;
        }
        case "orders": {
          const result = await readOrders(turn, userId);
          shopContext.orderId = result.selected;
          reply = result;
          break;
        }
        case "returns": reply = {
          text: "Bạn xem chính sách đổi trả hoặc mở đơn hàng để kiểm tra thao tác đang khả dụng. Shop xét yêu cầu theo điều kiện của từng đơn.",
          links: [{ label: "Chính sách đổi trả", href: "/returns" }, { label: "Đơn hàng của tôi", href: userId ? "/orders" : "/dang-nhap?returnTo=%2Forders" }],
        }; break;
        case "care": reply = await careAdvice(turn); break;
        case "buy": reply = { text: "Chọn sản phẩm, size và màu, thêm vào giỏ rồi vào thanh toán. Tại checkout bạn chọn địa chỉ, cách giao hàng và phương thức thanh toán đang khả dụng.",
          links: [{ label: "Xem sản phẩm", href: "/products" }, { label: "Giỏ hàng", href: "/cart" }] }; break;
        case "help": reply = { text: "Bạn có thể gửi nội dung cần hỗ trợ qua biểu mẫu liên hệ của VSC_BAPD.",
          links: [{ label: "Liên hệ VSC_BAPD", href: "/contact" }, { label: "Trung tâm trợ giúp", href: "/help" }] }; break;
        default: reply = { text: "Bạn mô tả cụ thể món đồ hoặc việc cần mình kiểm tra được không?", question: true };
      }
      if (controller.signal.aborted) return;
      if (turn.intent !== "size" || !reply.question) {
        delete shopContext.height;
        delete shopContext.weight;
        delete shopContext.chest;
        delete shopContext.waist;
        delete shopContext.hip;
        delete shopContext.fit;
      }
      context = shopContext;
      if (reply.question) {
        if (!question) {
          question = reply;
          questionContext = shopContext;
        }
        continue;
      }
      replies.push(reply);
    }
    if (question) replies.push(question);
    const cards = replies.flatMap((reply) => reply.cards ?? []).slice(0, 10);
    const nextContext = questionContext ?? context;
    if (nextContext.intent !== "orders") {
      const productIds = cards.flatMap((card) => card.kind === "product" ? [card.id]
        : card.kind === "outfit" ? card.products.map((product) => product.id) : []);
      if (productIds.length) nextContext.resultProductIds = [...new Set(productIds)].slice(0, 10);
    }
    res.json({ status: "success", data: {
      text: replies.map((reply) => reply.text).join("\n\n"),
      cards,
      links: [...new Map(replies.flatMap((reply) => reply.links ?? []).map((link) => [link.href, link])).values()].slice(0, 8),
      suggestions: [...new Set(replies.flatMap((reply) => reply.suggestions ?? []))].slice(0, 4),
      context: nextContext, aiStatus,
    } });
  } catch (error) {
    if (controller.signal.aborted) return;
    if (error instanceof AppError) return next(error);
    // Keep exception strings (including driver/provider diagnostics) out of the response.
    return next(new AppError("Trợ lý đang bận. Bạn có thể thử lại hoặc dùng các trang của cửa hàng.", 503));
  } finally {
    res.off("close", disconnect);
  }
}

router.post("/", limit, json({ limit: "8kb" }), (req, res, next) => {
  res.set("Cache-Control", "no-store");
  // Public catalog queries work as a guest. A supplied token must pass the shop's normal session checks.
  if (req.headers.authorization) return protect(req, res, next);
  return next();
}, handleChatMessage);

const invalidBody: ErrorRequestHandler = (error, _req, _res, next) => {
  if (error?.type === "entity.too.large") return next(new AppError("Nội dung gửi vượt giới hạn của trợ lý.", 413));
  return next(error);
};
router.use(invalidBody);

export default router;
