import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import mongoose from "mongoose";
import type { Request, Response } from "express";
import { getProductById } from "../src/controllers/productController.js";
import Product from "../src/models/productModel.js";
import Image from "../src/models/productImageModel.js";
import Variant from "../src/models/productVariantModel.js";
import Comment from "../src/models/productCommentModel.js";

afterEach(() => mock.restoreAll());
test("product detail supplies the same audience metadata required by outfit recommendations", async () => {
  const id = new mongoose.Types.ObjectId();
  let gender = "Nam";
  const query = { populate: () => query, lean: async () => ({ _id: id, gender }) };
  mock.method(Product, "findOne", () => query);
  for (const model of [Image, Variant]) mock.method(model, "find", () => ({ sort: () => ({ lean: async () => [] }) }));
  mock.method(Comment, "aggregate", async () => []);
  for (const [value, audiences] of [["Nam", ["nam"]], ["Nữ", ["nu"]], ["Em bé", ["em-be", "tre-em"]], ["Unisex", ["nam", "nu"]]]) {
    gender = value as string;
    let body: { data?: { audiences: string[] } } = {};
    const response = { status: () => response, json: (value: typeof body) => { body = value; return response; } } as unknown as Response;
    await getProductById({ params: { id: String(id) } } as unknown as Request, response, (error?: unknown) => { if (error) throw error; });
    assert.deepEqual(body.data?.audiences, audiences);
  }
});
