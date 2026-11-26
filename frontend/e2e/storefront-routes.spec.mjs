import { api, db, expect, test, unique } from "./helpers.mjs";

async function openNavigation(page) {
  const nav = page.getByRole("navigation", { name: "Danh mục", exact: true });
  if (!(await nav.isVisible())) await page.getByRole("button", { name: "Mở menu danh mục", exact: true }).click();
  return nav;
}

test("STOREFRONT-NAV tên nhóm chuyển trang trực tiếp và URL nhóm quyết định danh sách sản phẩm", async ({ page }, testInfo) => {
  const touch = testInfo.project.use.hasTouch;
  await page.goto("/categories/em-be");

  for (const [name, slug] of [["Nam", "nam"], ["Nữ", "nu"], ["Trẻ em", "tre-em"], ["Em bé", "em-be"]]) {
    const nav = await openNavigation(page);
    const link = nav.getByRole("link", { name, exact: true });
    if (touch) await link.tap();
    else await link.click();
    await expect(page).toHaveURL(new RegExp(`/categories/${slug}$`));
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();

    await openNavigation(page);
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    if (slug === "nam") {
      await expect(page.locator(".product-grid").getByText("QA Quần Nam", { exact: true })).toBeVisible();
      await expect(page.locator(".product-grid").getByText("QA Em Bé", { exact: true })).toHaveCount(0);
    }
  }

  await page.goto("/categories/nam?nhom=em-be");
  await expect(page.locator(".product-grid").getByText("QA Quần Nam", { exact: true })).toBeVisible();
  await expect(page.locator(".product-grid").getByText("QA Em Bé", { exact: true })).toHaveCount(0);
});

test("STOREFRONT-NAV nút danh mục con có thể mở, đóng và giữ đúng nhóm khi chọn", async ({ page }, testInfo) => {
  await page.goto("/categories/em-be");
  const nav = await openNavigation(page);
  const toggle = nav.getByRole("button", { name: "Danh mục con Nam", exact: true });
  const menu = nav.locator("#category-menu-nam");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  if (testInfo.project.use.hasTouch) await toggle.tap();
  else await toggle.click();
  await expect(page).toHaveURL(/\/categories\/em-be$/);
  await expect(nav.getByRole("link", { name: "Em bé", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await menu.getByRole("link", { name: "QA Áo", exact: true }).click();
  await expect(page).toHaveURL(/\/categories\/qa-ao\?nhom=nam$/);
  await expect(page.getByRole("heading", { name: "QA Áo", exact: true })).toBeVisible();
  await expect(page.locator(".product-grid").getByText("QA Áo 01", { exact: true })).toBeVisible();
  await expect(menu).toBeHidden();
});

test("STOREFRONT-ROUTES các nhóm cố định bị ẩn vẫn mở được và danh mục thường giữ 404", async ({ page }) => {
  const categories = db.collection("categories");
  const groups = [["tre-em", "Trẻ em"], ["em-be", "Em bé"]];
  const previous = await categories.find({ slug: { $in: groups.map(([slug]) => slug) } }).toArray();
  const hiddenSlug = unique("qa-an");
  try {
    for (const [slug, name] of groups) {
      await categories.updateOne({ slug }, { $set: { status: false }, $setOnInsert: { name } }, { upsert: true });
      expect((await api(`/categories/resolve/${slug}`)).body.data.visible).toBe(false);
      for (const href of [`/${slug}`, `/categories/${slug}`]) {
        const response = await page.goto(href);
        expect(response.status()).toBe(200);
        await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
        await expect(page.getByText("Nhóm sản phẩm này hiện chưa hiển thị.")).toBeVisible();
        await expect(page.locator(".product-card")).toHaveCount(0);
      }
    }
    await categories.insertOne({ slug: hiddenSlug, name: "Danh mục QA đã ẩn", status: false });
    expect((await page.goto(`/categories/${hiddenSlug}`)).status()).toBe(404);
    expect((await page.goto(`/categories/${unique("qa-khong-ton-tai")}`)).status()).toBe(404);
  } finally {
    for (const [slug] of groups) {
      const row = previous.find((category) => category.slug === slug);
      if (row) await categories.replaceOne({ _id: row._id }, row);
      else await categories.deleteOne({ slug });
    }
    await categories.deleteOne({ slug: hiddenSlug });
  }
});
