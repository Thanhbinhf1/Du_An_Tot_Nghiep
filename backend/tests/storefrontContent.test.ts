import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { StorefrontContentController } from "../src/controllers/storefrontContentController.js";
import Setting from "../src/models/settingModel.js";
import { AppError } from "../src/middlewares/AppError.js";

const hero = {
  title: "Bộ sưu tập mùa mới", accent: "", description: "Khám phá áo khoác mới.",
  ctaLabel: "Xem sản phẩm", ctaHref: "/products?sort=newest", image: "/images/banner/fstyle-editorial.webp",
};

async function publish(body: unknown) {
  let result: unknown;
  let failure: unknown;
  const response = { json(value: unknown) { result = value; } } as Response;
  await StorefrontContentController.publishHero({ body } as Request, response, (error?: unknown) => { failure = error; });
  return { result, failure };
}

test("publishing homepage content updates the requested revision and returns the next one", async (context) => {
  const write = context.mock.method(Setting, "findOneAndUpdate", () => Promise.resolve({}));
  const response = await publish({ revision: 4, hero });
  assert.deepEqual(response.result, { status: "success", data: { revision: 5, hero } });
  const call = write.mock.calls[0];
  assert.ok(call);
  const [filter, update, options] = call.arguments as unknown[];
  assert.deepEqual(filter, { key: "storefront_home_hero", "value.revision": 4 });
  assert.deepEqual(update, { $set: { value: { revision: 5, hero } } });
  assert.deepEqual(options, { upsert: false, returnDocument: "after" });
});

test("publishing rejects invalid targets before any write", async (context) => {
  const write = context.mock.method(Setting, "findOneAndUpdate", () => Promise.resolve({}));
  for (const invalidHero of [
    { ...hero, ctaHref: "https://external.example/" },
    { ...hero, ctaHref: "//external.example/" },
    { ...hero, image: "/images/banner/../other.webp" },
  ]) {
    const response = await publish({ revision: 0, hero: invalidHero });
    assert.ok(response.failure instanceof AppError);
    assert.equal(response.failure.statusCode, 400);
  }
  assert.equal(write.mock.callCount(), 0);
});

test("a stale banner revision cannot overwrite another editor’s update", async (context) => {
  context.mock.method(Setting, "findOneAndUpdate", () => Promise.resolve(null));
  const response = await publish({ revision: 2, hero: null });
  assert.ok(response.failure instanceof AppError);
  assert.equal(response.failure.statusCode, 409);
});
