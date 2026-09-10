// Plan 07, control #1 and #2 — the SSRF gate.
//
// Server-side fetch to a user-supplied URL is the single largest risk in the
// whole roadmap. This module is the only thing between `upstream.url` and a
// real socket. It is deliberately small and has no dependencies beyond
// node:net / node:dns so it is easy to audit.
//
// Residual risk: there is a TOCTOU window between our dns.lookup here and
// fetch()'s own internal resolution. Manual-redirect (control #3, in
// forward.ts) closes the classic rebinding path; the remaining sliver would
// need a pinned-IP undici dispatcher to close fully.
// ponytail: dns.lookup + manual-redirect per plan; pin the resolved IP into
// the connection if drift is ever observed.
import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";

export class UpstreamError extends Error {}

/** RFC 1918 / 6598 / loopback / link-local / ULA / multicast / unspecified.
 *  169.254.0.0/16 covers the cloud metadata endpoint (169.254.169.254). */
const blocked = new BlockList();
blocked.addSubnet("0.0.0.0", 8, "ipv4"); // "this host"
blocked.addSubnet("10.0.0.0", 8, "ipv4");
blocked.addSubnet("100.64.0.0", 10, "ipv4"); // carrier-grade NAT
blocked.addSubnet("127.0.0.0", 8, "ipv4"); // loopback
blocked.addSubnet("169.254.0.0", 16, "ipv4"); // link-local + metadata
blocked.addSubnet("172.16.0.0", 12, "ipv4");
blocked.addSubnet("192.0.0.0", 24, "ipv4"); // IETF protocol assignments
blocked.addSubnet("192.168.0.0", 16, "ipv4");
blocked.addSubnet("198.18.0.0", 15, "ipv4"); // benchmarking
blocked.addSubnet("224.0.0.0", 4, "ipv4"); // multicast
blocked.addSubnet("240.0.0.0", 4, "ipv4"); // reserved / broadcast
blocked.addAddress("::", "ipv6"); // unspecified
blocked.addAddress("::1", "ipv6"); // loopback
blocked.addSubnet("fc00::", 7, "ipv6"); // unique-local
blocked.addSubnet("fe80::", 10, "ipv6"); // link-local
blocked.addSubnet("ff00::", 8, "ipv6"); // multicast

/** IPv4-mapped IPv6, e.g. "::ffff:169.254.169.254" or "::ffff:a9fe:a9fe". */
function mappedV4(addr: string): string | null {
  const dotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(addr);
  if (dotted) return dotted[1]!;
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(addr);
  if (hex) {
    const hi = parseInt(hex[1]!, 16);
    const lo = parseInt(hex[2]!, 16);
    return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
  }
  return null;
}

/** true = this literal IP address must not be connected to. */
export function isBlockedAddress(addr: string): boolean {
  const asV4 = mappedV4(addr);
  if (asV4) return isBlockedAddress(asV4);
  const family = isIP(addr);
  if (family === 0) return true; // not an IP we can reason about → refuse
  return blocked.check(addr, family === 4 ? "ipv4" : "ipv6");
}

/** Control #1: shape check, synchronous, safe to run at save time. */
export function parseUpstreamUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UpstreamError("upstream URL is not a valid URL");
  }
  if (url.protocol !== "https:") throw new UpstreamError("upstream URL must be https://");
  if (!url.hostname) throw new UpstreamError("upstream URL must have a hostname");
  // A userinfo component (user:pass@host) is a common SSRF-filter bypass trick.
  if (url.username || url.password) throw new UpstreamError("upstream URL must not contain credentials");
  return url;
}

/** Control #2: resolve the hostname and reject if ANY resolved address is
 *  private/reserved. Run at save time AND immediately before every forward
 *  (the forward-time call is the DNS-rebinding defense). */
export async function assertSafeUpstreamUrl(raw: string): Promise<URL> {
  const url = parseUpstreamUrl(raw);

  // A literal IP host: check it directly, no DNS.
  if (isIP(url.hostname) !== 0) {
    if (isBlockedAddress(url.hostname)) {
      throw new UpstreamError(`upstream host ${url.hostname} is a private or reserved address`);
    }
    return url;
  }

  let addrs: Array<{ address: string }>;
  try {
    addrs = await lookup(url.hostname, { all: true });
  } catch {
    throw new UpstreamError(`upstream host ${url.hostname} does not resolve`);
  }
  if (addrs.length === 0) throw new UpstreamError(`upstream host ${url.hostname} does not resolve`);
  for (const { address } of addrs) {
    if (isBlockedAddress(address)) {
      throw new UpstreamError(
        `upstream host ${url.hostname} resolves to a private or reserved address (${address})`,
      );
    }
  }
  return url;
}
