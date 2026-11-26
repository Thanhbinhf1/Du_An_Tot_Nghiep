import assert from "node:assert/strict";
import { test } from "node:test";
import User from "../src/models/userModel.js";
import { AuthService } from "../src/services/authService.js";
import authRoutes from "../src/routes/authRoutes.js";

test("tsx loads current auth schema and password recovery handlers", () => {
  assert.ok(User.schema.path("session_version"));
  assert.ok(User.schema.path("wishlist"));
  assert.equal(typeof AuthService.changePassword, "function");
  const paths = authRoutes.stack.map((layer) => layer.route?.path);
  for (const path of ["/forgot-password", "/reset-password", "/google", "/password"]) {
    assert.ok(paths.includes(path), `Missing current route: ${path}`);
  }
});
