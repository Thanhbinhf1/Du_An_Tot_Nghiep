import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Run against the disposable server started by the existing E2E harness.
const stage = process.argv[2];
if (!["before", "after", "review"].includes(stage)) throw Error("Use before, review or after");
const state = JSON.parse(await readFile(process.env.RECOVERY_QA_STATE ?? new URL("./.runtime/state.json", import.meta.url)));
if (state.web !== "http://127.0.0.1:3101" || state.api !== "http://127.0.0.1:5100/api" ||
    !/^mongodb:\/\/127\.0\.0\.1:\d+\/fstyle_e2e_/.test(state.mongoUri)) throw Error("Isolated E2E server required");
const dest = fileURLToPath(new URL(`../../customer-qa/${stage}/`, import.meta.url));
await mkdir(dest, { recursive: true });
const login = await fetch(state.api + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: state.users.customer.email, password: state.password }) });
if (!login.ok) throw Error("Fixture login failed");
const { data: { token } } = await login.json();
const orders = await fetch(state.api + "/orders/my", { headers: { Authorization: `Bearer ${token}` } });
if (!orders.ok) throw Error("Fixture order lookup failed");
const order = state.visualOrderId ?? (await orders.json()).data[0]?._id;
if (!order) throw Error("Expected a disposable customer order");
const product = state.products[0].id;
const routes = {
  home: "/", products: "/products", category: "/categories/nam", search: "/search?q=QA",
  product: "/product/" + product, nu: "/nu", nam: "/nam", kids: "/tre-em", baby: "/em-be",
  cart: "/cart", checkout: "/checkout", profile: "/profile", edit: "/profile/edit",
  address: "/profile/address", password: "/profile/password", orders: "/orders", order: "/orders/" + order,
  wishlist: "/wishlist", login: "/dang-nhap", register: "/dang-ky", forgot: "/quen-mat-khau",
  size: "/tu-van-size?productId=" + product, outfit: "/outfit", mix: "/mix-match", help: "/help",
  contact: "/contact", shipping: "/shipping", returns: "/returns", terms: "/terms", privacy: "/privacy",
  result: "/payment/result?orderId=" + order, bank: "/payment/bank-transfer", sepay: "/payment/sepay",
  confirmation: "/order-confirmation?id=" + order, ordersAlias: "/orders/backend",
  ...(stage === "before" ? {} : { reviews: "/profile/reviews" }),
};
const only = process.argv.slice(3);
const targets = Object.entries(routes).filter(([name]) => !only.length || only.includes(name));
if (!targets.length) throw Error("No routes selected");
const browser = await chromium.launch();
const widths = stage === "before" ? [1440, 390] : [1440, 1280, 768, 390, 320];
const results = [];
async function capture(name, route) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  try {
    await context.route("**/*", (request) => {
      const url = new URL(request.request().url());
      return [state.web, new URL(state.api).origin].includes(url.origin) || ["blob:", "data:"].includes(url.protocol)
        ? request.continue() : request.abort();
    });
    if (!["login", "register", "forgot"].includes(name)) {
      await context.addInitScript(({ token, email }) => {
        for (const [key, value] of Object.entries({ authenticated: "true", account: email, role: "customer", token })) {
          localStorage.setItem("bapd-demo-" + key, value);
        }
      }, { token, email: state.users.customer.email });
    }
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", msg => { if (msg.type() === "error" && /hydration|did not match/i.test(msg.text())) errors.push("Hydration error"); });
    const response = await page.goto(state.web + route, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.locator("main").waitFor();
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.locator("main h1").first().waitFor({ timeout: 30000 });
    if (name === "cart") await page.locator(".cart-item").first().waitFor();
    if (name === "checkout") await page.locator(".place-order-button:enabled").first().waitFor();
    for (const width of widths) {
      await page.setViewportSize({ width, height: width >= 1280 ? 900 : width === 768 ? 1024 : width === 390 ? 844 : 720 });
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
      const layout = await page.evaluate(() => ({
        width: innerWidth, documentWidth: document.documentElement.scrollWidth,
        heading: document.querySelector("main h1")?.textContent?.trim() ?? "",
        headerHeight: Math.round(document.querySelector(".storefront-header")?.getBoundingClientRect().height ?? 0),
        columns: getComputedStyle(document.querySelector(".product-grid") ?? document.body).gridTemplateColumns,
        overflowing: [...document.querySelectorAll("main *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 5).map(el => el.tagName + "." + el.className),
      }));
      const file = name + "-" + width + ".jpg";
      await page.screenshot({ path: path.join(dest, file), type: "jpeg", quality: 76, animations: "disabled",
        style: "nextjs-portal { visibility: hidden }" });
      results.push({ name, route: new URL(page.url()).pathname, status: response?.status(), file, ...layout, errors: [...errors] });
      if (stage !== "before" && name === "home") {
        const header = page.locator(".storefront-header");
        const menu = header.getByRole("button", { name: "Mở menu danh mục" });
        await menu.click();
        if (width <= 1040) await expect(header.getByRole("dialog", { name: "Menu cửa hàng" })).toBeVisible();
        if (width === 390) await page.screenshot({ path: path.join(dest, "drawer-navigation-390.jpg"), type: "jpeg" });
        await expect(header.getByRole("link", { name: "Đơn hàng", exact: true })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(menu).toBeFocused();
        if (width <= 1040) await header.getByRole("button", { name: "Mở tìm kiếm" }).click();
        const input = header.getByRole("searchbox");
        await input.fill("QA");
        await expect(header.getByRole("list", { name: "Sản phẩm gợi ý" })).toBeVisible();
        await input.fill("");
        await page.keyboard.press("Escape");
        await header.getByRole("button", { name: /^Giỏ hàng/ }).click();
        await expect(header.locator(".cart-drawer")).toBeVisible();
        if (width === 390) await page.screenshot({ path: path.join(dest, "drawer-cart-390.jpg"), type: "jpeg" });
        await page.keyboard.press("Escape");
        await expect(header.locator(".cart-drawer")).toHaveCount(0);
        await expect(page.locator(".footer a[href^='mailto:']")).toBeVisible();
        if (width === 1440 || width === 390) {
          for (const selector of ["#san-pham-moi", "#ban-chay", "#bo-suu-tap", "#khuyen-mai", "#outfit", ".footer"]) {
            const section = page.locator(selector);
            await section.scrollIntoViewIfNeeded();
            await section.screenshot({ path: path.join(dest, "section-" + selector.slice(1) + "-" + width + ".jpg"), type: "jpeg", quality: 75 });
          }
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        }
      }
    }
    console.log(name, "captured");
  } catch (e) {
    results.push({ name, failure: String(e.message).split("\n")[0] });
    console.error(name, "capture failed");
  } finally { await context.close(); }
}
try {
  const queue = targets.slice();
  async function worker() { while (queue.length) await capture(...queue.shift()); }
  await Promise.all([worker(), worker(), worker()]);
} finally { await browser.close(); }
const manifest = path.join(dest, "layout.json");
const prior = only.length ? await readFile(manifest, "utf8").then(JSON.parse).catch(() => []) : [];
await writeFile(manifest, JSON.stringify([...prior.filter(r => !only.includes(r.name)), ...results], null, 2));
if (results.some(r => r.failure || r.status >= 400 || r.errors?.length || r.documentWidth > r.width)) process.exitCode = 1;
