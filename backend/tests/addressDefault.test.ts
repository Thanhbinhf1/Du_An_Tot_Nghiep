import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Response } from "express";
import mongoose, { type ClientSession } from "mongoose";
import { AddressController } from "../src/controllers/addressController.js";
import type { AuthRequest } from "../src/middlewares/authMiddleware.js";
import Address from "../src/models/addressModel.js";
import User from "../src/models/userModel.js";

afterEach(() => mock.restoreAll());

test("selecting the current default address again keeps it selected", async () => {
  const uid = new mongoose.Types.ObjectId();
  const id = new mongoose.Types.ObjectId();
  const session = {} as ClientSession;
  const stored = { is_default: true };
  mock.method(User, "updateOne", async () => ({ matchedCount: 1 }));
  mock.method(mongoose.connection, "transaction", async (run: (value: ClientSession) => Promise<unknown>) => run(session));
  mock.method(Address, "findOne", async () => ({ is_default: stored.is_default, async save() { return this; } }));
  mock.method(Address, "updateMany", async (filter: { _id?: { $ne: string }; user_id: unknown }) => {
    assert.equal(String(filter.user_id), String(uid));
    if (String(filter._id?.$ne) !== String(id)) stored.is_default = false;
  });
  mock.method(Address, "findOneAndUpdate", async (filter: { _id: string; user_id: unknown }, update: { $set: { is_default: boolean } }, options: { session: ClientSession }) => {
    assert.equal(String(filter._id), String(id));
    assert.equal(String(filter.user_id), String(uid));
    assert.equal(options.session, session);
    return Object.assign(stored, update.$set);
  });
  let error: unknown;
  const res = { status() { return this; }, json() { return this; } } as unknown as Response;
  await AddressController.setDefaultAddress({
    user: { _id: uid }, params: { id: String(id) },
  } as unknown as AuthRequest, res, (cause?: unknown) => { error = cause; });
  assert.equal(error, undefined);
  assert.equal(stored.is_default, true);
});
