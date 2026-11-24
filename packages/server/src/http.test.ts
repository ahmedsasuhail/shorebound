import { describe, expect, it } from "vitest";
import { timedFetch } from "./http.js";

describe("timedFetch", () => {
  it("aborts a request that takes longer than the timeout", async () => {
    const hanging = ((_: unknown, init?: RequestInit) =>
      new Promise((_r, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)),
      )) as typeof fetch;
    await expect(timedFetch(20, hanging)("https://example.invalid")).rejects.toThrow();
  });

  it("keeps a caller-provided signal", async () => {
    const own = new AbortController();
    let seen: AbortSignal | undefined;
    const spy = (async (_: unknown, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return new Response("ok");
    }) as typeof fetch;
    await timedFetch(20, spy)("https://example.invalid", { signal: own.signal });
    expect(seen).toBe(own.signal);
  });
});
