import { AppError } from "../middlewares/AppError.js";

export const intents = ["greeting", "thanks", "search", "compare", "size", "outfit", "cart", "coupon", "payment", "shipping", "orders", "returns", "care", "buy", "help"] as const;
export type Intent = typeof intents[number];
export type Criteria = { query?: string; color?: string; size?: string; maxPrice?: number; exclusive?: true; occasion?: string };
export type Context = {
  intent?: Intent | undefined; filters?: Criteria | undefined; productId?: string | undefined; orderId?: string | undefined;
  height?: number | undefined; weight?: number | undefined; chest?: number | undefined; waist?: number | undefined; hip?: number | undefined;
  fit?: "Regular" | "Slim" | "Oversize" | undefined; coupon?: string | undefined; province?: string | undefined; express?: true | undefined;
  amount?: number | undefined;
  resultProductIds?: string[] | undefined;
  purchasePending?: true | undefined;
};
export type ChatTurn = Context & {
  compare?: string[] | undefined; resetPrice?: true | undefined; ordinal?: number | undefined;
  addToCart?: true | undefined; quantity?: number | undefined; orderAction?: "cancel" | "return" | "refund" | "payment" | undefined;
};
export const objectId = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
export const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d").trim().replace(/\s+/g, " ");

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function short(value: unknown, length: number) {
  return typeof value === "string" && value.trim().length <= length ? value.trim() || undefined : undefined;
}

const amountInRange = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000;

export function readContext(value: unknown): Context {
  const raw = record(value);
  const filters = record(raw.filters);
  const result: Context = {};
  if (intents.some((intent) => intent === raw.intent)) result.intent = raw.intent as Intent;
  const criteria: Criteria = {};
  for (const field of ["query", "color", "size", "occasion"] as const) {
    const value = short(filters[field], field === "query" ? 90 : 32);
    if (value) criteria[field] = fold(value);
  }
  if (amountInRange(filters.maxPrice)) criteria.maxPrice = filters.maxPrice;
  if (filters.exclusive === true && criteria.maxPrice !== undefined) criteria.exclusive = true;
  if (Object.keys(criteria).length) result.filters = criteria;
  for (const field of ["productId", "orderId"] as const) if (objectId(raw[field])) result[field] = raw[field].toLowerCase();
  if (Array.isArray(raw.resultProductIds)) result.resultProductIds = [...new Set(raw.resultProductIds.slice(0, 10).filter(objectId).map((id) => id.toLowerCase()))];
  if (raw.intent === "cart" && raw.purchasePending === true) result.purchasePending = true;
  for (const field of ["height", "weight", "chest", "waist", "hip"] as const) {
    const value = raw[field];
    if (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 999) result[field] = value;
  }
  if (["Regular", "Slim", "Oversize"].includes(String(raw.fit))) result.fit = raw.fit as NonNullable<Context["fit"]>;
  if (raw.express === true) result.express = true;
  if (amountInRange(raw.amount)) result.amount = raw.amount;
  if (typeof raw.coupon === "string" && /^[a-z\d_-]{1,40}$/i.test(raw.coupon)) result.coupon = raw.coupon.toUpperCase();
  const province = short(raw.province, 45);
  if (province) result.province = fold(province);
  return result;
}

export function readChatRequest(value: unknown) {
  const raw = record(value);
  const message = short(raw.message, 500);
  if (!message || (typeof raw.message === "string" && raw.message.length > 500)) {
    throw new AppError("Tin nhắn cần có từ 1 đến 500 ký tự.", 400);
  }
  if (raw.productId !== undefined && !objectId(raw.productId)) throw new AppError("ID sản phẩm không hợp lệ.", 400);
  if (raw.orderId !== undefined && !objectId(raw.orderId)) throw new AppError("ID đơn hàng không hợp lệ.", 400);
  return { message, context: readContext(raw.context), pageProductId: typeof raw.productId === "string" ? raw.productId.toLowerCase() : undefined,
    pageOrderId: typeof raw.orderId === "string" ? raw.orderId.toLowerCase() : undefined, pageColor: short(raw.color, 32) };
}

