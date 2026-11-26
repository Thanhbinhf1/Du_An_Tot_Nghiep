import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import authRoutes from "../src/routes/authRoutes.js";
import adminRoutes from "../src/routes/adminRoutes.js";
import orderRoutes from "../src/routes/orderRoutes.js";
import paymentRoutes from "../src/routes/paymentRoutes.js";
import reviewRoutes from "../src/routes/productCommentRoutes.js";
import productRoutes from "../src/routes/productRoutes.js";
import { errorHandler, notFound } from "../src/middlewares/errorMiddleware.js";
import User from "../src/models/userModel.js";
import Category from "../src/models/categoryModel.js";
import Brand from "../src/models/brandModel.js";
import Product from "../src/models/productModel.js";
import ProductVariant from "../src/models/productVariantModel.js";
import Order from "../src/models/orderModel.js";
import OrderDetail from "../src/models/orderDetailModel.js";
import Payment from "../src/models/paymentModel.js";
import ReviewReport from "../src/models/reviewReportModel.js";
import Address from "../src/models/addressModel.js";
import Cart from "../src/models/cartModel.js";
import CartDetail from "../src/models/cartDetailModel.js";
import PasswordReset from "../src/models/passwordResetModel.js";
import PasswordResetLimit from "../src/models/passwordResetLimitModel.js";
import { EmailService } from "../src/services/emailService.js";
import { ContactController } from "../src/controllers/contactController.js";
import { OAuth2Client } from "google-auth-library";
import ProductImage from "../src/models/productImageModel.js";
import ProductComment from "../src/models/productCommentModel.js";
import OrderReturn from "../src/models/orderReturnModel.js";
import InventoryMovement from "../src/models/inventoryMovementModel.js";
import BlockedWord from "../src/models/blockedWordModel.js";

