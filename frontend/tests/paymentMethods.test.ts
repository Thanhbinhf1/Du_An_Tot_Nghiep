import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaymentMethodSelector from "../components/checkout/PaymentMethodSelector";

test("configured SePay is rendered, selectable and checked at checkout", () => {
  const html = renderToStaticMarkup(createElement(PaymentMethodSelector, {
    value: "SePay", available: ["COD", "SePay"], onChange: () => {},
  }));
  const input = html.match(/<input\b[^>]*value="SePay"[^>]*>/)?.[0];
  assert.ok(input, "SePay must be rendered alongside other existing methods");
  assert.match(input, /checked/);
  assert.doesNotMatch(input, /disabled/);
  for (const method of ["COD", "BankTransfer", "MoMo"]) assert.ok(html.includes(`value="${method}"`));
  assert.ok(!html.includes('value="VNPay"'));
});

test("unconfigured SePay remains disabled", () => {
  const html = renderToStaticMarkup(createElement(PaymentMethodSelector, {
    value: "COD", available: ["COD"], onChange: () => {},
  }));
  const input = html.match(/<input\b[^>]*value="SePay"[^>]*>/)?.[0];
  assert.ok(input);
  assert.match(input, /disabled/);
});
