import { AppError } from "../middlewares/AppError.js";
import type { BodyField } from "../models/sizeRecommendationModel.js";
import { chartMeasurements } from "./sizeGuide.js";
import { recommendCatalogSize, sizeScope } from "./catalogSize.js";
import { catalogMatch, findCategories, loadCatalog, meetsFilters, namedProducts, productCard, type ProductCard } from "./chatCatalog.js";
import { suggestOutfits, type OutfitCard } from "./chatOutfits.js";
import { catalogText, colorLabel, type ChatTurn, type Context, type Criteria } from "./chatIntent.js";

export const vnd = (value: number) => `${value.toLocaleString("vi-VN")} ₫`;
export type Link = { label: string; href: string };
export type Reply<Card = ProductCard | OutfitCard> = {
  text: string; cards?: Card[]; links?: Link[]; question?: true; suggestions?: string[];
};

export async function searchProducts(filters: Criteria = {}, productId?: string): Promise<Reply> {
  const { query, color, size, maxPrice, occasion } = filters;
  if (!query && !color && !size && maxPrice === undefined && !occasion && !productId) {
    return { text: "Bạn muốn tìm món nào? Bạn có thể nhập tên, màu, size hoặc ngân sách.", question: true,
      links: [{ label: "Xem danh mục", href: "/products" }] };
  }
  const items = await loadCatalog(productId ? { ids: [productId] } : query ? { queries: [query] } : {});
  const exact: ProductCard[] = [];
  const soldOut: ProductCard[] = [];
  const alternatives: ProductCard[] = [];
  const relevance = (item: (typeof items)[number]) =>
    Number(Boolean(query && catalogMatch(query, item.name))) * 2 +
    Number(Boolean(occasion && catalogMatch(occasion, `${item.name} ${item.description}`)));
  for (const item of items.sort((a, b) => relevance(b) - relevance(a))) {
    const matched = item.variants.filter((choice) => meetsFilters(choice, filters));
    if (matched.some((choice) => choice.available)) exact.push(productCard(item, matched));
    else if (matched.length) soldOut.push(productCard(item, matched));
    if (color && !matched.some((choice) => choice.available)) {
      const choices = item.variants.filter((choice) => choice.available && meetsFilters(choice, filters, false));
      if (choices.length) alternatives.push(productCard(item, choices, "Màu khác · cùng điều kiện size và giá đã chọn"));
    }
  }
  const occasionNote = occasion ? " Đây là gợi ý theo thông tin đang có trong danh mục." : "";
  if (exact.length) {
    const cards = soldOut.length ? [...exact.slice(0, 4), ...soldOut.slice(0, 1)] : exact.slice(0, 5);
    return {
      text: `Mình tìm được ${cards.length - Number(Boolean(soldOut.length))} mẫu còn hàng phù hợp.${soldOut.length ? " Một số mẫu có đúng biến thể yêu cầu đã hết hàng." : ""}${occasionNote}`,
      cards,
      suggestions: ["So sánh sản phẩm", "Tư vấn size"],
    };
  }
  const requirements = [color ? `màu ${colorLabel(color)}` : "", size ? `size ${size.toUpperCase()}` : "",
    maxPrice !== undefined ? `${filters.exclusive ? "dưới" : "tối đa"} ${vnd(maxPrice)}` : ""].filter(Boolean).join(", ");
  const description = requirements ? ` (${requirements})` : "";
  return {
    text: `${soldOut.length ? `Biến thể bạn chọn${description} hiện hết hàng.` : `Mình chưa tìm thấy mẫu phù hợp${description}.`}${alternatives.length ? " Các gợi ý bên dưới có màu khác, giữ size và mức giá bạn chọn." : ""}`,
    cards: [...soldOut.slice(0, alternatives.length ? 2 : 5), ...alternatives.slice(0, 3)],
    ...(!alternatives.length && maxPrice !== undefined ? { suggestions: ["Bỏ giới hạn giá"] } : {}),
    links: [{ label: "Xem danh mục", href: "/products" }],
  };
}

