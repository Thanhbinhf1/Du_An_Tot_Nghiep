import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { getMyBackendOrders } from "../lib/order-api";

test("orders request aborts a delayed previous account while the next account loads independently", async () => {
  const old = new AbortController();
  const fetchMock = mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const authorization = (init?.headers as Record<string, string>).Authorization;
    if (authorization === "Bearer old-account") {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    }
    return Response.json({ status: "success", data: [{ _id: "new-account-order" }] });
  });
  try {
    const pending = getMyBackendOrders("old-account", old.signal);
    const rejected = assert.rejects(pending, { name: "AbortError" });
    old.abort();
    const orders = await getMyBackendOrders("new-account");
    await rejected;
    assert.equal(orders[0]?._id, "new-account-order");
  } finally { fetchMock.mock.restore(); }
});

test("orders read has a 15 second deadline even when the server never responds", async () => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  const timeoutMock = mock.method(AbortSignal, "timeout", (delay: number) => {
    assert.equal(delay, 15_000);
    return timeout(10);
  });
  const fetchMock = mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  }));
  const keepAlive = setTimeout(() => {}, 100);
  try { await assert.rejects(getMyBackendOrders("account"), { name: "TimeoutError" }); }
  finally { clearTimeout(keepAlive); fetchMock.mock.restore(); timeoutMock.mock.restore(); }
});
