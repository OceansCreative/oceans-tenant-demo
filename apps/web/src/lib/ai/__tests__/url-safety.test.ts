import { describe, expect, it } from "vitest";
import {
  assertPublicIp,
  FetchSafetyError,
  fetchHtmlSafe,
  isForbiddenIpv4,
  isForbiddenIpv6,
  SsrfDeniedError,
} from "@/lib/ai/url-safety";

// ---------- isForbiddenIpv4 ----------

describe("isForbiddenIpv4", () => {
  it.each([
    ["10.0.0.1", "private"],
    ["10.255.255.254", "private"],
    ["127.0.0.1", "loopback"],
    ["127.1.2.3", "loopback"],
    ["169.254.169.254", "link-local (cloud metadata)"],
    ["169.254.0.1", "link-local (cloud metadata)"],
    ["172.16.0.1", "private"],
    ["172.31.255.254", "private"],
    ["192.168.1.1", "private"],
    ["192.0.2.1", "TEST-NET-1"],
    ["198.51.100.1", "TEST-NET-2"],
    ["203.0.113.1", "TEST-NET-3"],
    ["224.0.0.1", "multicast"],
    ["239.255.255.255", "multicast"],
    ["240.0.0.1", "reserved"],
    ["255.255.255.255", "broadcast"],
    ["100.64.0.1", "CGNAT"],
    ["0.0.0.0", "this network"],
  ])("拒否すべき IPv4: %s (%s)", (ip, reason) => {
    const result = isForbiddenIpv4(ip);
    expect(result.forbidden).toBe(true);
    expect(result.reason).toBe(reason);
  });

  it.each([
    ["8.8.8.8"],
    ["1.1.1.1"],
    ["172.32.0.1"], // 172.16-31 の外
    ["172.15.255.254"], // 172.16-31 の外
    ["100.63.255.255"], // CGNAT の外
    ["100.128.0.1"], // CGNAT の外
    ["169.255.0.1"], // 169.254 の外
    ["13.230.0.1"], // AWS Tokyo
  ])("通すべき IPv4: %s", (ip) => {
    expect(isForbiddenIpv4(ip).forbidden).toBe(false);
  });
});

// ---------- isForbiddenIpv6 ----------

describe("isForbiddenIpv6", () => {
  it.each([
    ["::1", "loopback"],
    ["::", "unspecified"],
    ["fc00::1", "ULA (private)"],
    ["fd12:3456:789a::1", "ULA (private)"],
    ["fe80::1", "link-local"],
    ["fe80::abcd", "link-local"],
    ["ff02::1", "multicast"],
    ["100::1", "discard"],
    ["2001:db8::1", "documentation"],
  ])("拒否すべき IPv6: %s (%s)", (ip, reasonContains) => {
    const result = isForbiddenIpv6(ip);
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain(reasonContains);
  });

  it("IPv4-mapped IPv6 で private を埋め込んだケース", () => {
    const result = isForbiddenIpv6("::ffff:169.254.169.254");
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain("link-local");
  });

  it.each([
    ["2606:4700:4700::1111"], // Cloudflare DNS
    ["2001:4860:4860::8888"], // Google DNS
  ])("通すべき IPv6: %s", (ip) => {
    expect(isForbiddenIpv6(ip).forbidden).toBe(false);
  });
});

// ---------- assertPublicIp ----------

describe("assertPublicIp", () => {
  it("public な IPv4 はそのまま返す", async () => {
    const ip = await assertPublicIp("example.com", {
      resolve: async () => "93.184.216.34",
    });
    expect(ip).toBe("93.184.216.34");
  });

  it("loopback (127.0.0.1) は拒否", async () => {
    await expect(assertPublicIp("localhost", { resolve: async () => "127.0.0.1" })).rejects.toThrow(
      SsrfDeniedError,
    );
  });

  it("AWS metadata 169.254.169.254 は拒否", async () => {
    await expect(
      assertPublicIp("attacker.example.com", {
        resolve: async () => "169.254.169.254",
      }),
    ).rejects.toThrow(/link-local|metadata/);
  });

  it("IP リテラルが直接来たケース", async () => {
    await expect(assertPublicIp("10.0.0.1", { resolve: async () => "10.0.0.1" })).rejects.toThrow(
      SsrfDeniedError,
    );
  });

  it("IPv6 ::1 は拒否", async () => {
    await expect(assertPublicIp("[::1]", { resolve: async () => "::1" })).rejects.toThrow(
      /loopback/,
    );
  });

  it("IPv6 角括弧の除去", async () => {
    const ip = await assertPublicIp("[2606:4700:4700::1111]", {
      resolve: async () => "2606:4700:4700::1111",
    });
    expect(ip).toBe("2606:4700:4700::1111");
  });

  it("不正なホスト名（過長）", async () => {
    await expect(
      assertPublicIp("a".repeat(254), { resolve: async () => "1.1.1.1" }),
    ).rejects.toThrow(SsrfDeniedError);
  });

  it("空ホスト名", async () => {
    await expect(assertPublicIp("", { resolve: async () => "1.1.1.1" })).rejects.toThrow(
      SsrfDeniedError,
    );
  });

  it("解決後が IP でないと拒否", async () => {
    await expect(
      assertPublicIp("weird.example.com", {
        resolve: async () => "not-an-ip",
      }),
    ).rejects.toThrow(SsrfDeniedError);
  });
});

// ---------- fetchHtmlSafe ----------

type FetchCall = {
  url: string;
  init?: RequestInit;
};