export async function preparePurchase(turn: ChatTurn, previous: Context): Promise<Reply & { productId?: string }> {
  const query = turn.filters?.query;
  const specific = turn.productId;
  const ids = specific ? [specific] : previous.resultProductIds;
  let items = ids?.length ? await loadCatalog({ ids }) : query ? await loadCatalog({ queries: [query] }) : [];
  if (ids?.length && !specific && query) {
    const named = namedProducts(items, query);
    if (named.length) items = named;
    else items = await loadCatalog({ queries: [query] });
  } else if (!ids?.length && query) {
    const named = namedProducts(items, query);
    if (named.length) items = named;
  }
  if (!items.length) return { text: "Bạn muốn thêm mẫu nào? Hãy gửi tên, liên kết sản phẩm hoặc chọn một mẫu đang hiển thị.", question: true,
    links: [{ label: "Xem sản phẩm", href: "/products" }] };
  const chosen = items.length === 1 ? items[0] : undefined;
  const cards = items.slice(0, 5).map((item) => {
    const choices = item.variants.filter((choice) => meetsFilters(choice, {
      ...(turn.filters?.color ? { color: turn.filters.color } : {}), ...(turn.filters?.size ? { size: turn.filters.size } : {}),
    }));
    return { ...productCard(item, choices), purchase: turn.quantity ? { quantity: turn.quantity } : {} };
  });
  if (chosen && !cards[0]?.variants.some((choice) => choice.available)) return {
    text: "Mẫu này hiện chưa có biến thể còn hàng theo lựa chọn của bạn. Bạn có thể chọn màu hoặc size khác nếu phù hợp.", question: true,
    cards, productId: chosen.id,
  };
  return {
    text: chosen ? `Bạn kiểm tra size, màu và số lượng của ${chosen.name}, sau đó bấm “Thêm vào giỏ” để xác nhận.`
      : "Bạn muốn thêm mẫu nào? Chọn sản phẩm, biến thể và số lượng trên thẻ rồi bấm “Thêm vào giỏ”.",
    cards, question: true, ...(chosen ? { productId: chosen.id } : {}),
  };
}

export async function compareProducts(turn: ChatTurn): Promise<Reply> {
  const names = turn.compare;
  if (!names || new Set(names).size < 2) return { text: "Bạn muốn so sánh 2–3 sản phẩm nào? Hãy nhập tên hoặc dán liên kết, cách nhau bằng dấu phẩy.", question: true };
  const references = names.map((name) => name.match(/\b[a-f\d]{24}\b/i)?.[0]);
  const [byId, byName] = await Promise.all([
    loadCatalog({ ids: references.filter((id): id is string => Boolean(id)) }),
    names.some((_, index) => !references[index]) ? loadCatalog({ queries: names.filter((_, index) => !references[index]) }) : [],
  ]);
  const candidates = names.map((name, index) => references[index]
    ? byId.filter((item) => item.id === references[index])
    : namedProducts(byName, name));
  const ambiguous = candidates.findIndex((matches) => matches.length !== 1);
  if (ambiguous >= 0) {
    return { text: `Bạn gửi tên đầy đủ hoặc link của “${names[ambiguous]}” được không?`,
      question: true, cards: candidates[ambiguous]?.slice(0, 5).map((item) => productCard(item, item.variants)) ?? [] };
  }
  const products = [...new Map(candidates.flat().map((item) => [item.id, item])).values()];
  if (products.length < 2) return { text: "Hai tên này dẫn tới cùng một sản phẩm. Bạn muốn so với mẫu nào khác?", question: true };
  const charts = await Promise.all(products.map((item) => sizeScope({ productId: item.id })));
  return {
    text: `Mình đối chiếu giá, size, màu, tồn kho và chất liệu đã công bố. ${products.map((item) =>
      `${item.name}: ${item.material?.trim() || "chưa có thông tin chất liệu"}.`).join(" ")} Xem bảng size trên từng trang để đối chiếu số đo.`,
    cards: products.map((item, index) => productCard(item, item.variants, charts[index]?.rows.some((row) => row.garment)
      ? "Có số đo trang phục trong bảng size" : "Chưa có thông tin số đo trang phục")),
  };
}