dotenv.config({ quiet: true });
const databaseName = `pv_test_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
const previousSecret = process.env.JWT_SECRET;
const password = randomUUID();
let connected = false;
let server: Server | undefined;
let base: string;
let token: string;
let customerToken: string;
let productId: string;
let otherProductId: string;
let variantId: string;
let secondVariantId: string;
const valid = { sku: " test-m-black ", size: " M ", color: " Đen ", price: 250000, sale_price: 220000, stock_quantity: 10 };
const momoAttempts: Array<{ orderId: string; requestId: string; amount: number }> = [];

before(async () => {
  const uri = process.env.DATABASE ?? process.env.DATABASE_URL;
  assert.ok(uri, "Cần cấu hình DATABASE hoặc DATABASE_URL trong backend/.env");
  // Luôn ghi đè database trong URI; không dùng database ứng dụng.
  try {
    await mongoose.connect(uri, { dbName: databaseName, serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false });
    connected = true;
  } catch (error) {
    // Không đưa URI/thông tin xác thực vào log của test.
    throw new Error(`Không kết nối được MongoDB (${error instanceof Error ? error.name : "unknown"})`);
  }
  assert.equal(mongoose.connection.name, databaseName);
  await Promise.all([User, Category, Brand, Product, ProductVariant, Payment, ReviewReport, PasswordReset, PasswordResetLimit, OrderReturn, InventoryMovement, BlockedWord].map((model) => model.createIndexes()));
  process.env.JWT_SECRET = randomUUID();
  await User.create({ name: "Integration Admin", email: "admin@variant-test.invalid", password: await bcrypt.hash(password, 10), role: "admin" });

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/products", productRoutes);
  app.post("/api/contact", ContactController.create);
  app.post("/mock-momo", (req, res) => {
    const { partnerCode, orderId, requestId, amount } = req.body;
    momoAttempts.push({ orderId, requestId, amount });
    if (momoAttempts.length === 1) {
      res.status(503).json({ resultCode: 10 });
      return;
    }
    res.json({ partnerCode, orderId, requestId, resultCode: 0, payUrl: "https://test-payment.momo.vn/fixture-checkout" });
  });
  app.use(notFound);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  if (!server.listening) await new Promise<void>((resolve) => server!.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

after(async () => {
  try {
    if (server) {
      await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    }
    if (connected) {
      // Chỉ dọn đúng database ngẫu nhiên do lần chạy này tạo ra.
      assert.match(databaseName, /^pv_test_[a-f0-9]{24}$/);
      assert.equal(mongoose.connection.name, databaseName);
      await mongoose.connection.dropDatabase();
      console.log("Đã dọn database kiểm thử riêng.");
    }
  } finally {
    await mongoose.disconnect();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

async function request(method: string, path: string, body?: unknown, authToken?: string) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  return { status: response.status, body: result };
}
const variantsPath = () => `/products/${productId}/variants`;

test("Product Variants: HTTP + xác thực + MongoDB thật", async (t) => {
  await t.test("đăng nhập admin thật và đăng ký khách hàng", async () => {
    const login = await request("POST", "/auth/login", { email: "admin@variant-test.invalid", password });
    assert.equal(login.status, 200);
    assert.equal(login.body.data.role, "admin");
    token = login.body.data.token;
    assert.equal(typeof token, "string");
    const register = await request("POST", "/auth/register", { name: "Integration Customer", email: "customer@variant-test.invalid", password });
    assert.equal(register.status, 201);
    customerToken = register.body.data.token;
  });

  await t.test("tạo sản phẩm qua API với danh mục và thương hiệu riêng", async () => {
    const category = await Category.create({ name: "Test Category", slug: "test-category" });
    const brand = await Brand.create({ name: "Test Brand", slug: "test-brand" });
    for (const slug of ["test-shirt", "other-shirt"]) {
      const response = await request("POST", "/products", {
        category_id: category.id, brand_id: brand.id, name: slug, slug,
      }, token);
      assert.equal(response.status, 201);
      if (slug === "test-shirt") productId = response.body.data._id;
      else otherProductId = response.body.data._id;
    }
  });

  await t.test("chặn khách chưa đăng nhập và khách không có quyền", async () => {
    for (const path of ["/products/admin", `${variantsPath()}/admin`]) {
      assert.equal((await request("GET", path)).status, 401);
      assert.equal((await request("GET", path, undefined, customerToken)).status, 403);
    }
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const path = variantsPath() + (method === "POST" ? "" : `/${new mongoose.Types.ObjectId()}`);
      assert.equal((await request(method, path, valid)).status, 401);
      assert.equal((await request(method, path, valid, customerToken)).status, 403);
    }
  });

  await t.test("thêm biến thể, chuẩn hóa dữ liệu và lưu MongoDB", async () => {
    const response = await request("POST", variantsPath(), valid, token);
    assert.equal(response.status, 201);
    variantId = response.body.data._id;
    const saved = await ProductVariant.findById(variantId).lean();
    assert.ok(saved);
    assert.equal(saved.sku, "TEST-M-BLACK");
    assert.equal(saved.size, "M");
    assert.equal(saved.color, "Đen");
    assert.equal(saved.stock_quantity, 10);
    // API-created products now start as drafts. Publish complete QA fixtures explicitly.
    for (const id of [productId,otherProductId]) {
      if(id===otherProductId) assert.equal((await request('POST','/products/'+id+'/variants',{sku:'OTHER-BASE',size:'M',color:'X',price:100000,stock_quantity:1},token)).status,201);
      assert.equal((await request('POST','/products/'+id+'/images',{image_url:'/uploads/fixture.png',is_primary:true,display_order:1},token)).status,201);
      const productVersion=(await Product.findById(id))?.get('__v')??0;
      assert.equal((await request('PATCH','/products/'+id,{status:true,product_code:id===productId?'TEST-SHIRT':'OTHER-SHIRT',expected_version:productVersion},token)).status,200);
    }
    const list = await request("GET", variantsPath());
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
  });

  await t.test("unique index chặn SKU toàn cục và tổ hợp size/màu", async () => {
    assert.equal((await request("POST", `/products/${otherProductId}/variants`, valid, token)).status, 409);
    assert.equal((await request("POST", variantsPath(), { ...valid, sku: "OTHER-SKU" }, token)).status, 409);
    const response = await request("POST", variantsPath(), { ...valid, sku: "TEST-L-BLACK", size: "L" }, token);
    assert.equal(response.status, 201);
    secondVariantId = response.body.data._id;
    assert.equal((await request("PATCH", `${variantsPath()}/${secondVariantId}`, { size: "M", expected_version: (await ProductVariant.findById(secondVariantId))?.get("__v") ?? 0 }, token)).status, 409);
    assert.equal((await ProductVariant.findById(secondVariantId))?.size, "L");
  });

  await t.test("hai request thêm cùng SKU chỉ một request thành công", async () => {
    const input = { ...valid, sku: "RACE-SKU", size: "XL" };
    const responses = await Promise.all([request("POST", variantsPath(), input, token), request("POST", variantsPath(), input, token)]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    assert.equal(await ProductVariant.countDocuments({ sku: "RACE-SKU" }), 1);
  });

  await t.test("từ chối giá/tồn kho sai và không lưu thay đổi khi lỗi", async () => {
    for (const input of [{ price: -1 }, { stock_quantity: 1.5 }, { sale_price: 260000 }, { price: 200000 }, { product_id: otherProductId }]) {
      assert.equal((await request("PATCH", `${variantsPath()}/${variantId}`, input, token)).status, 400, JSON.stringify(input));
    }
    const saved = await ProductVariant.findById(variantId);
    assert.equal(saved?.price, 250000);
    assert.equal(saved?.sale_price, 220000);
    assert.equal(saved?.stock_quantity, 10);
    assert.equal((await request("POST", variantsPath(), { ...valid, sku: "INVALID-PRICE", size: "XXL", sale_price: 260000 }, token)).status, 400);
  });

  await t.test("sửa giá, bỏ giá khuyến mãi và cho tồn kho bằng 0", async () => {
    const current = await ProductVariant.findById(variantId);
    const response = await request("PATCH", `${variantsPath()}/${variantId}`, { price: 200000, sale_price: null, expected_version: current?.get("__v") ?? 0 }, token);
    assert.equal(response.status, 200);
    const saved = await ProductVariant.findById(variantId);
    assert.equal(saved?.price, 200000);
    assert.equal(saved?.sale_price, null);
    assert.equal(saved?.stock_quantity,10);
    const inventory=await request('POST','/admin/inventory/'+variantId+'/adjustment',{mode:'set',quantity:0,expected_version:saved?.get('__v')??0,note:'QA kiểm kê về0'},token);
    assert.equal(inventory.status,200);assert.equal((await ProductVariant.findById(variantId))?.stock_quantity,0);
  });

  await t.test("biến thể không thuộc sản phẩm và ID không hợp lệ", async () => {
    const wrongPath = `/products/${otherProductId}/variants/${variantId}`;
    assert.equal((await request("PATCH", wrongPath, { price: 100 }, token)).status, 404);
    assert.equal((await request("DELETE", wrongPath, undefined, token)).status, 404);
    assert.equal((await request("GET", "/products/invalid/variants")).status, 400);
    assert.equal((await request("PATCH", `${variantsPath()}/invalid`, { price: 100 }, token)).status, 400);
  });

  await t.test("DELETE ẩn biến thể khỏi danh sách và chi tiết; PATCH bật bán lại", async () => {
    assert.equal((await request("DELETE", `${variantsPath()}/${variantId}`, undefined, token)).status, 200);
    assert.equal((await ProductVariant.findById(variantId))?.status, false);
    const adminList = await request("GET", `${variantsPath()}/admin`, undefined, token);
    assert.equal(adminList.status, 200);
    assert.equal(adminList.body.data.find((variant: { _id: string }) => variant._id === variantId)?.status, false);
    const list = await request("GET", variantsPath());
    assert.ok(!list.body.data.some((variant: { _id: string }) => variant._id === variantId));
    const detail = await request("GET", `/products/${productId}`);
    assert.equal(detail.status, 200);
    assert.ok(!detail.body.data.variants.some((variant: { _id: string }) => variant._id === variantId));
    assert.equal((await request("PATCH", `${variantsPath()}/${variantId}`, { status: true, expected_version:(await ProductVariant.findById(variantId))?.get("__v")??0 }, token)).status, 200);
    assert.equal((await ProductVariant.findById(variantId))?.status, true);
  });

  await t.test("phiên bản MongoDB chặn ghi đè dữ liệu đã được người khác sửa", async () => {
    const first = await ProductVariant.findById(variantId);
    const second = await ProductVariant.findById(variantId);
    assert.ok(first && second);
    first.stock_quantity = 3;
    await first.save();
    second.stock_quantity = 4;
    await assert.rejects(second.save(), mongoose.Error.VersionError);
    assert.equal((await ProductVariant.findById(variantId))?.stock_quantity, 3);
  });

  await t.test("đánh giá đúng sản phẩm sau giao hàng và xử lý báo cáo trùng", async () => {
    const customer = await User.findOne({ email: "customer@variant-test.invalid" });
    assert.ok(customer);
    const order = await Order.create({
      user_id: customer._id, total_product_amount: 400000, final_amount: 400000,
      receiver_name: customer.name, receiver_phone: "0900000000", shipping_address: "Địa chỉ kiểm thử",
      payment_method: "VNPay", payment_status: "success", order_status: "shipping",
    });
    const line = { order_id: order._id, product_name: "Tên sản phẩm cũ", size: "M", color: "Đen", quantity: 1, price_at_buy: 200000 };
    await OrderDetail.insertMany([
      { ...line, sku: "LEGACY-REVIEW", product_variant_id: variantId },
      { ...line, sku: "SNAPSHOT-REVIEW", product_variant_id: new mongoose.Types.ObjectId(), product_id: otherProductId },
    ]);
    const orderPath = `/orders/${order.id}`;
    const reviewPath = `/reviews/${productId}`;
    const reviewInput = { rating: 5, comment: "Vải mềm và đúng kích cỡ." };
    const shipping = await request("GET", orderPath, undefined, customerToken);
    assert.equal(shipping.body.data.items[0].review_product_id, undefined);
    assert.equal((await request("POST", reviewPath, reviewInput, customerToken)).status, 403);

    await Order.updateOne({ _id: order._id }, { order_status: "completed" });
    const completed = await request("GET", orderPath, undefined, customerToken);
    assert.equal(completed.status, 200);
    assert.deepEqual(completed.body.data.items.map((item: { review_product_id: string }) => item.review_product_id).sort(),
      [productId, otherProductId].sort());
    assert.equal((await request("GET", orderPath, undefined, token)).status, 404);
    for (const id of [productId, otherProductId]) {
      const eligibility = await request("GET", `/reviews/${id}/eligibility`, undefined, customerToken);
      assert.equal(eligibility.body.data.canReview, true);
    }
    assert.equal((await request("POST", reviewPath, reviewInput, token)).status, 403);

    const saved = await request("POST", reviewPath, reviewInput, customerToken);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.data.user_email, undefined);
    const reviewId = saved.body.data._id;
    const reportPath = `${reviewPath}/reports/${reviewId}`;
    assert.equal((await request("POST", reportPath, { reason: "invalid" }, token)).status, 400);
    assert.equal((await request("POST", reportPath, { reason: "spam" }, customerToken)).status, 403);
    const reports = await Promise.all([
      request("POST", reportPath, { reason: "spam" }, token),
      request("POST", reportPath, { reason: "spam" }, token),
    ]);
    assert.deepEqual(reports.map((result) => result.status).sort(), [200, 201]);
    assert.equal((await request("GET", "/admin/review-reports", undefined, customerToken)).status, 403);
    const pending = await request("GET", "/admin/review-reports", undefined, token);
    assert.equal(pending.body.data.reports.length, 1);
    assert.equal(pending.body.data.reports[0].comment, reviewInput.comment);
    assert.equal((await request("DELETE", `/admin/reviews/${reviewId}`, undefined, token)).status, 404);
    assert.equal((await request("PATCH", `/admin/reviews/${reviewId}/moderation`, { mask_all: true }, token)).status, 200);
    const masked = await request("GET", reviewPath);
    assert.equal(masked.body.data.total, 1);
    assert.equal(masked.body.data.comments[0].rating, 5);
    assert.match(masked.body.data.comments[0].comment, /^[*\s]+$/u);
    assert.equal((await request("GET", "/admin/review-reports", undefined, token)).body.data.reports.length, 0);
    const history = await request("GET", "/admin/review-reports?view=history", undefined, token);
    assert.equal(history.body.data.reports[0].status, "masked");
  });

  await t.test("admin vẫn quản lý được sản phẩm đã tắt và danh sách có phân trang", async () => {
    await Product.findByIdAndUpdate(productId, { status: false });
    assert.equal((await request("GET", variantsPath())).status, 404);
    const adminList = await request("GET", "/products/admin?limit=1&page=1", undefined, token);
    assert.equal(adminList.status, 200);
    assert.equal(adminList.body.data.length, 1);
    assert.equal(adminList.body.pagination.total, 2);
    assert.equal(adminList.body.pagination.totalPages, 2);
    const allProducts = await request("GET", "/products/admin?limit=25", undefined, token);
    assert.equal(allProducts.body.data.find((product: { _id: string }) => product._id === productId)?.status, false);
    const variants = await request("GET", `${variantsPath()}/admin`, undefined, token);
    assert.equal(variants.status, 200);
    assert.ok(variants.body.data.length > 0);
    assert.equal((await request("GET", "/products/admin?page=Infinity", undefined, token)).status, 400);
  });

  await t.test("thử lại MoMo trên một đơn và giữ nguyên mã yêu cầu khi cổng tạm lỗi", async (test) => {
    const backendOrigin = new URL(base).origin;
    const environment = {
      MOMO_PARTNER_CODE: "LOCAL_TEST",
      MOMO_ENABLED: "true",
      MOMO_ACCESS_KEY: randomUUID(),
      MOMO_SECRET_KEY: randomUUID(),
      MOMO_ENDPOINT: `${backendOrigin}/mock-momo`,
      MOMO_REDIRECT_URL: `${base}/payments/momo/return`,
      MOMO_IPN_URL: `${base}/payments/momo/ipn`,
      MOMO_RESULT_PAGE_URL: "",
    };
    const previous = Object.keys(environment).map((key) => [key, process.env[key]] as const);
    test.after(() => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
    Object.assign(process.env, environment);
    const methods = () => request("GET", "/payments/methods", undefined, customerToken);
    assert.ok(!(await methods()).body.data.includes("MoMo"));
    process.env.MOMO_RESULT_PAGE_URL = `${backendOrigin}/payment/result`;
    assert.ok((await methods()).body.data.includes("MoMo"));

    const customer = await User.findOne({ email: "customer@variant-test.invalid" });
    assert.ok(customer);
    const order = await Order.create({
      user_id: customer._id, total_product_amount: 200000, final_amount: 200000,
      receiver_name: customer.name, receiver_phone: "0900000000", shipping_address: "Địa chỉ kiểm thử",
      payment_method: "MoMo",
    });
    const createPayment = () => request("POST", "/payments/momo/create", { order_id: order.id }, customerToken);
    assert.equal((await createPayment()).status, 502);
    assert.equal((await Payment.findOne({ order_id: order._id }))?.payment_url, "");
    const retried = await createPayment();
    assert.equal(retried.status, 200);
    assert.match(retried.body.data.payment_url, /^https:\/\/test-payment\.momo\.vn\//);
    const cached = await createPayment();
    assert.equal(cached.body.data.reused, true);
    assert.equal(cached.body.data.payment_id, retried.body.data.payment_id);
    assert.deepEqual(momoAttempts, [
      { orderId: order.id, requestId: order.id, amount: 200000 },
      { orderId: order.id, requestId: order.id, amount: 200000 },
    ]);
    assert.equal(await Payment.countDocuments({ order_id: order._id }), 1);
    assert.equal((await Order.findById(order._id))?.payment_status, "pending");
  });

  await t.test("SePay tạo QR theo đơn và xác nhận giao dịch qua webhook hoặc API", async (test) => {
    const environment = {
      SEPAY_BANK_CODE: "MBBank",
      SEPAY_ACCOUNT_NUMBER: "000123456789",
      SEPAY_ACCOUNT_NAME: "FSTYLE TEST",
      SEPAY_WEBHOOK_API_KEY: randomUUID(),
      SEPAY_API_TOKEN: randomUUID(),
      SEPAY_ENV: "sandbox",
    };
    const previous = Object.keys(environment).map((key) => [key, process.env[key]] as const);
    test.after(() => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
    Object.assign(process.env, { ...environment, SEPAY_WEBHOOK_API_KEY: "", SEPAY_API_TOKEN: "" });
    const methods = () => request("GET", "/payments/methods", undefined, customerToken);
    assert.ok(!(await methods()).body.data.includes("SePay"));
    process.env.SEPAY_API_TOKEN = environment.SEPAY_API_TOKEN;
    assert.ok((await methods()).body.data.includes("SePay"));
    process.env.SEPAY_WEBHOOK_API_KEY = environment.SEPAY_WEBHOOK_API_KEY;
    assert.ok((await methods()).body.data.includes("SePay"));

    const customer = await User.findOne({ email: "customer@variant-test.invalid" });
    assert.ok(customer);
    await Product.updateOne({ _id: productId }, { $set: { status: true } });
    await ProductVariant.updateOne({ _id: variantId }, { $set: { status: true, stock_quantity: 5 } });
    const cart = await Cart.findOneAndUpdate({ user_id: customer._id }, { $setOnInsert: { user_id: customer._id } }, { upsert: true, returnDocument: "after" });
    await CartDetail.create({ cart_id: cart._id, product_variant_id: variantId, quantity: 1 });
    const address = await Address.create({
      user_id: customer._id, receiver_name: customer.name, receiver_phone: "0900000000",
      province: "Thành phố Hồ Chí Minh", ward: "Phường Sài Gòn", address_detail: "Địa chỉ kiểm thử",
    });
    const quote = await request("POST", "/orders/quote", {}, customerToken);
    assert.equal(quote.status, 200, quote.body.message);
    const created = await request("POST", "/orders", {
      address_id: address.id, payment_method: "SePay", expected_total: quote.body.data.final_amount,
    }, customerToken);
    assert.equal(created.status, 201, created.body.message);
    const order = await Order.findById(created.body.data.order_id);
    assert.ok(order);
    assert.equal(order.payment_method, "SePay");
    assert.equal((await ProductVariant.findById(variantId))?.stock_quantity, 4);
    const checkout = (id = order.id, authToken = customerToken) =>
      request("POST", "/payments/sepay/create", { order_id: id, amount: 1 }, authToken);
    assert.equal((await checkout(order.id, token)).status, 404);
    const concurrent = await Promise.all([checkout(), checkout()]);
    assert.ok(concurrent.every((result) => result.status === 200), JSON.stringify(concurrent));
    const qrData = concurrent[0]!.body.data;
    assert.equal(concurrent[1]!.body.data.payment_id, qrData.payment_id);
    assert.equal(await Payment.countDocuments({ order_id: order._id }), 1);
    assert.equal(qrData.amount, order.final_amount);
    assert.match(qrData.transfer_content, /^FS[0-9]{12}$/);
    const qr = new URL(qrData.qr_url);
    assert.equal(qr.origin, "https://vietqr.app");
    assert.equal(qr.searchParams.get("des"), qrData.transfer_content);
    assert.equal(qr.searchParams.get("acc"), environment.SEPAY_ACCOUNT_NUMBER);
    assert.equal(qr.searchParams.get("amount"), String(order.final_amount));
    assert.ok(!JSON.stringify(qrData).includes(environment.SEPAY_WEBHOOK_API_KEY));

    const webhookData = {
      id: 92704, transferType: "in", gateway: environment.SEPAY_BANK_CODE,
      accountNumber: environment.SEPAY_ACCOUNT_NUMBER, transferAmount: order.final_amount,
      content: `THANH TOAN ${qrData.transfer_content}`,
      code: qrData.transfer_content.match(/FS[0-9]{12}/)?.[0],
      referenceCode: "FT-SEPAY-TEST",
    };
    const notify = async (data: unknown, apiKey: string = environment.SEPAY_WEBHOOK_API_KEY) => {
      const response = await fetch(base + "/payments/sepay/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Apikey ${apiKey}` },
        body: JSON.stringify(data),
      });
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await notify(webhookData, "wrong-key")).status, 401);
    assert.equal((await notify({})).status, 400);
    for (const invalid of [
      { ...webhookData, transferType: "out" },
      { ...webhookData, transferAmount: order.final_amount - 1000 },
      { ...webhookData, accountNumber: "0000000000" },
      { ...webhookData, gateway: "ACB" },
    ]) {
      assert.equal((await notify(invalid)).status, 200);
      assert.equal((await Order.findById(order._id))?.payment_status, "pending");
    }
    const delivered = await Promise.all([notify(webhookData), notify(webhookData)]);
    assert.ok(delivered.every((response) => response.status === 200 && response.body.success === true));
    const paid = await Payment.findOne({ order_id: order._id });
    assert.equal(paid?.status, "success");
    assert.equal((await Order.findById(order._id))?.transaction_id, webhookData.referenceCode);
    assert.equal((await checkout()).status, 409);
    assert.equal((await ProductVariant.findById(variantId))?.stock_quantity, 4);
    await notify(webhookData);
    assert.deepEqual((await Payment.findById(paid!._id))?.paid_at, paid?.paid_at);

    const nextOrder = await Order.create({
      user_id: customer._id, total_product_amount: 200000, final_amount: 200000,
      receiver_name: customer.name, receiver_phone: "0900000000", shipping_address: "Địa chỉ kiểm thử",
      payment_method: "SePay",
    });
    const nextQR = (await checkout(nextOrder.id)).body.data;
    const nextTransfer = {
      ...webhookData, transferAmount: nextOrder.final_amount, content: nextQR.transfer_content,
      code: nextQR.transfer_content.match(/FS[0-9]{12}/)?.[0],
    };
    // ID webhook và mã tham chiếu đều không được dùng cho một đơn thứ hai.
    await notify({ ...nextTransfer, referenceCode: "FT-OTHER-REFERENCE" });
    await notify({ ...nextTransfer, id: 92705 });
    assert.equal((await Order.findById(nextOrder._id))?.payment_status, "pending");

    const fetchReal = globalThis.fetch;
    let transactions: unknown[] = [];
    let failedResponse = true;
    let apiCalls = 0;
    test.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.origin !== "https://userapi-sandbox.sepay.vn") return fetchReal(input, init);
      apiCalls++;
      assert.equal(url.pathname, "/v2/transactions");
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${environment.SEPAY_API_TOKEN}`);
      assert.equal(url.searchParams.get("transaction_content"), nextQR.transfer_content);
      if (failedResponse) return Response.json({}, { status: 503 });
      return Response.json({ status: "success", data: transactions });
    });
    const reconcile = () => request("POST", `/payments/sepay/orders/${nextOrder.id}/reconcile`, undefined, customerToken);
    const resetCheck = () => Payment.updateOne({ order_id: nextOrder._id }, { $unset: { sepay_checked_at: "" } });
    assert.equal((await request("POST", `/payments/sepay/orders/${nextOrder.id}/reconcile`, undefined)).status, 401);
    assert.equal((await reconcile()).status, 502);
    assert.equal((await Order.findById(nextOrder._id))?.payment_status, "pending");
    await resetCheck();
    failedResponse = false;
    const transaction = {
      id: randomUUID(), transfer_type: "in", amount_in: nextOrder.final_amount, amount_out: 0,
      account_number: environment.SEPAY_ACCOUNT_NUMBER, bank_brand_name: environment.SEPAY_BANK_CODE,
      reference_number: "FT-SEPAY-SECOND", transaction_content: nextQR.transfer_content,
      code: nextQR.transfer_content.match(/FS[0-9]{12}/)?.[0],
    };
    transactions = [
      null, { ...transaction, amount_in: 1 }, { ...transaction, account_number: "0000000000" },
      { ...transaction, transfer_type: "out" }, { ...transaction, reference_number: webhookData.referenceCode },
    ];
    assert.equal((await reconcile()).status, 200);
    assert.equal((await Order.findById(nextOrder._id))?.payment_status, "pending");
    const callsBeforeThrottle = apiCalls;
    await reconcile();
    assert.equal(apiCalls, callsBeforeThrottle);
    await resetCheck();
    transactions = [transaction];
    assert.equal((await reconcile()).status, 200);
    assert.equal((await Order.findById(nextOrder._id))?.payment_status, "success");
    await notify({ ...nextTransfer, id: 92706, referenceCode: transaction.reference_number });
    assert.equal(await Payment.countDocuments({ order_id: nextOrder._id, status: "success" }), 1);

    // Localhost có thể tạo QR bằng API Token trước khi bật webhook.
    process.env.SEPAY_BANK_CODE = "VietinBank";
    process.env.SEPAY_WEBHOOK_API_KEY = "";
    const vietinOrder = await Order.create({
      user_id: customer._id, total_product_amount: 200000, final_amount: 200000,
      receiver_name: customer.name, receiver_phone: "0900000000", shipping_address: "Địa chỉ kiểm thử",
      payment_method: "SePay",
    });
    const vietinCheckout = await checkout(vietinOrder.id);
    assert.equal(vietinCheckout.status, 200, vietinCheckout.body.message);
    const vietinQR = vietinCheckout.body.data;
    assert.match(vietinQR.transfer_content, /^SEVQR FS[0-9]{12}$/);
    assert.equal(new URL(vietinQR.qr_url).searchParams.get("des"), vietinQR.transfer_content);
    assert.equal((await notify(webhookData)).status, 503);
    process.env.SEPAY_WEBHOOK_API_KEY = environment.SEPAY_WEBHOOK_API_KEY;
    const vietinWebhook = await notify({
      ...webhookData, id: 92707, gateway: "VietinBank",
      transferAmount: vietinOrder.final_amount, content: vietinQR.transfer_content,
      code: vietinQR.transfer_content.match(/FS[0-9]{12}/)?.[0], referenceCode: "FT-VIETINBANK-TEST",
    });
    assert.equal(vietinWebhook.status, 200);
    assert.equal((await Order.findById(vietinOrder._id))?.payment_status, "success");
  });

  await t.test("khôi phục mật khẩu qua OTP và gửi liên hệ tài khoản cho admin", async (test) => {
    const environment = {
      SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "465",
      SMTP_USER: "sender@example.invalid", SMTP_PASSWORD: randomUUID(), SMTP_FROM: "F.Style <sender@example.invalid>",
    };
    const previous = Object.keys(environment).map((key) => [key, process.env[key]] as const);
    test.after(() => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
    Object.assign(process.env, environment);
    const deliveries: Array<{ email: string; code: string }> = [];
    test.mock.method(EmailService, "sendPasswordResetCode", async (email: string, code: string) => {
      deliveries.push({ email, code });
    });
    const email = "customer@variant-test.invalid";
    const send = (address = email) => request("POST", "/auth/forgot-password", { email: address });
    const reset = (requestId: string, code: string, newPassword: string, address = email) =>
      request("POST", "/auth/reset-password", { email: address, request_id: requestId, code, newPassword });
    const allowResend = () => PasswordReset.updateMany({}, { $set: { requested_at: new Date(Date.now() - 61_000) } });
    const latest = () => deliveries.at(-1)!;
    const wrongCode = (code: string) => (code[0] === "0" ? "1" : "0") + code.slice(1);

    process.env.SMTP_PASSWORD = "";
    assert.equal((await send()).status, 503);
    process.env.SMTP_PASSWORD = environment.SMTP_PASSWORD;
    const first = await send("  CUSTOMER@variant-test.invalid ");
    assert.equal(first.status, 202, first.body.message);
    assert.match(first.body.data.request_id, /^[a-f0-9]{64}$/);
    assert.equal(first.body.data.expires_in, 600);
    assert.equal(first.body.data.resend_after, 60);
    assert.equal("code" in first.body.data, false);
    assert.equal(deliveries.length, 1);
    assert.equal(latest().email, email);
    assert.match(latest().code, /^[0-9]{6}$/);
    const record = await PasswordReset.findOne({ request_id: first.body.data.request_id });
    assert.match(record!.code_hash, /^[a-f0-9]{64}$/);
    assert.notEqual(record!.code_hash, latest().code);
    assert.equal((await send()).status, 429);

    const testHash = await bcrypt.hash(password, 10);
    await User.create([
      { name: "Google Reset Fixture", email: "google@reset-test.invalid", auth_provider: "google", google_sub: randomUUID() },
      { name: "Blocked Reset Fixture", email: "blocked@reset-test.invalid", password: testHash, is_blocked: true },
    ]);
    for (const address of ["missing@reset-test.invalid", "blocked@reset-test.invalid"]) {
      const result = await send(address);
      assert.equal(result.status, 202);
      assert.equal(result.body.data.message, first.body.data.message);
      assert.equal((await reset(result.body.data.request_id, "000000", randomUUID(), address)).status, 400);
    }
    assert.equal(deliveries.length, 1);
    const firstCode = latest().code;
    assert.equal((await reset(first.body.data.request_id, firstCode, "short")).status, 400);
    assert.equal((await reset(first.body.data.request_id, wrongCode(firstCode), randomUUID())).status, 400);
    assert.equal((await request("POST", "/auth/login", { email, password })).status, 200);

    await PasswordReset.updateOne({ request_id: first.body.data.request_id }, { $set: { expires_at: new Date(Date.now() - 1000) } });
    assert.equal((await reset(first.body.data.request_id, firstCode, randomUUID())).status, 400);
    await allowResend();
    const second = await send();
    assert.equal(second.status, 202);
    assert.notEqual(second.body.data.request_id, first.body.data.request_id);
    assert.equal((await reset(first.body.data.request_id, firstCode, randomUUID())).status, 400);
    for (let index = 0; index < 5; index++) {
      assert.equal((await reset(second.body.data.request_id, wrongCode(latest().code), randomUUID())).status, 400);
    }
    assert.equal((await reset(second.body.data.request_id, latest().code, randomUUID())).status, 400);

    await allowResend();
    const third = await send();
    assert.equal(third.status, 202);
    const passwords = [randomUUID(), randomUUID()];
    const outcomes = await Promise.all(passwords.map((value) => reset(third.body.data.request_id, latest().code, value)));
    assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), [200, 400]);
    const accepted = outcomes.findIndex((outcome) => outcome.status === 200);
    assert.deepEqual(outcomes[accepted]!.body.data, { updated: true });
    const newPassword = passwords[accepted]!;
    assert.equal((await request("GET", "/auth/me", undefined, customerToken)).status, 401);
    assert.equal((await request("POST", "/auth/login", { email, password })).status, 401);
    const login = await request("POST", "/auth/login", { email, password: newPassword });
    assert.equal(login.status, 200);
    assert.equal((await request("GET", "/auth/me", undefined, login.body.data.token)).status, 200);
    assert.equal((await reset(third.body.data.request_id, latest().code, randomUUID())).status, 400);

    // Đổi mật khẩu trong tài khoản cũng vô hiệu hóa mã khôi phục đã gửi trước đó.
    await allowResend();
    const stale = await send();
    assert.equal(stale.status, 202);
    const staleCode = latest().code;
    assert.equal((await request("PATCH", "/auth/password", { currentPassword: newPassword, newPassword: randomUUID() }, login.body.data.token)).status, 200);
    assert.equal((await reset(stale.body.data.request_id, staleCode, randomUUID())).status, 400);

    // Tài khoản cũ thiếu auth_provider và session_version vẫn khôi phục được.
    const legacyEmail = "legacy@reset-test.invalid";
    await User.collection.insertOne({ name: "Legacy Reset Fixture", email: legacyEmail, password: testHash });
    const legacy = await send(legacyEmail);
    assert.equal(legacy.status, 202);
    const legacyPassword = randomUUID();
    assert.equal((await reset(legacy.body.data.request_id, latest().code, legacyPassword, legacyEmail)).status, 200);
    assert.equal((await request("POST", "/auth/login", { email: legacyEmail, password: legacyPassword })).status, 200);

    // Giới hạn gửi theo email vẫn có hiệu lực sau nhiều lần gửi lại.
    await PasswordResetLimit.deleteMany({});
    const limitedEmail = "rate-limit@reset-test.invalid";
    for (let index = 0; index < 5; index++) {
      await allowResend();
      assert.equal((await send(limitedEmail)).status, 202);
    }
    await allowResend();
    assert.equal((await send(limitedEmail)).status, 429);
    await PasswordResetLimit.deleteMany({});
    for (let index = 0; index < 30; index++) {
      assert.equal((await send(`ip-limit-${index}@reset-test.invalid`)).status, 202);
    }
    assert.equal((await send("ip-limit-31@reset-test.invalid")).status, 429);

    const ticket = await request("POST", "/contact", {
      name: "Khách hàng kiểm thử", email: "reachable@reset-test.invalid", topic: "tai-khoan",
      message: "Cần hỗ trợ tài khoản đã đăng ký bằng email cũ.",
    });
    assert.equal(ticket.status, 201);
    const inbox = await request("GET", "/admin/contacts", undefined, token);
    assert.equal(inbox.status, 200);
    assert.ok(inbox.body.data.requests.some((item: { _id: string; topic: string }) => item._id === ticket.body.data.id && item.topic === "tai-khoan"));
  });

  await t.test("Google tiếp tục đăng nhập sau OTP và khôi phục liên kết tài khoản Gmail cũ", async (test) => {
    const environment = {
      GOOGLE_CLIENT_ID: "google-recovery-fixture.apps.googleusercontent.com",
      SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "465", SMTP_USER: "sender@example.invalid",
      SMTP_PASSWORD: randomUUID(), SMTP_FROM: "VSC_BAPD <sender@example.invalid>",
    };
    const previous = Object.keys(environment).map((key) => [key, process.env[key]] as const);
    test.after(() => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
    Object.assign(process.env, environment);
    await PasswordResetLimit.deleteMany({});
    const deliveries: Array<{ email: string; code: string }> = [];
    test.mock.method(EmailService, "sendPasswordResetCode", async (email: string, code: string) => {
      deliveries.push({ email, code });
    });
    let profile: { sub: string; email: string; email_verified: boolean; name: string; hd?: string } = {
      sub: randomUUID(), email: "google-recovery@gmail.com", email_verified: true, name: "Google Recovery Fixture",
    };
    test.mock.method(OAuth2Client.prototype, "verifyIdToken", async (options: { idToken: string; audience: string }) => {
      assert.equal(options.audience, environment.GOOGLE_CLIENT_ID);
      if (options.idToken !== "verified-google-fixture") throw new Error("Invalid Google token");
      return { getPayload: () => ({ ...profile }) };
    });
    const googleLogin = (credential = "verified-google-fixture") => request("POST", "/auth/google", { credential });
    const setPasswordViaOTP = async (email: string, newPassword: string) => {
      const issued = await request("POST", "/auth/forgot-password", { email });
      assert.equal(issued.status, 202, issued.body.message);
      const delivery = deliveries.at(-1);
      assert.equal(delivery?.email, email);
      const changed = await request("POST", "/auth/reset-password", {
        email, request_id: issued.body.data.request_id, code: delivery?.code, newPassword,
      });
      assert.equal(changed.status, 200, changed.body.message);
    };

    const first = await googleLogin();
    assert.equal(first.status, 200, first.body.message);
    const original = await User.findOne({ email: profile.email }).select("+google_sub +password");
    assert.ok(original);
    assert.equal(original.google_sub, profile.sub);
    assert.equal(original.password, undefined);
    const newPassword = randomUUID();
    await setPasswordViaOTP(profile.email, newPassword);
    assert.equal((await request("GET", "/auth/me", undefined, first.body.data.token)).status, 401);
    const recovered = await googleLogin();
    assert.equal(recovered.status, 200, recovered.body.message);
    const me = await request("GET", "/auth/me", undefined, recovered.body.data.token);
    assert.equal(me.body.data._id, original.id);
    const retained = await User.findById(original._id).select("+google_sub +password");
    assert.equal(retained?.google_sub, profile.sub);
    assert.equal(retained?.auth_provider, "google");
    assert.equal(await User.countDocuments({ email: profile.email }), 1);
    assert.equal((await request("POST", "/auth/login", { email: profile.email, password: newPassword })).status, 200);

    // Dữ liệu cũ có mật khẩu nhưng chưa gắn google_sub như trường hợp bị báo lỗi.
    profile = { sub: randomUUID(), email: "legacy-google-recovery@gmail.com", email_verified: true, name: "Google Profile Name" };
    const local = await request("POST", "/auth/register", { email: profile.email, name: "Tên khách hàng đã lưu", password });
    assert.equal(local.status, 201);
    const localId = local.body.data._id;
    await User.updateOne({ _id: localId }, { $set: { role: "staff" } });
    const localPassword = randomUUID();
    await setPasswordViaOTP(profile.email, localPassword);
    const linked = await Promise.all([googleLogin(), googleLogin()]);
    assert.ok(linked.every((result) => result.status === 200), JSON.stringify(linked.map((result) => ({ status: result.status, message: result.body.message }))));
    assert.ok(linked.every((result) => result.body.data.role === "staff"));
    const localAfter = await User.findById(localId).select("+google_sub +password");
    assert.equal(localAfter?.google_sub, profile.sub);
    assert.equal(localAfter?.name, "Tên khách hàng đã lưu");
    assert.equal(await User.countDocuments({ email: profile.email }), 1);
    assert.equal((await request("POST", "/auth/login", { email: profile.email, password: localPassword })).status, 200);
    // auth_provider của dữ liệu cũ có thể là local dù đã có liên kết Google.
    assert.equal((await googleLogin()).status, 200);

    const passwordHash = await bcrypt.hash(password, 10);
    const boundSub = randomUUID();
    await User.create({
      email: "already-linked@gmail.com", name: "Existing Google Owner", google_sub: boundSub,
      auth_provider: "google", password: passwordHash,
    });
    profile = { sub: randomUUID(), email: "already-linked@gmail.com", email_verified: true, name: "Another Google Account" };
    assert.equal((await googleLogin()).status, 409);
    assert.equal((await User.findOne({ email: profile.email }).select("+google_sub"))?.google_sub, boundSub);

    await User.create({ email: "external-owner@example.invalid", name: "External Owner", password: passwordHash });
    profile = { sub: randomUUID(), email: "external-owner@example.invalid", email_verified: true, name: "External Google Account" };
    assert.equal((await googleLogin()).status, 409);
    assert.equal((await User.findOne({ email: profile.email }).select("+google_sub"))?.google_sub, undefined);
    // Workspace có hd do Google xác minh cũng có thể liên kết với tài khoản cùng email.
    profile = { ...profile, hd: "example.invalid" };
    assert.equal((await googleLogin()).status, 200);
    const verifiedSub = profile.sub;
    profile.email = "already-linked@gmail.com";
    assert.equal((await googleLogin()).status, 200);
    const stable = await User.findOne({ google_sub: verifiedSub });
    assert.equal(stable?.email, "external-owner@example.invalid");

    assert.equal((await googleLogin("invalid-google-fixture")).status, 401);
    profile = { sub: randomUUID(), email: "unverified-google@gmail.com", email_verified: false, name: "Unverified" };
    assert.equal((await googleLogin()).status, 401);
    assert.equal(await User.countDocuments({ email: profile.email }), 0);
    profile = { sub: randomUUID(), email: "blocked-google@gmail.com", email_verified: true, name: "Blocked" };
    await User.create({ email: profile.email, name: profile.name, google_sub: profile.sub, auth_provider: "google", is_blocked: true });
    assert.equal((await googleLogin()).status, 403);
  });

  await t.test("Ma trận màu × size lưu nguyên khối và ảnh theo màu; không ghi đè SKU đã có", async () => {
    const buyer = await request("POST", "/auth/register", { name: "Admin flow buyer", email: "adminflow-customer@variant-test.invalid", password });
    assert.equal(buyer.status, 201); customerToken = buyer.body.data.token;
    const parent = await Product.findById(productId).lean();
    assert.ok(parent);
    const p = await Product.create({ name: "Matrix integration", slug: "matrix-integration", category_id: parent.category_id, brand_id: parent.brand_id });
    const path = "/products/" + p.id + "/variants/batch";
    const rows = ["Đen", "Trắng"].flatMap((color, c) => ["S", "M"].map((size) => ({ sku: "MATRIX-" + c + "-" + size, size, color, price: 200000, sale_price: null, stock_quantity: 5 })));
    assert.equal((await request("POST", path, { variants: rows }, customerToken)).status, 403);
    const invalid = await request("POST", path, { variants: [rows[0], { ...rows[1], sale_price: 300000 }] }, token);
    assert.equal(invalid.status, 400);
    assert.equal(await ProductVariant.countDocuments({ product_id: p._id }), 0);
    const saved = await request("POST", path, { variants: rows, color_images: [{ color: "Đen", image_url: "/uploads/black-fixture.png" }, { color: "Trắng", image_url: "/uploads/white-fixture.png" }] }, token);
    assert.equal(saved.status, 201, saved.body.message);
    assert.equal(saved.body.data.length, 4);
    assert.equal(await ProductImage.countDocuments({ product_id: p._id }), 2);
    assert.equal(await ProductImage.countDocuments({ product_id: p._id, is_primary: true }), 1);
    assert.equal((await request("POST", path, { variants: rows }, token)).status, 409);
    assert.equal(await ProductVariant.countDocuments({ product_id: p._id }), 4);
    const collision = [{ ...rows[0], sku: "NEW-ROLLBACK-SKU", size: "XL" }, { ...rows[1], size: "XXL" }];
    assert.equal((await request("POST", path, { variants: collision }, token)).status, 409);
    assert.equal(await ProductVariant.countDocuments({ product_id: p._id, sku: "NEW-ROLLBACK-SKU" }), 0);
    const listed = await request("GET", "/products/admin?search=Matrix", undefined, token);
    assert.equal(listed.body.data[0]._id, p.id);
    assert.equal(listed.body.data[0].variant_count, 4);
    assert.equal(listed.body.data[0].image, "/uploads/black-fixture.png");
  });

  await t.test("Giao thất bại, giao lại, kiểm hàng hoàn, hàng cách ly và lịch sử khách không cộng kho trùng", async () => {
    const customer = await User.findOne({ email: "adminflow-customer@variant-test.invalid" }); assert.ok(customer);
    const v = await ProductVariant.create({ product_id: productId, sku: "RETURN-INSPECTION", size: "XXXL", color: "Nâu", price: 100000, stock_quantity: 2 });
    const order = await Order.create({ user_id: customer._id, total_product_amount: 300000, final_amount: 335000, shipping_fee: 35000, receiver_name: "Return fixture", receiver_phone: "0900000000", shipping_address: "Fixture", payment_method: "COD", payment_status: "pending", order_status: "shipping" });
    const item = await OrderDetail.create({ order_id: order._id, product_id: productId, product_variant_id: v._id, product_name: "Return fixture", sku: v.sku, size: v.size, color: v.color, quantity: 3, price_at_buy: 100000 });
    const path = "/admin/orders/" + order.id;
    assert.equal((await request("PATCH", path + "/delivery", { action: "fail", reason: "unreachable", note: "Không liên hệ được lần 1" }, customerToken)).status, 403);
    assert.equal((await request("PATCH", path + "/delivery", { action: "fail", reason: "unreachable", note: "Không liên hệ được lần 1" }, token)).status, 200);
    assert.equal((await ProductVariant.findById(v._id))?.stock_quantity, 2);
    assert.equal((await request("PATCH", path + "/delivery", { action: "retry", note: "Khách đồng ý nhận ngày hôm sau" }, token)).status, 200);
    assert.equal((await request("PATCH", path + "/delivery", { action: "fail", reason: "refused", note: "Khách xác nhận từ chối nhận, chuyển hoàn" }, token)).status, 200);
    assert.equal((await request("PATCH", path + "/cancel", { note: "Không được hủy tắt" }, token)).status, 409);
    assert.equal((await request("PATCH", path + "/delivery", { action: "return", note: "Đã thống nhất vận chuyển hoàn về shop" }, token)).status, 200);
    const line = { order_detail_id: item.id, restock_quantity: 1, damaged_quantity: 1, missing_quantity: 1 };
    assert.equal((await request("POST", path + "/return-receipt", { note: "Kiểm hàng", lines: [{ ...line, restock_quantity: 0 }] }, token)).status, 400);
    assert.equal((await ProductVariant.findById(v._id))?.stock_quantity, 2);
    const concurrent = await Promise.all([1, 2].map(() => request("POST", path + "/return-receipt", { note: "Một nguyên vẹn, một rách, một thiếu; giữ biên bản vận chuyển", lines: [line] }, token)));
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
    const after = await ProductVariant.findById(v._id); assert.ok(after);
    assert.equal(after.stock_quantity, 3); assert.equal(after.quarantine_quantity, 1);
    const closed = await Order.findById(order._id); assert.equal(closed?.order_status, "returned"); assert.equal(closed?.payment_status, "failed");
    assert.equal(await OrderReturn.countDocuments({ order_id: order._id }), 1);
    const operations = await request("GET", path + "/operations", undefined, token);
    assert.equal(operations.body.data.history.length, 5);
    assert.equal(operations.body.data.receipt.claim_status, "pending");
    assert.equal((await request("PATCH", path + "/return-claim", { note: "Đơn vị vận chuyển nhận xử lý bồi thường theo biên bản" }, token)).status, 200);
    const customers = await request("GET", "/admin/customers?search=adminflow-customer@variant-test.invalid", undefined, token);
    assert.equal(customers.status, 200);
    assert.equal(customers.body.data[0].refusalCount, 1);
    assert.equal(customers.body.data[0].returnedCount, 1);
    const history = await request("GET", "/admin/customers/" + customer.id + "/orders", undefined, token);
    const target = history.body.data.find((row: { _id: string }) => row._id === order.id);
    assert.equal(target.items[0].sku, v.sku); assert.equal(target.delivery_incidents.length, 2);
    const move = { action: "release", quantity: 1, expected_version: after.get("__v"), note: "Đã sửa và kiểm đạt chất lượng để bán" };
    assert.equal((await request("POST", "/admin/inventory/" + v.id + "/quarantine", { ...move, quantity: 2 }, token)).status, 409);
    assert.equal((await request("POST", "/admin/inventory/" + v.id + "/quarantine", move, token)).status, 200);
    assert.equal((await request("POST", "/admin/inventory/" + v.id + "/quarantine", move, token)).status, 409);
    const available = await ProductVariant.findById(v._id); assert.ok(available);
    assert.equal(available.stock_quantity, 4); assert.equal(available.quarantine_quantity, 0);
    const adjust = { mode: "add", quantity: 6, expected_version: available.get("__v"), note: "Nhập thêm từ nhà cung cấp, phiếu NK01" };
    assert.equal((await request("POST", "/admin/inventory/" + v.id + "/adjustment", adjust, token)).status, 200);
    assert.equal((await request("POST", "/admin/inventory/" + v.id + "/adjustment", adjust, token)).status, 409);
    assert.equal((await ProductVariant.findById(v._id))?.stock_quantity, 10);
    assert.equal(await InventoryMovement.countDocuments({ variant_id: v._id }), 3);
    const paid = await Order.create({ user_id: customer._id, total_product_amount: 100000, final_amount: 100000, receiver_name: "Paid return", receiver_phone: "0900000000", shipping_address: "Fixture", payment_method: "MoMo", payment_status: "success", order_status: "returned" });
    const refund = { amount: 100000, reference: "REFUND-FIXTURE-001", note: "Hoàn ngân hàng đã thực hiện", confirmed: true };
    assert.equal((await request("POST", "/admin/orders/" + paid.id + "/refund", { ...refund, amount: 90000 }, token)).status, 400);
    assert.equal((await request("POST", "/admin/orders/" + paid.id + "/refund", { ...refund, confirmed: false }, token)).status, 400);
    assert.equal((await request("POST", "/admin/orders/" + paid.id + "/refund", refund, token)).status, 200);
    assert.equal((await request("POST", "/admin/orders/" + paid.id + "/refund", refund, token)).status, 409);
    assert.equal((await Order.findById(paid._id))?.payment_status, "refunded");
  });

  await t.test("Doanh số, nhập hàng và hàng bán chậm loại đơn chờ/hủy/hoàn; tài khoản quản trị được bảo vệ", async () => {
    const customer = await User.findOne({ email: "adminflow-customer@variant-test.invalid" }); assert.ok(customer);
    const parent = await Product.findById(productId); assert.ok(parent);
    const old = new Date(Date.now() - 60 * 86400000);
    const makeProduct = async (name: string, slug: string, stock: number) => {
      const product = await Product.create({ name, slug, category_id: parent.category_id, brand_id: parent.brand_id, created_at: old });
      const variant = await ProductVariant.create({ product_id: product._id, sku: slug.toUpperCase(), size: "M", color: "Đen", price: 100000, stock_quantity: stock });
      return { product, variant };
    };
    const fast = await makeProduct("Cùng tên để kiểm tra mã", "analytics-fast", 2);
    const slow = await makeProduct("Cùng tên để kiểm tra mã", "analytics-slow", 80);
    for (const [status, payment, quantity] of [["completed", "success", 30], ["pending", "success", 500], ["cancelled", "success", 800], ["returned", "refunded", 900]] as const) {
      const order = await Order.create({ user_id: customer._id, total_product_amount: quantity * 100000, final_amount: quantity * 100000, receiver_name: "Analytics", receiver_phone: "0900000000", shipping_address: "Fixture", payment_method: "COD", order_status: status, payment_status: payment, completed_at: new Date() });
      await OrderDetail.create({ order_id: order._id, product_id: fast.product._id, product_variant_id: fast.variant._id, product_name: fast.product.name, sku: fast.variant.sku, size: "M", color: "Đen", quantity, price_at_buy: 100000 });
    }
    const response = await request("GET", "/admin/dashboard", undefined, token);
    assert.equal(response.status, 200, response.body.message);
    const data = response.body.data;
    const top = data.topProducts.find((row: { _id: string }) => row._id === fast.product.id);
    assert.equal(top.quantity, 30);
    assert.equal(data.topProducts.some((row: { _id: string }) => row._id === slow.product.id), false);
    const advice = data.restockRecommendations.find((row: { sku: string }) => row.sku === fast.variant.sku);
    assert.equal(advice.suggestedQuantity, 28);
    assert.equal(advice.coverDays, 2);
    assert.ok(data.slowProducts.some((row: { _id: string }) => row._id === slow.product.id));
    const expected = await Order.aggregate([{ $match: { order_status: "completed", payment_status: "success" } }, { $group: { _id: null, total: { $sum: "$final_amount" } } }]);
    assert.equal(data.metrics.totalRevenue, expected[0].total);
    const admin = await User.findOne({ role: "admin" }); assert.ok(admin);
    assert.equal((await request("PATCH", "/admin/customers/" + admin.id + "/role", { role: "customer" }, token)).status, 403);
    assert.equal((await request("PATCH", "/admin/customers/" + admin.id + "/block", { is_blocked: true }, token)).status, 403);
    assert.equal((await User.findById(admin._id))?.role, "admin");
    assert.equal((await User.findById(admin._id))?.is_blocked, false);
    const otherAdmin = await User.create({ name: "Protected admin", email: "otheradmin@business.invalid", role: "admin" });
    assert.equal((await request("PATCH", "/admin/customers/" + otherAdmin.id + "/role", { role: "staff" }, token)).status, 403);
    assert.equal((await request("PATCH", "/admin/customers/" + otherAdmin.id + "/block", { is_blocked: true }, token)).status, 403);
    const staff = await User.create({ name: "Operations staff", email: "opsstaff@business.invalid", role: "staff", password: await bcrypt.hash(password, 10) });
    const login = await request("POST", "/auth/login", { email: staff.email, password });
    assert.equal(login.status, 200);
    const staffToken = login.body.data.token;
    assert.equal((await request("PATCH", "/admin/customers/" + customer.id + "/role", { role: "staff" }, staffToken)).status, 403);
    assert.equal((await request("PATCH", "/admin/customers/" + customer.id + "/block", { is_blocked: true }, staffToken)).status, 403);
    assert.equal((await request("POST", "/admin/orders/" + new mongoose.Types.ObjectId() + "/refund", { amount: 1, reference: "fixture", note: "fixture", confirmed: true }, staffToken)).status, 403);
    const staffView = await request("GET", "/admin/customers?role=admin", undefined, staffToken);
    assert.ok(staffView.body.data.every((user: { role: string; canManage: boolean }) => user.role === "customer" && !user.canManage));
    const listed = await request("GET", "/admin/customers?role=admin", undefined, token);
    assert.equal(listed.body.data[0].canManage, false);
    assert.equal(listed.body.data[0].password, undefined); assert.equal(listed.body.data[0].google_sub, undefined);
  });

  await t.test("Từ cấm được che trong đánh giá cũ/mới, giữ nguyên số sao và nội dung gốc cho quản trị", async () => {
    const comment = await ProductComment.create({ product_key: productId, user_email: "mask@fixture.invalid", user_name: "Mask fixture", rating: 2, comment: "Giao chậm, cụm cấm kiểm thử, nhưng vải mềm." });
    assert.equal((await request("POST", "/admin/blocked-words", { word: "cụm cấm kiểm thử" }, customerToken)).status, 403);
    const word = await request("POST", "/admin/blocked-words", { word: "cụm cấm kiểm thử" }, token);
    assert.equal(word.status, 200);
    const response = await request("GET", "/reviews/" + productId);
    const publicReview = response.body.data.comments.find((row: { _id: string }) => row._id === comment.id);
    assert.equal(publicReview.rating, 2); assert.ok(publicReview.comment.includes("Giao chậm")); assert.ok(!publicReview.comment.includes("cụm cấm")); assert.ok(publicReview.comment.includes("*"));
    assert.equal((await ProductComment.findById(comment._id))?.comment, "Giao chậm, cụm cấm kiểm thử, nhưng vải mềm.");
    assert.equal((await request("PATCH", "/admin/blocked-words/" + word.body.data._id, { is_active: false }, token)).status, 200);
    const restored = await request("GET", "/reviews/" + productId);
    assert.ok(restored.body.data.comments.find((row: { _id: string }) => row._id === comment.id).comment.includes("cụm cấm"));
  });

});