const colorPattern = /\b(xanh duong|xanh la|xanh navy|xanh den|xanh reu|xanh ngoc|do do|do ruou|trang kem|hong phan|den|trang|do|xam|ghi|beige|kem|be|nau|vang|cam|tim|hong|navy|xanh|black|white|grey|gray|blue|green|red|pink)\b/g;
const colors: Record<string, string> = { black: "den", white: "trang", grey: "xam", gray: "xam", ghi: "xam", blue: "xanh duong", green: "xanh la", red: "do", pink: "hong", beige: "be", "xanh navy": "navy", "xanh den": "navy" };
export const colorKey = (color: string) => colors[fold(color)] ?? fold(color);
const colorNames: Record<string, string> = { den: "đen", trang: "trắng", do: "đỏ", xam: "xám", nau: "nâu",
  vang: "vàng", tim: "tím", hong: "hồng", be: "be", "xanh duong": "xanh dương", "xanh la": "xanh lá",
  "xanh reu": "xanh rêu", "xanh ngoc": "xanh ngọc", "trang kem": "trắng kem", "do do": "đỏ đô", "hong phan": "hồng phấn" };
export const colorLabel = (color: string) => colorNames[colorKey(color)] ?? color;
const itemPattern = /\b(ao|quan|dam|chan vay|vay|giay|tui|that lung|phu kien|hoodie|blazer|jacket|sweater|jean[s]?|polo|so mi|cardigan|sneaker[s]?)\b/;
const itemTypes: Record<string, string> = { jeans: "jean", sneakers: "sneaker", tshirt: "thun" };
export const catalogText = (value: string) => fold(value).replace(/[-_/]+/g, " ").replace(/\bt\s*shirt\b/g, "thun").replace(/\b(jeans|sneakers)\b/g, (word) => itemTypes[word] ?? word);

const moneyPattern = /(\d+(?:[.,]\d+)?)\s*(trieu|nghin|ngan|vnd|dong|tr|k|d)\b/;
function currency(match: RegExpMatchArray | null) {
  if (!match?.[1]) return undefined;
  const digits = match[1];
  const unit = match[2];
  const base = /^\d{1,3}(?:[.,]\d{3})+$/.test(digits) ? Number(digits.replace(/[.,]/g, "")) : Number(digits.replace(",", "."));
  const scale = unit === "trieu" || unit === "tr" ? 1_000_000 : ["k", "nghin", "ngan"].includes(unit ?? "") ? 1000 : 1;
  return amountInRange(base * scale) ? base * scale : undefined;
}

function decimal(text: string | undefined) { return text ? Number(text.replace(",", ".")) : undefined; }