const measurements: Record<BodyField, string> = { height: "chiều cao", weight: "cân nặng", chest: "vòng ngực", waist: "vòng eo", hip: "vòng hông" };
const guide = (productId?: string, categoryId?: string) => ({ label: "Xem bảng size", href: productId
  ? `/tu-van-size?productId=${productId}` : categoryId ? `/tu-van-size?categoryId=${categoryId}` : "/tu-van-size" });

export async function adviseSize(turn: ChatTurn): Promise<Reply> {
  let productId = turn.productId;
  let categoryId: string | undefined;
  const query = turn.filters?.query;
  if (!productId && query) {
    const [products, categories] = await Promise.all([loadCatalog({ queries: [query] }), findCategories(query)]);
    const named = namedProducts(products, query);
    const exactCategory = categories.find((category) => catalogText(category.name) === catalogText(query));
    if (exactCategory) categoryId = String(exactCategory._id);
    else if (named.length === 1) productId = named[0]?.id;
    else if (categories.length === 1) categoryId = String(categories[0]?._id);
    else if (named.length > 1) return {
      text: "Bạn đang xem mẫu nào trong các sản phẩm này? Bạn có thể mở sản phẩm hoặc gửi tên đầy đủ.",
      cards: named.slice(0, 5).map((item) => productCard(item, item.variants)), question: true,
    };
  }
  if (!productId && !categoryId) {
    return { text: "Bạn muốn tư vấn size cho sản phẩm hoặc danh mục nào? Bạn có thể mở trang sản phẩm hoặc gửi tên.", question: true, links: [guide()] };
  }
  if (productId && !(await loadCatalog({ ids: [productId] })).length) {
    return { text: "Mình chưa tìm được sản phẩm đang bán để tra size. Bạn muốn tra cho mẫu nào khác?", question: true, links: [guide()] };
  }
  const scope = productId ? { productId } : { categoryId };
  const links = [guide(productId, categoryId), { label: "Liên hệ hỗ trợ", href: "/contact" }];
  const { rows } = await sizeScope(scope);
  if (!rows.length) return { text: "Shop chưa có bảng size cho mẫu hoặc danh mục này. Bạn có thể xem trang tư vấn size hoặc liên hệ shop.", links };
  const fit = turn.fit ?? "Regular";
  const fields = chartMeasurements(rows, fit);
  if (!fields.length) return { text: "Bảng hiện chưa có quy tắc đối chiếu số đo cho phom này. Bạn có thể xem số đo trang phục trong bảng size.", links };
  const missing = fields.filter(({ key, required }) => required && turn[key] === undefined).map(({ key }) => measurements[key]);
  if (missing.length) return { text: `Bạn cho mình ${missing.join(" và ")} để tra bảng size nhé?`, question: true, links };
  const values = Object.fromEntries(fields.flatMap(({ key }) => turn[key] === undefined ? [] : [[key, turn[key]]]));
  if (!Object.keys(values).length) return { text: `Bạn cho mình ${fields.map(({ key }) => measurements[key]).join(" hoặc ")} nhé?`, question: true, links };
  try {
    const { sizes, recommendation } = await recommendCatalogSize({ ...scope, fit, ...values });
    const size = sizes[0];
    if (!size) return { text: "Số đo bạn nhập chưa khớp với quy tắc độ vừa trong bảng. Bạn có thể đối chiếu số đo trang phục hoặc hỏi shop.", links };
    const cards = await loadCatalog({ ids: [...new Set([...(productId ? [productId] : []), ...recommendation.productIds])] });
    const exact = cards.find((item) => item.id === productId);
    const matchingSize = (item: (typeof cards)[number], checkColor = true) =>
      item.variants.filter((choice) => meetsFilters(choice, { ...(turn.filters?.color ? { color: turn.filters.color } : {}), size }, checkColor));
    const exactChoices = exact ? matchingSize(exact) : [];
    const available = exactChoices.some((choice) => choice.available);
    const source = recommendation.source === "product" ? "bảng size của sản phẩm" : "bảng size của danh mục";
    const otherItems = cards.filter((item) => item.id !== productId);
    const sameColor = otherItems.filter((item) => matchingSize(item).some((choice) => choice.available));
    const alternatives = (sameColor.length ? sameColor : otherItems.filter((item) =>
      matchingSize(item, false).some((choice) => choice.available))).slice(0, 4);
    const changedColor = Boolean(turn.filters?.color && !sameColor.length && alternatives.length);
    const color = turn.filters?.color ? `Màu ${colorLabel(turn.filters.color)} size ${size}` : `Size ${size}`;
    const stock = exact
      ? available ? ` ${color} hiện còn hàng.` : exactChoices.length ? ` ${color} hiện hết hàng.` : ` ${color} hiện chưa có biến thể đang bán cho mẫu này.`
      : alternatives.length ? " Bên dưới là các mẫu đang còn size phù hợp." : " Mình chưa thấy mẫu cùng điều kiện còn hàng.";
    return {
      text: `Mình gợi ý size ${size}${recommendation.name ? ` cho ${recommendation.name}` : ""} theo ${source}.${stock}${exact && !available && alternatives.length ? " Các mẫu bên dưới còn đúng size được tư vấn." : ""}`,
      cards: [...(exact && exactChoices.length ? [productCard(exact, exactChoices)] : []),
        ...(!available ? alternatives.map((item) => productCard(item, matchingSize(item, !changedColor).filter((choice) => choice.available),
          changedColor ? "Màu khác · giữ nguyên size được tư vấn" : undefined)) : [])],
      links,
    };
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 400) return { text: error.message, question: true, links };
    throw error;
  }
}