const makeMockFetch = (
  routes: Record<string, () => Response>,
): { fetchImpl: typeof globalThis.fetch; calls: FetchCall[] } => {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init: init ?? undefined });
    const handler = routes[url];
    if (!handler) {
      throw new Error(`Unexpected URL: ${url}`);
    }
    return handler();
  };
  return { fetchImpl, calls };
};

const okHtml = (body = "<html><body>hi</body></html>", headers: Record<string, string> = {}) =>
  new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html", ...headers },
  });

describe("fetchHtmlSafe", () => {
  it("public URL を正常に取得する", async () => {
    const { fetchImpl } = makeMockFetch({
      "https://example.com/page": () => okHtml("<p>example</p>"),
    });
    const result = await fetchHtmlSafe("https://example.com/page", {
      resolve: async () => "93.184.216.34",
      fetchImpl,
    });
    expect(result.status).toBe(200);
    expect(result.body).toContain("example");
    expect(result.redirected).toEqual([]);
  });

  it("private な解決後 IP を最初のホップで拒否", async () => {
    const { fetchImpl } = makeMockFetch({});
    await expect(
      fetchHtmlSafe("https://attacker.example.com/leak", {
        resolve: async () => "169.254.169.254",
        fetchImpl,
      }),
    ).rejects.toThrow(SsrfDeniedError);
  });

  it("リダイレクト先が private なら拒否", async () => {
    const { fetchImpl, calls } = makeMockFetch({
      "https://attacker.example.com/r": () =>
        new Response(null, {
          status: 302,
          headers: { Location: "http://169.254.169.254/iam-role" },
        }),
    });
    const ipMap: Record<string, string> = {
      "attacker.example.com": "93.184.216.34",
      "169.254.169.254": "169.254.169.254",
    };
    await expect(
      fetchHtmlSafe("https://attacker.example.com/r", {
        resolve: async (host) => {
          const ip = ipMap[host];
          if (!ip) throw new Error(`未定義: ${host}`);
          return ip;
        },
        fetchImpl,
      }),
    ).rejects.toThrow(SsrfDeniedError);
    expect(calls.length).toBe(1);
  });

  it("リダイレクト回数上限を超えると拒否", async () => {
    const routes: Record<string, () => Response> = {};
    for (let i = 0; i < 5; i++) {
      routes[`https://example.com/r${i}`] = () =>
        new Response(null, {
          status: 302,
          headers: { Location: `https://example.com/r${i + 1}` },
        });
    }
    routes["https://example.com/r5"] = () => okHtml("done");
    const { fetchImpl } = makeMockFetch(routes);
    await expect(
      fetchHtmlSafe("https://example.com/r0", {
        resolve: async () => "93.184.216.34",
        fetchImpl,
        maxRedirects: 2,
      }),
    ).rejects.toMatchObject({ code: "too_many_redirects" });
  });

  it("リダイレクト Location 欠落は拒否", async () => {
    const { fetchImpl } = makeMockFetch({
      "https://example.com/r": () => new Response(null, { status: 302 }),
    });
    await expect(
      fetchHtmlSafe("https://example.com/r", {
        resolve: async () => "93.184.216.34",
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "invalid_redirect" });
  });

  it("Content-Length が上限を超えていれば早期拒否", async () => {
    const { fetchImpl } = makeMockFetch({
      "https://example.com/big": () =>
        new Response("x", {
          status: 200,
          headers: {
            "Content-Type": "text/html",
            "Content-Length": String(10 * 1024 * 1024),
          },
        }),
    });
    await expect(
      fetchHtmlSafe("https://example.com/big", {
        resolve: async () => "93.184.216.34",
        fetchImpl,
        maxBytes: 5 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ code: "size_exceeded" });
  });

  it("実 body サイズが上限超過なら ストリーミング中に打ち切る", async () => {
    const big = "x".repeat(6 * 1024); // 6KB
    const { fetchImpl } = makeMockFetch({
      "https://example.com/big": () =>
        new Response(big, { status: 200, headers: { "Content-Type": "text/html" } }),
    });
    await expect(
      fetchHtmlSafe("https://example.com/big", {
        resolve: async () => "93.184.216.34",
        fetchImpl,
        maxBytes: 4 * 1024,
      }),
    ).rejects.toMatchObject({ code: "size_exceeded" });
  });

  it("正規のリダイレクトは追跡する", async () => {
    const { fetchImpl } = makeMockFetch({
      "https://example.com/old": () =>
        new Response(null, {
          status: 301,
          headers: { Location: "https://example.com/new" },
        }),
      "https://example.com/new": () => okHtml("<p>moved</p>"),
    });
    const result = await fetchHtmlSafe("https://example.com/old", {
      resolve: async () => "93.184.216.34",
      fetchImpl,
    });
    expect(result.url).toBe("https://example.com/new");
    expect(result.body).toContain("moved");
    expect(result.redirected).toEqual(["https://example.com/new"]);
  });

  it("file:/ スキームは拒否（URL コンストラクタを通過しても）", async () => {
    const { fetchImpl } = makeMockFetch({});
    await expect(
      fetchHtmlSafe("file:///etc/passwd", {
        resolve: async () => "127.0.0.1",
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(FetchSafetyError);
  });

  it("相対 Location ヘッダを絶対 URL に解決する", async () => {
    const { fetchImpl } = makeMockFetch({
      "https://example.com/a": () =>
        new Response(null, { status: 302, headers: { Location: "/b" } }),
      "https://example.com/b": () => okHtml("<p>relative</p>"),
    });
    const result = await fetchHtmlSafe("https://example.com/a", {
      resolve: async () => "93.184.216.34",
      fetchImpl,
    });
    expect(result.url).toBe("https://example.com/b");
  });
});
