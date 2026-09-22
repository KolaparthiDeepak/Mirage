import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
import { lookup } from "node:dns/promises";
import { parseUpstreamUrl, isBlockedAddress, assertSafeUpstreamUrl, UpstreamError } from "./ssrf";

const lookupMock = lookup as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => lookupMock.mockReset());

describe("parseUpstreamUrl — control #1 (shape)", () => {
  it("accepts a plain https URL", () => {
    expect(parseUpstreamUrl("https://api.example.com/v1").hostname).toBe("api.example.com");
  });

  it.each([
    ["http://api.example.com"],
    ["ftp://api.example.com"],
    ["https://user:pass@api.example.com"],
    ["not a url"],
    ["https:///nohost"],
  ])("rejects %s", ([raw]) => {
    expect(() => parseUpstreamUrl(raw as string)).toThrow(UpstreamError);
  });
});

describe("isBlockedAddress — private / reserved ranges", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.9.9",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // CGNAT
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:169.254.169.254", // IPv4-mapped metadata
    "::ffff:a9fe:a9fe", // same, hex form
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"])(
    "allows public address %s",
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false);
    },
  );
});

describe("assertSafeUpstreamUrl — control #2 (resolve then check)", () => {
  it("rejects a literal private-IP host without any DNS call", async () => {
    await expect(assertSafeUpstreamUrl("https://127.0.0.1/x")).rejects.toThrow(/private or reserved/);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects 169.254.169.254 as a literal host", async () => {
    await expect(assertSafeUpstreamUrl("https://169.254.169.254/latest/meta-data/")).rejects.toThrow(UpstreamError);
  });

  it("rejects a hostname that resolves into a private range", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    await expect(assertSafeUpstreamUrl("https://sneaky.example.com")).rejects.toThrow(/private or reserved/);
  });

  it("rejects when ANY resolved address is private (dual-stack rebind)", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "::1", family: 6 },
    ]);
    await expect(assertSafeUpstreamUrl("https://mixed.example.com")).rejects.toThrow(UpstreamError);
  });

  it("rejects a hostname that does not resolve", async () => {
    // Empty result and a thrown lookup error take the same `does not resolve`
    // branch in ssrf.ts; the empty-result path is the clean one to assert on.
    lookupMock.mockResolvedValue([]);
    await expect(assertSafeUpstreamUrl("https://empty.example.com")).rejects.toThrow(/does not resolve/);
  });

  it("accepts a hostname that resolves entirely to public addresses", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const url = await assertSafeUpstreamUrl("https://example.com/v1");
    expect(url.hostname).toBe("example.com");
  });
});