export async function makeOutfit(turn: ChatTurn): Promise<Reply> {
  const filters = turn.filters ?? {};
  const productId = filters.query ? undefined : turn.productId;
  const { cards, omitted, unavailable } = await suggestOutfits(filters, productId);
  const links = [{ label: "Khám phá Mix & Match", href: "/mix-match" }];
  if (unavailable) return { text: "Mẫu đang xem hiện không thể dùng để phối đồ.", links };
  const excluded = omitted.length ? ` Mình bỏ qua ${omitted.slice(0, 2).join("; ")}.` : "";
  if (!cards.length) return {
    text: `Mình chưa tìm được bộ phối còn đủ món${filters.maxPrice !== undefined ? ` trong ngân sách ${vnd(filters.maxPrice)}` : ""}.${excluded} Bạn muốn phối với mẫu khác hay đổi ngân sách?`, question: true, links,
  };
  return { text: `Đây là gợi ý phối đồ${filters.occasion ? " theo dịp bạn chọn" : ""}. Tổng dự kiến tính theo biến thể trên từng thẻ và chưa gồm phí giao hàng.${excluded}`,
    cards: cards.map((card) => ({ ...card, ...(filters.maxPrice === undefined ? {} : { maxPrice: filters.maxPrice }), ...(filters.exclusive ? { exclusive: true } : {}) })), links };
}

export async function careAdvice(turn: ChatTurn): Promise<Reply> {
  const items = turn.filters?.query ? await loadCatalog({ queries: [turn.filters.query] })
    : turn.productId ? await loadCatalog({ ids: [turn.productId] }) : [];
  const selected = turn.filters?.query ? namedProducts(items, turn.filters.query) : items;
  const item = selected.length === 1 ? selected[0] : undefined;
  if (item) return {
    text: `${item.name}. Chất liệu: ${item.material?.trim().slice(0, 350) || "chưa có thông tin"}. Bảo quản: ${item.care_instructions?.trim().slice(0, 600) || "shop chưa có hướng dẫn riêng. Bạn hãy xem nhãn chăm sóc trên sản phẩm hoặc liên hệ shop"}.`,
    links: [{ label: "Xem sản phẩm", href: `/product/${item.id}` }, { label: "Liên hệ shop", href: "/contact" }],
  };
  return { text: "Bạn muốn hỏi cách bảo quản mẫu nào? Mỗi chất liệu có hướng dẫn giặt và là khác nhau.",
    question: true, links: [{ label: "Trợ giúp", href: "/help" }, { label: "Liên hệ shop", href: "/contact" }] };
}
