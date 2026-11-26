import { openProduct, matrix, image, saveProduct } from "./catalog-ui.mjs";
import { test, expect, state, api, token, signIn, db, oid, unique, emptyCart, add, evidence, order } from "./helpers.mjs";

test("OPS-006 hủy đơn trả trước, theo dõi tiền hoàn và đối chiếu sổ thanh toán", async ({ page }) => {
  const admin = await token("admin");
  const staff = await token("staff");
  const variant = { _id: oid(state.products[0].variants[0].id) };
  const stock = async () => (await db.collection("productvariants").findOne(variant)).stock_quantity;
  const initialStock = await stock();
  const id = (await order("BankTransfer")).order_id;
  const queue = async name => (await api("/admin/orders?queue=" + name + "&search=" + id, { token: admin })).body.pagination.total;
  const totals = async () => (await api("/admin/payments?summary=1&method=BankTransfer&limit=1", { token: admin })).body.pagination.paymentTotals;
  const payment = await api("/payments/bank-transfer", { token: await token(), method: "POST", data: { order_id: id } });
  expect(payment.status).toBe(200);
  expect(await queue("awaiting_payment")).toBe(1);
  expect(await queue("ready")).toBe(0);
  const before = await totals();
  const paid = await api("/payments/" + payment.body.data.payment_id + "/confirm", { token: admin, method: "PATCH", data: { transaction_id: unique("bank"), amount: payment.body.data.amount } });
  expect(paid.status).toBe(200);
  const amount = (await db.collection("orders").findOne({ _id: oid(id) })).final_amount;
  expect(await queue("ready")).toBe(1);
  expect(await queue("awaiting_payment")).toBe(0);
  expect((await totals()).collected).toBe(before.collected + amount);
  const cancel = (access) => api("/admin/orders/" + id + "/cancel", { token: access, method: "PATCH", data: { acknowledge_refund: true, note: "Khách yêu cầu hủy trước khi giao" } });
  expect((await cancel(staff)).status).toBe(403);
  await open(page, "Tổng quan");
  await page.getByRole("button", { name: /Chờ xác nhận đơn/ }).click();
  const row = page.getByRole("row").filter({ hasText: id.slice(-8).toUpperCase() });
  await page.getByPlaceholder("Tìm theo mã đơn, họ tên, SĐT khách...").fill(id);
  await row.getByRole("button", { name: "Hủy", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Xác nhận hủy đơn hàng" });
  await dialog.getByRole("textbox").fill("Khách yêu cầu hủy trước khi giao");
  await dialog.getByRole("button", { name: /Xác nhận hủy đơn & Hoàn kho/ }).click();
  await expect(row).toHaveCount(0);
  expect(await stock()).toBe(initialStock);
  expect((await cancel(admin)).status).toBe(409);
  expect(await queue("refund_due")).toBe(1);
  await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await page.getByRole("button", { name: /Chờ hoàn tiền/ }).click();
  await page.reload();
  await row.getByRole("button", { name: "Chi tiết", exact: true }).click();
  const reference = unique("refund");
  const refund = { confirmed: true, reference, amount, note: "Đã đối chiếu chứng từ" };
  const record = (access, data) => api("/admin/orders/" + id + "/refund", { token: access, method: "POST", data });
  expect((await record(staff, refund)).status).toBe(403);
  expect((await record(admin, { ...refund, amount: amount - 1 })).status).toBe(400);
  await page.getByLabel("Mã giao dịch hoàn tiền").fill(reference);
  await page.getByLabel("Ghi chú đối soát").fill(refund.note);
  await page.getByRole("checkbox", { name: /Tôi đã hoàn đủ/ }).check();
  await page.getByRole("button", { name: "Ghi nhận đã hoàn tiền" }).click();
  await expect(row).toHaveCount(0);
  expect(await queue("refund_due")).toBe(0);
  expect((await record(admin, refund)).status).toBe(409);
  expect(await stock()).toBe(initialStock);
  const after = await totals();
  expect(after.refunded).toBe(before.refunded + amount);
  expect(after.collected).toBe(before.collected + amount);
});

test("OPS-007 xử lý liên hệ theo trạng thái và bảo vệ thao tác đồng thời", async ({ page }) => {
  const name = unique("Liên hệ QA");
  const ticket = await api("/contact", { method: "POST", data: { name, email: "ticket@example.test", topic: "doi-tra", message: "Tôi cần hỗ trợ đổi size" } });
  expect(ticket.status).toBe(201);
  await open(page, "Yêu cầu liên hệ");
  const article = page.getByRole("article").filter({ hasText: name });
  await article.getByRole("button", { name: "Đánh dấu đã xử lý" }).click();
  await expect(article).toHaveCount(0);
  const stale = await api("/admin/contacts/" + ticket.body.data.id, { token: await token("staff"), method: "PATCH", data: { status: "resolved", expected_status: "new" } });
  expect(stale.status).toBe(409);
  await page.getByLabel("Trạng thái liên hệ").selectOption("resolved");
  await expect(article).toContainText("Cập nhật bởi");
  await article.getByRole("button", { name: "Mở lại" }).click();
  await expect(article).toHaveCount(0);
  await page.getByLabel("Trạng thái liên hệ").selectOption("new");
  await expect(article).toContainText("Chưa xử lý");
});

async function open(page, section) { await signIn(page, "admin"); await page.goto("/admin"); await page.getByRole("button", { name: section, exact: true }).click(); }

test("OPS-008 Staff mở hàng đợi vận chuyển, thử lại khi tải lỗi và theo dõi giao thất bại", async ({ page }) => {
  const { order_id: id } = await order();
  const staff = await token("staff");
  for (const status of ["processing", "shipping"]) {
    const response = await api(`/admin/orders/${id}/status`, { token: staff, method: "PATCH", data: { status } });
    expect(response.status).toBe(200);
  }
  await signIn(page, "staff");
  let simulateUnavailableOrders = true;
  await page.route("**/api/admin/orders?*", async (route) => {
    if (simulateUnavailableOrders) {
      await route.fulfill({ status: 503, json: { status: "error", message: "Không tải được danh sách thử nghiệm." } });
    } else {
      await route.fallback();
    }
  });

  await page.goto(`/admin#fulfillment?view=shipping&search=${id}`);
  const navigation = page.getByRole("navigation", { name: "Hàng đợi vận chuyển và hàng hoàn" });
  await expect(navigation.getByRole("link", { name: "Đang giao", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("table").getByRole("alert")).toContainText("Không tải được danh sách thử nghiệm.");
  simulateUnavailableOrders = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: id.slice(-8).toUpperCase() });
  await row.getByRole("button", { name: "Chi tiết", exact: true }).click();
  const operations = page.locator(".admin-order-operations");
  await operations.getByLabel("Biên bản / nội dung liên hệ khách", { exact: true }).fill("Đã xác minh khách chưa nhận.");
  await operations.getByRole("button", { name: "Ghi nhận giao thất bại" }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByText("Không có đơn đang giao khớp bộ lọc.")).toBeVisible();
  expect((await db.collection("orders").findOne({ _id: oid(id) })).order_status).toBe("delivery_failed");

  await navigation.getByRole("link", { name: "Giao thất bại", exact: true }).click();
  await page.getByRole("textbox", { name: "Tìm đơn hàng" }).fill(id);
  await expect(row).toBeVisible();
  await page.goBack();
  await expect(navigation.getByRole("link", { name: "Đang giao", exact: true })).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(page.getByText("Không có đơn đang giao khớp bộ lọc.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});
async function product() {
 const name=unique("QA Matrix"); const result=await api("/products", { token: await token("admin"), method: "POST", data: { name, slug: name.toLowerCase().replaceAll(" ", "-"), category_id: state.categoryId ?? (await db.collection("categories").findOne({}))._id.toString(), brand_id: state.brandId ?? (await db.collection("brands").findOne({}))._id.toString() } });
 expect(result.status).toBe(201); return result.body.data;
}
async function capture(page, name) { await page.screenshot({path: test.info().outputPath(name+".png"),fullPage:true}); }

test("OPS-001 tổng quan chia hàng bán chạy, nhập thêm và bán chậm", async ({page}) => {
 const errors=[]; page.on("pageerror",error=>errors.push(error.message));
 await open(page,"Tổng quan");
 await expect(page.getByRole("heading",{name:"Cần nhập thêm theo màu và size"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Hàng bán chậm cần xử lý"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Sản phẩm bán chạy · 30 ngày"})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2)).toBe(true);
 expect(errors).toEqual([]); await capture(page,"admin-business-dashboard");
});

test("OPS-002 tạo ma trận hai màu hai size và gắn ảnh theo màu",async({page})=>{
 const p=await product();await openProduct(page,p);await page.getByLabel('Mã sản phẩm',{exact:true}).fill(unique('QA').toUpperCase());await matrix(page,'S, M','Đen, Trắng','200000','5');await page.getByLabel('Tồn dòng 4',{exact:true}).fill('9');await image(page,undefined,'Đen');await image(page,state.web+'/images/products/2.webp','Trắng');await capture(page,'admin-matrix-preview');await saveProduct(page);
 expect(await db.collection('productvariants').countDocuments({product_id:oid(p._id)})).toBe(4);expect((await db.collection('productvariants').findOne({product_id:oid(p._id),size:'M',color:'Trắng'})).stock_quantity).toBe(9);expect(await db.collection('productimages').countDocuments({product_id:oid(p._id)})).toBe(2);
 await page.goto('/product/'+p._id);await expect(page.getByRole('heading',{name:p.name,exact:true})).toBeVisible();await page.getByRole('region',{name:'Thông tin sản phẩm',exact:true}).getByRole('button',{name:'Trắng',exact:true}).click();await expect(page.locator('.product-gallery-grid img').first()).toHaveAttribute('src',state.web+'/images/products/2.webp');await evidence('matrix-variants','productvariants',{product_id:oid(p._id)});
});

test("OPS-003 khách từ chối nhận, hoàn kiện và kiểm hàng hỏng qua giao diện", async ({page}) => {
 await emptyCart(); await add(0,2);
 const created=await api("/orders",{token:await token(),method:"POST",data:{address_id:state.addresses.customer,payment_method:"COD"}}); expect(created.status).toBe(201);
 const id=created.body.data.order_id, admin=await token("admin");
 for(const status of ["processing","shipping"]) expect((await api("/admin/orders/"+id+"/status",{token:admin,method:"PATCH",data:{status}})).status).toBe(200);
 const item=await db.collection("orderdetails").findOne({order_id:oid(id)});
 const before=await db.collection("productvariants").findOne({_id:item.product_variant_id});
 await open(page,"Quản lý đơn hàng");
 await page.getByPlaceholder("Tìm theo mã đơn, họ tên, SĐT khách...").fill(id.slice(-8));
 const row=page.getByRole("row").filter({hasText:id.slice(-8).toUpperCase()});
 await row.getByRole("button",{name:"Chi tiết",exact:true}).click();
 const ops=page.locator(".admin-order-operations");
 await ops.getByLabel("Biên bản / nội dung liên hệ khách",{exact:true}).fill("Khách đã xác nhận từ chối nhận; không thu tiền COD.");
 await ops.getByRole("button",{name:"Ghi nhận giao thất bại",exact:true}).click();
 await expect(ops.getByRole("button",{name:"Yêu cầu hoàn về shop",exact:true})).toBeVisible();
 await ops.getByLabel("Biên bản / nội dung liên hệ khách",{exact:true}).fill("Đã bàn giao hãng vận chuyển đưa kiện về shop.");
 await ops.getByRole("button",{name:"Yêu cầu hoàn về shop",exact:true}).click();
 await expect(ops.getByRole("heading",{name:"Biên bản nhận và kiểm hàng hoàn",exact:true})).toBeVisible();
 await ops.getByLabel(item.sku+" nguyên vẹn",{exact:true}).fill("1");
 await ops.getByLabel(item.sku+" hỏng",{exact:true}).fill("1");
 await ops.getByLabel("Kết quả kiểm hàng / tình trạng bao bì",{exact:true}).fill("Kiện rách: 1 áo nguyên vẹn, 1 áo hỏng; cách ly chờ đối soát.");
 await ops.getByRole("button",{name:"Xác nhận đã nhận và kiểm hàng",exact:true}).click();
 await expect(ops.getByRole("heading",{name:"Tổn thất đang chờ đối soát",exact:true})).toBeVisible();
 const after=await db.collection("productvariants").findOne({_id:item.product_variant_id});
 expect(after.stock_quantity).toBe(before.stock_quantity+1); expect(after.quarantine_quantity).toBe((before.quarantine_quantity??0)+1);
 expect((await db.collection("orders").findOne({_id:oid(id)})).order_status).toBe("returned");
 expect(await db.collection("orderreturns").countDocuments({order_id:oid(id)})).toBe(1);
 await capture(page,"admin-return-inspection"); await evidence("return-receipt","orderreturns",{order_id:oid(id)});
});

test("OPS-004 lịch sử khách và quản trị viên chỉ xem, không hiện nút tự khóa", async ({page}) => {
 await open(page,"Khách hàng");
 await page.getByLabel("Tìm tài khoản",{exact:true}).fill(state.users.customer.email);
 const row=page.getByRole("row").filter({hasText:state.users.customer.email});
 await row.getByRole("button",{name:/Xem đã mua gì/}).click();
 const modal=page.getByRole("dialog",{name:"Lịch sử mua hàng"});
 await expect(modal.getByText(/Từ chối nhận|từ chối nhận/).first()).toBeVisible();
 await capture(page,"admin-customer-history"); await modal.getByRole("button",{name:"Đóng",exact:true}).click();
 await page.getByLabel("Tìm tài khoản",{exact:true}).fill("");
 await page.getByLabel("Nhóm tài khoản",{exact:true}).selectOption("admin");
 const admins=page.getByRole("row").filter({hasText:state.users.admin.email});
 await expect(admins).toBeVisible(); await expect(admins.getByRole("button",{name:"Phân quyền",exact:true})).toHaveCount(0);
 await expect(admins.getByRole("button",{name:"Khóa",exact:true})).toHaveCount(0);
 await expect(admins).toContainText("Tài khoản quản trị được bảo vệ");
});

test("OPS-005 từ cấm được che trên sản phẩm mà giữ nguyên số sao", async ({page}) => {
 const p=state.products[0].id, marker=unique("qa-forbidden");
 await db.collection("productcomments").insertOne({product_key:p,user_email:unique("review")+"@test.invalid",user_name:"QA moderation "+marker,rating:2,comment:"Giao chậm "+marker+" nhưng vải đẹp.",createdAt:new Date(),updatedAt:new Date()});
 await open(page,"Đánh giá sản phẩm"); await page.getByRole("button",{name:"Từ cấm và che nội dung",exact:true}).click();
 await page.getByLabel("Từ/cụm từ cần che",{exact:true}).fill(marker);
 await page.getByRole("button",{name:"Thêm quy tắc che",exact:true}).click();
 await expect(page.getByRole("cell",{name:marker,exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Đánh giá sản phẩm",exact:true}).last().click();
 await expect(page.getByRole("button",{name:"Xóa đánh giá",exact:true})).toHaveCount(0);
 const reviews=await api("/reviews/"+p); const review=reviews.body.data.comments.find(r=>r.user_name === "QA moderation "+marker);
 expect(review.rating).toBe(2); expect(review.comment).toContain("*"); expect(review.comment).not.toContain(marker);
 await page.goto("/product/"+p+"#product-reviews");
 await expect(page.locator(".product-review").filter({hasText: "QA moderation "+marker}).getByText(review.comment,{exact:true})).toBeVisible(); await capture(page,"customer-masked-review");
});