export function parseTurn(message: string, previous: Context, pageProductId?: string, pageColor?: string, pageOrderId?: string): ChatTurn {
  const text = catalogText(message);
  const meters = text.match(/\b([12])\s*m\s*(\d{1,2})?\b/);
  const decimalMeters = decimal(text.match(/\b([12][.,]\d{1,2})\s*m\b/)?.[1]);
  const height = meters?.[1]
    ? Number(meters[1]) * 100 + Number(meters[2]?.padEnd(2, "0") ?? 0)
    : decimalMeters !== undefined ? Math.round(decimalMeters * 100)
      : decimal(text.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*cm\b/)?.[1] ?? text.match(/\bcao\s+(\d{2,3}(?:[.,]\d+)?)/)?.[1]);
  const weight = decimal(text.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*kg\b/)?.[1] ?? text.match(/\bnang\s+(\d{1,3}(?:[.,]\d+)?)/)?.[1]);
  const chest = decimal(text.match(/\b(?:vong )?nguc\s*(\d{2,3}(?:[.,]\d+)?)/)?.[1]);
  const waist = decimal(text.match(/\b(?:vong )?eo\s*(\d{2,3}(?:[.,]\d+)?)/)?.[1]);
  const hip = decimal(text.match(/\b(?:vong )?hong\s*(\d{2,3}(?:[.,]\d+)?)/)?.[1]);
  const fit = /\b(slim|om body|dang om)\b/.test(text) ? "Slim" : /\b(oversize|relaxed)\b/.test(text) ? "Oversize" : /\bregular\b/.test(text) ? "Regular" : undefined;
  const coupon = message.match(/(?:coupon|voucher|mã\s*giảm\s*giá|ma\s*giam\s*gia|mã|ma)\s*[:#]?\s*([a-z\d_-]{2,40})/i)?.[1];
  const standaloneCoupon = /^\s*[a-z\d_-]{2,40}\s*$/i.test(message) ? message.trim() : undefined;
  const priceRange = text.match(/\b(?:duoi|toi da|toi|khong qua|ngan sach|tam|khoang)\s*(\d+(?:[.,]\d+)?)\s*(trieu|nghin|ngan|vnd|dong|tr|k|d)?\b/);
  const amount = currency(priceRange ?? text.match(moneyPattern) ?? text.match(/\b(?:tong(?: tien)?(?: don)?|don)\s+(\d{4,9})\b/) ??
    (previous.intent === "coupon" && previous.coupon ? text.match(/^(\d{4,9})$/) : null));
  const size = text.match(/\b(?:size|co)\s*(xxs|xs|s|m|l|xl|xxl|[2-8]xl|\d{2,3}|freesize)\b/i)?.[1]?.toUpperCase();
  const refersToShown = /(?:^|\s)(?:quần|áo|mẫu|món|sản phẩm) đó(?=\s|$|[.,!?])/i.test(message);
  const colorInput = (refersToShown ? catalogText(message.replace(/((?:quần|áo|mẫu|món|sản phẩm)\s+)đó/gi, "$1")) : text)
    .replace(/\btim(?=\s+(?:giup\s+)?(?:ao|quan|dam|vay|giay|mau|mon|san pham|do)\b)/g, " ")
    .replace(/\b(do hoc|do di |phoi do|bo do|mua do|tra hang|doi do|co san|do co|hong\s*\d+)\b/g, " ");
  const colorText = [...colorInput.matchAll(colorPattern)]
    .find((match) => match[0] !== "do" || /\b(?:mau do|ao do|quan do|vay do|dam do)\b/.test(text))?.[0];
  const color = colorText ? colorKey(colorText) : undefined;
  const occasion = text.match(/\b(di hoc|di choi|di lam|du tiec|du lich|cong so|the thao)\b/)?.[1];
  const orderId = message.match(/\b[a-f\d]{24}\b/i)?.[0] ?? message.match(/(?:^|[#\s])([a-f\d]{8})(?![a-z\d])/i)?.[1];
  const productReference = message.match(/\/product\/([a-f\d]{24})(?![a-f\d])/i)?.[1]?.toLowerCase();
  const ordinalText = text.match(/\b(?:mau|mon|san pham|ao|quan)(?:\s+so)?\s+thu\s+(nhat|hai|ba|tu|bon|nam|\d{1,2})\b|\b(?:mau|mon|san pham)\s+so\s+(\d{1,2})\b/);
  const ordinalNames: Record<string, number> = { nhat: 1, hai: 2, ba: 3, tu: 4, bon: 4, nam: 5 };
  const ordinalValue = ordinalText?.[1] ?? ordinalText?.[2];
  const ordinal = ordinalValue ? (ordinalNames[ordinalValue] ?? Number(ordinalValue)) : undefined;
  const selectedResult = ordinal !== undefined ? previous.resultProductIds?.[ordinal - 1] : undefined;
  const explicitlyViewed = /\b(ao|quan|dam|vay|mau|mon|san pham|mau ao|mau quan) nay\b/.test(text);
  const orderAction = /\bhuy\b/.test(text) ? "cancel" : /\bhoan tien\b/.test(text) ? "refund"
    : /\b(doi tra|doi hang|doi size|tra hang|doi mau)\b/.test(text) ? "return"
      : /\b(thanh toan chua|da thanh toan|thanh toan roi|da chuyen khoan|chuyen khoan roi)\b/.test(text) ? "payment" : undefined;
  const resetPrice = /\b(?:bo|xoa|khong can|khong)\s+(?:gioi han|loc|rang buoc)(?:\s+(?:ve|theo))?\s+(?:gia|ngan sach)\b/.test(text);
  const addToCart = /\b(?:them|cho|bo|dua|mua)\b.{0,100}\b(?:vao|trong)\s+gio\b/.test(text);
  const quantityText = text.match(/\bso luong\s*(?:la\s+)?(\d{1,5})\b|\b(\d{1,5})\s+(?:cai|chiec|mon|san pham)\b/)?.slice(1).find(Boolean)
    ?? (previous.purchasePending && /^\d{1,5}$/.test(text) ? text : undefined);
  const signsOfSize = height !== undefined || weight !== undefined || chest !== undefined || waist !== undefined || hip !== undefined;
  let intent: Intent | undefined;
  const shortMessage = text.replace(/[.,?!~]+/g, " ").trim().replace(/\s+/g, " ");
  if (/^(?:(?:xin )?chao|hello|hi|hey)(?: (?:ban|shop|tro ly|ad|mn|ca nha|nhe|a|em|anh|chi))*$/.test(shortMessage)) intent = "greeting";
  else if (/^(?:(?:xin )?cam on|thank(?:s| you))(?: (?:ban|shop|tro ly|nhieu|nhe|a|em))*$/.test(shortMessage)) intent = "thanks";
  else if (/\b(so sanh|khac nhau)\b/.test(text)) intent = "compare";
  else if (/\b(phoi do|phoi voi|phoi cung|mix\s*(?:&|and)?\s*match|mac voi|bo phoi)\b/.test(text)) intent = "outfit";
  else if (addToCart) intent = "cart";
  else if (orderAction === "return" && (orderId || previous.intent === "orders" || /\b(don|da mua)\b/.test(text))) intent = "orders";
  else if (signsOfSize || /\b(tu van (?:size|co)|nen mac size|size gi|size nao|mac co nao|bang size|bang kich co|smart size|chon size)\b/.test(text)) intent = "size";
  else if (/\b(tra don|don hang cua|don cua|tinh trang don|kiem tra don|theo doi don|van don|huy don|hoan tien|thanh toan chua|da thanh toan|thanh toan roi|da chuyen khoan|chuyen khoan roi)\b/.test(text) || (orderId && !productReference && (objectId(text) || /#|\bdon\b/.test(text) || previous.intent === "orders")) || (/\bdon\b/.test(text) && /\b(huy|toi dau|dang giao|da giao)\b/.test(text))) intent = "orders";
  else if (/\b(doi tra|doi hang|doi size|tra hang|doi mau)\b/.test(text) && (!previous.filters || !color || /\b(don|hang da mua|tra hang|doi tra|doi hang)\b/.test(text))) intent = "returns";
  else if (/\b(coupon|voucher|ma giam|khuyen mai|uu dai)\b/.test(text)) intent = "coupon";
  else if (/\b(phi (?:ship|giao hang|van chuyen)|giao (?:hang|toi|den|hoa toc|nhanh)|ship|bao lau (?:nhan|giao)|mien phi van chuyen)\b/.test(text)) intent = "shipping";
  else if (/\b(thanh toan|cod|momo|vnpay|sepay|chuyen khoan)\b/.test(text)) intent = "payment";
  else if (/\b(gio hang|them vao gio|cho vao gio)\b/.test(text)) intent = "cart";
  else if (/\b(bao quan|giat|ui|la quan ao|chat lieu)\b/.test(text) && !/\b(tim|loc)\b/.test(text)) intent = "care";
  else if (/\b(cach mua|cach dat|mua hang the nao|dat hang the nao)\b/.test(text)) intent = "buy";
  else if (/\b(lien he|hotline|ho tro|gap nhan vien)\b/.test(text)) intent = "help";
  else if (previous.intent === "coupon" && (standaloneCoupon || amount !== undefined)) intent = "coupon";
  else if (previous.intent === "shipping" && !itemPattern.test(text) && text.length <= 55) intent = "shipping";
  else if (previous.intent === "size" && !size && (fit || /\b(?:ao|quan|dam|vay|mau)\b/.test(text) || productReference)) intent = "size";
  else if (resetPrice) intent = "search";
  else if (previous.intent === "compare" && (itemPattern.test(text) || /[,]/.test(message)) && ordinal === undefined) intent = "compare";
  else if (previous.purchasePending && (color || size || ordinal !== undefined || quantityText)) intent = "cart";
  else if (resetPrice || ordinal !== undefined || color || size || amount !== undefined || occasion || productReference || itemPattern.test(text) || /\b(tim|loc|san pham|co mau)\b/.test(text)) intent = "search";

  const filters: Criteria = {};
  const itemIndex = text.search(itemPattern);
  if (itemIndex >= 0 && ordinal === undefined && !explicitlyViewed && !refersToShown) {
    const query = text.slice(itemIndex).split(/\s+(?:va|size|co (?:[sml]|xl|\d)|mau|duoi|toi da|khong qua|ngan sach|tam|khoang|tong|con hang|cho|de|co khong|khong|phoi|mac)\b/)[0] ?? "";
    const cleaned = query.replace(colorPattern, (word) => word === "do" && /^do (?:hoc|di)/.test(query) ? word : " ")
      .replace(/\b(di hoc|di choi|di lam|du tiec|du lich|giup minh|giup toi|voi a|voi|nhe|co san)\b/g, " ").trim();
    if (cleaned) filters.query = fold(cleaned).slice(0, 90);
  } else if (intent === "search" && !color && !size && amount === undefined) {
    const query = text.match(/\b(?:tim kiem|tim|loc)\s+(.+)/)?.[1]
      ?.replace(/^(?:giup\s+(?:minh|toi)\s+|san pham\s+|mau\s+)/, "")
      .replace(/[?!.]+$/, "").trim();
    if (query && !["san pham", "mau", "do"].includes(query)) filters.query = query.slice(0, 90);
  }
  if (color) filters.color = color;
  if (size) filters.size = size;
  if (amount !== undefined) filters.maxPrice = amount;
  if (priceRange?.[0].startsWith("duoi")) filters.exclusive = true;
  if (occasion) filters.occasion = occasion;
  const isContinuation = !filters.query && Boolean(previous.filters) && ordinal === undefined && !addToCart &&
    (["search", "outfit", "size"].some((name) => name === previous.intent) || Boolean(color || size || previous.purchasePending || resetPrice));
  const merged = isContinuation ? { ...previous.filters, ...filters } : filters;
  if (amount !== undefined && !filters.exclusive) delete merged.exclusive;
  if (resetPrice) {
    delete merged.maxPrice;
    delete merged.exclusive;
  }
  const compareText = message.replace(/^.*?(?:so sánh|so sanh)\s*/i, "").replace(/^(?:giúp mình|giup minh|giúp tôi|giup toi)\s+/i, "");
  const compare = compareText.split(/\s+(?:và|va|với|voi)\s+|[,;]/i).map((name) => catalogText(name).slice(0, 90)).filter(Boolean).slice(0, 3);
  const currentProduct = ordinal !== undefined ? selectedResult : productReference ?? (explicitlyViewed ? pageProductId : undefined);
  const sizeProduct = currentProduct ?? (ordinal !== undefined || filters.query ? undefined : pageProductId ?? (previous.intent === "size" ? previous.productId : undefined));
  if (intent === "size" && sizeProduct === pageProductId && pageColor && !filters.color) merged.color = colorKey(pageColor);
  return {
    intent, filters: intent !== "orders" && Object.keys(merged).length ? merged : undefined,
    productId: intent === "size" ? sizeProduct : intent === "cart" ? currentProduct ?? (ordinal === undefined && previous.purchasePending ? previous.productId : undefined)
      : intent === "care" && !filters.query ? currentProduct ?? pageProductId : currentProduct,
    orderId: orderId ?? (!/\b(?:tra don cua|don hang cua|don khac|danh sach don)\b/.test(text)
      ? pageOrderId ?? (previous.intent === "orders" ? previous.orderId : undefined) : undefined),
    height: height ?? (intent === "size" && previous.intent === "size" ? previous.height : undefined),
    weight: weight ?? (intent === "size" && previous.intent === "size" ? previous.weight : undefined),
    chest: chest ?? (intent === "size" && previous.intent === "size" ? previous.chest : undefined),
    waist: waist ?? (intent === "size" && previous.intent === "size" ? previous.waist : undefined),
    hip: hip ?? (intent === "size" && previous.intent === "size" ? previous.hip : undefined),
    fit: fit ?? (intent === "size" && previous.intent === "size" ? previous.fit : undefined),
    coupon: intent === "coupon" ? (coupon && !["co", "còn", "cho", "nao"].includes(fold(coupon)) ? coupon.toUpperCase() : undefined) ??
      (amount === undefined ? standaloneCoupon?.toUpperCase() : undefined) ?? previous.coupon : undefined,
    province: intent === "shipping" ? `${text} ${previous.intent === "shipping" ? previous.province ?? "" : ""}` : undefined,
    compare: intent === "compare" && compare.length >= 2 ? compare : undefined,
    resetPrice: resetPrice ? true : undefined, ordinal, orderAction,
    addToCart: addToCart || (intent === "cart" && previous.purchasePending) ? true : undefined,
    quantity: quantityText && Number(quantityText) > 0 ? Number(quantityText) : undefined,
    amount: amount ?? (intent === previous.intent && (intent === "coupon" || intent === "shipping") ? previous.amount : undefined),
    express: /\b(hoa toc|sieu toc|giao nhanh|express)\b/.test(text) || (intent === "shipping" && previous.intent === "shipping" && previous.express && !/\btieu chuan\b/.test(text)) ? true : undefined,
  };
}

export function splitQuestions(message: string) {
  const parts = message.split(/\s*(?:[;!?\n]+|\s+(?:và|va)\s+(?=(?:phí|phi|cách|cach|đơn|don|tư vấn|tu van|thanh toán|thanh toan|giao hàng|giao hang|shop|tìm|tim)(?:\s|$))|,\s+(?=(?:phí|phi|tra đơn|tra don|thanh toán|thanh toan|giao hàng|giao hang|tư vấn|tu van)(?:\s|$)))\s*/iu)
    .map((part) => part.trim()).filter(Boolean);
  return parts.length <= 3 ? parts : [...parts.slice(0, 2), parts.slice(2).join(" ")];
}
