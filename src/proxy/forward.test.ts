import { describe, it, expect, vi, afterEach } from "vitest";
import { forwardToUpstream } from "./forward";

afterEach(() => vi.unstubAllGlobals());

type FetchImpl = (url: URL | string, opts: RequestInit & { headers: Headers }) => Promise<Response>;
const fetchImpl = (impl: () => Promise<Response>) => vi.fn<FetchImpl>(impl as unknown as FetchImpl);

function streamOf(bytes: Uint8Array, chunk = 64 * 1024): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.subarray(offset, offset + chunk));
      offset += chunk;
    },
  });
}

function fakeResponse(init: {
  status?: number;
  headers?: Record<string, string>;
  body?: Uint8Array;
}): Response {
  const headers = new Headers(init.headers ?? {});
  const body = init.body ? streamOf(init.body) : null;
  return { status: init.status ?? 200, headers, body } as unknown as Response;
}

describe("forwardToUpstream", () => {
  it("forwards method + body, strips hop-by-hop / host / authorization by default", async () => {
    const fetchMock = fetchImpl(async () => fakeResponse({ body: new TextEncoder().encode("ok") }));
    vi.stubGlobal("fetch", fetchMock);

    await forwardToUpstream({
      targetUrl: new URL("https://api.example.com/v1/users"),
      method: "POST",
      reqHeaders: {
        host: "mirage.app",
        connection: "keep-alive",
        authorization: "Bearer secret",
        "content-type": "application/json",
        "x-trace": "abc",
      },
      body: '{"a":1}',
      forwardAuth: false,
      timeoutMs: 5000,
    });

    const [url, opts] = fetchMock.mock.calls[0]!;
    expect((url as URL).href).toBe("https://api.example.com/v1/users");
    expect((opts as RequestInit).method).toBe("POST");
    expect((opts as RequestInit).redirect).toBe("manual");
    const sent = (opts as { headers: Headers }).headers;
    expect(sent.get("host")).toBeNull();
    expect(sent.get("connection")).toBeNull();
    expect(sent.get("authorization")).toBeNull();
    expect(sent.get("content-type")).toBe("application/json");
    expect(sent.get("x-trace")).toBe("abc");
  });

  it("forwards Authorization when forwardAuth is true", async () => {
    const fetchMock = fetchImpl(async () => fakeResponse({ body: new Uint8Array() }));
    vi.stubGlobal("fetch", fetchMock);
    await forwardToUpstream({
      targetUrl: new URL("https://api.example.com/"),
      method: "GET",
      reqHeaders: { authorization: "Bearer secret" },
      body: null,
      forwardAuth: true,
      timeoutMs: 5000,
    });
    expect((fetchMock.mock.calls[0]![1] as { headers: Headers }).headers.get("authorization")).toBe("Bearer secret");
  });

  it("returns a 3xx as-is without following it (control #3)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fakeResponse({ status: 302, headers: { location: "https://169.254.169.254/" } }),
      ),
    );
    const res = await forwardToUpstream({
      targetUrl: new URL("https://api.example.com/redir"),
      method: "GET",
      reqHeaders: {},
      body: null,
      forwardAuth: false,
      timeoutMs: 5000,
    });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://169.254.169.254/");
  });

  it("caps the response body at 5 MB and flags it truncated (control #4)", async () => {
    const big = new Uint8Array(6 * 1024 * 1024).fill(65); // 6 MB of "A"
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse({ body: big })));
    const res = await forwardToUpstream({
      targetUrl: new URL("https://api.example.com/big"),
      method: "GET",
      reqHeaders: {},
      body: null,
      forwardAuth: false,
      timeoutMs: 5000,
    });
    expect(res.truncated).toBe(true);
    expect(Buffer.byteLength(res.bodyText ?? "", "utf8")).toBeLessThanOrEqual(5 * 1024 * 1024);
  });

  it("strips content-encoding / content-length from the returned headers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fakeResponse({
          headers: { "content-encoding": "gzip", "content-length": "999", "content-type": "text/plain" },
          body: new TextEncoder().encode("hi"),
        }),
      ),
    );
    const res = await forwardToUpstream({
      targetUrl: new URL("https://api.example.com/"),
      method: "GET",
      reqHeaders: {},
      body: null,
      forwardAuth: false,
      timeoutMs: 5000,
    });
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.headers["content-length"]).toBeUndefined();
    expect(res.headers["content-type"]).toBe("text/plain");
  });

  it("times out and returns a synthesised 504 (control #4)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: unknown, opts: RequestInit) => {
        return new Promise((_resolve, reject) => {
          (opts.signal as AbortSignal).addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }),
    );
    const res = await forwardToUpstream({
      targetUrl: new URL("https://api.example.com/slow"),
      method: "GET",
      reqHeaders: {},
      body: null,
      forwardAuth: false,
      timeoutMs: 20, // hard cap is 5000; a tiny value keeps the test fast
    });
    expect(res.status).toBe(504);
    expect(res.error).toBe("timeout");
  });
});
