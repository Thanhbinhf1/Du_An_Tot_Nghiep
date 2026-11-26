import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AdminPagination, { adminListPath } from "../app/admin/AdminPagination";

test("admin queries preserve filters and paging without sending the all sentinel", () => {
  const url = new URL(adminListPath("/admin/orders", { page: 9, limit: 25, status: "all", search: "a+b@example.invalid" }), "https://audit.invalid");
  assert.equal(url.searchParams.get("page"), "9"); assert.equal(url.searchParams.get("limit"), "25");
  assert.equal(url.searchParams.has("status"), false); assert.equal(url.searchParams.get("search"), "a+b@example.invalid");
});

test("admin pagination exposes older pages and respects the last page boundary", () => {
  const html = renderToStaticMarkup(createElement(AdminPagination, {
    page: 8, pagination: { totalPages: 9, total: 225 }, loading: false, onPage: () => {},
  }));
  assert.match(html, /225/); assert.doesNotMatch(html, /disabled/);
  const last = renderToStaticMarkup(createElement(AdminPagination, {
    page: 9, pagination: { totalPages: 9, total: 225 }, loading: false, onPage: () => {},
  }));
  assert.match(last, /disabled="">Trang sau/);
});
