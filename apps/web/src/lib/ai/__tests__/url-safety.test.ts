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
    ["172.32.0.1"],
    ["172.15.255.254"],
    ["100.63.255.255"],
    ["100.128.0.1"],
    ["169.255.0.1"],
    ["13.230.0.1"],
  ])("通すべき IPv4: %s", (ip) => {
    expect(isForbiddenIpv4(ip).forbidden).toBe(false);
  });
});

// ---------- isForbiddenIpv6 (allowlist 化後) ----------

describe("isForbiddenIpv6", () => {
  it.each([
    ["::1"],
    ["::"],
    ["fc00::1"],
    ["fd12:3456:789a::1"],
    ["fe80::1"],
    ["fe80::abcd"],
    ["ff02::1"],
    ["100::1"],
    ["0fc0::1"],
    ["2::1"],
    ["1::1"],
    ["fffe::1"],
  ])("2000::/3 外の IPv6 は拒否: %s", (ip) => {
    expect(isForbiddenIpv6(ip).forbidden).toBe(true);
  });

  it.each([
    ["2001:db8::1", "documentation"],
    ["2001:db8:cafe::beef", "documentation"],
    ["2002::1", "6to4"],
    ["2001::1", "Teredo"],
  ])("2000::/3 内の特殊用途は拒否: %s (%s)", (ip, expectedReason) => {
    const result = isForbiddenIpv6(ip);
    expect(result.forbidden).toBe(true);
    expect(result.reason).toBe(expectedReason);
  });

  it.each([
    ["2606:4700:4700::1111"],
    ["2001:4860:4860::8888"],
    ["2400:cb00::1"],
    ["3fff::1"],
  ])("公開ユニキャストは許可: %s", (ip) => {
    expect(isForbiddenIpv6(ip).forbidden).toBe(false);
  });

  it.each([
    ["::ffff:169.254.169.254"],
    ["::ffff:10.0.0.1"],
    ["::ffff:a9fe:a9fe"],
    ["::ffff:ac10:1"],
    ["::ffff:7f00:1"],
  ])("IPv4-mapped は埋め込み IPv4 を検査して private なら拒否: %s", (ip) => {
    expect(isForbiddenIpv6(ip).forbidden).toBe(true);
  });

  it("IPv4-mapped は public IPv4 を埋め込んでも自体を拒否（攻撃面最小化）", () => {
    const result = isForbiddenIpv6("::ffff:8.8.8.8");
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain("IPv4-mapped");
  });
});

describe("Teredo / Google DNS 境界", () => {
  it("2001::1 は Teredo として拒否", () => {
    expect(isForbiddenIpv6("2001::1").forbidden).toBe(true);
  });

  it("2001:4860:4860::8888 は Google DNS として許可", () => {
    expect(isForbiddenIpv6("2001:4860:4860::8888").forbidden).toBe(false);
  });
});

// ---------- assertPublicIp ----------

describe("assertPublicIp (全 A/AAAA 検証)", () => {
  it("単一の public IPv4 はそのまま返す", async () => {
    const ip = await assertPublicIp("example.com", {
      resolveAll: async () => ["93.184.216.34"],
    });
    expect(ip).toBe("93.184.216.34");
  });

  it("loopback は拒否", async () => {
    await expect(
      assertPublicIp("localhost", { resolveAll: async () => ["127.0.0.1"] }),
    ).rejects.toThrow(SsrfDeniedError);
  });

  it("AWS metadata 169.254.169.254 は拒否", async () => {
    await expect(
      assertPublicIp("attacker.example.com", {
        resolveAll: async () => ["169.254.169.254"],
      }),
    ).rejects.toThrow(/link-local|metadata/);
  });

  it("複数アドレス: public+private 混在は拒否", async () => {
    await expect(
      assertPublicIp("evil.example.com", {
        resolveAll: async () => ["93.184.216.34", "127.0.0.1"],
      }),
    ).rejects.toThrow(SsrfDeniedError);
  });

  it("複数アドレス: 全て public なら先頭を返す", async () => {
    const ip = await assertPublicIp("multi.example.com", {
      resolveAll: async () => ["93.184.216.34", "8.8.8.8"],
    });
    expect(ip).toBe("93.184.216.34");
  });

  it("解決結果が空ならエラー", async () => {
    await expect(
      assertPublicIp("ghost.example.com", { resolveAll: async () => [] }),
    ).rejects.toThrow(SsrfDeniedError);
  });

  it("IPv6 ::1 は拒否", async () => {
    await expect(assertPublicIp("[::1]", { resolveAll: async () => ["::1"] })).rejects.toThrow(
      SsrfDeniedError,
    );
  });

  it("IPv6 角括弧を除去", async () => {
    const ip = await assertPublicIp("[2606:4700:4700::1111]", {
      resolveAll: async () => ["2606:4700:4700::1111"],
    });
    expect(ip).toBe("2606:4700:4700::1111");
  });

  it("IPv6 16進 IPv4-mapped (::ffff:a9fe:a9fe) は拒否", async () => {
    await expect(
      assertPublicIp("[::ffff:a9fe:a9fe]", {
        resolveAll: async () => ["::ffff:a9fe:a9fe"],
      }),
    ).rejects.toThrow(/IPv4-mapped/);
  });

  it("ホスト名が過長だと拒否", async () => {
    await expect(
      assertPublicIp("a".repeat(254), { resolveAll: async () => ["1.1.1.1"] }),
    ).rejects.toThrow(SsrfDeniedError);
  });

  it("空ホスト名は拒否", async () => {
    await expect(assertPublicIp("", { resolveAll: async () => ["1.1.1.1"] })).rejects.toThrow(
      SsrfDeniedError,
    );
  });

  it("解決後が IP でないと拒否", async () => {
    await expect(
      assertPublicIp("weird.example.com", { resolveAll: async () => ["not-an-ip"] }),
    ).rejects.toThrow(SsrfDeniedError);
  });
});

// ---------- fetchHtmlSafe ----------

type FetchCall = { url: string; init?: RequestInit };

const makeMockFetch = (
  routes: Record<string, () => Response>,
): { fetchImpl: typeof globalThis.fetch; calls: FetchCall[] } => {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init: init ?? undefined });
    const handler = routes[url];
    if (!handler) throw new Error(`Unexpected URL: ${url}`);
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
  it("public URL を正常取得", async () => {
    const { fetchImpl } = makeMockFetch({
      "https://example.com/page": () => okHtml("<p>ok</p>"),
    });
    const result = await fetchHtmlSafe("https://example.com/page", {
      resolveAll: async () => ["93.184.216.34"],
      fetchImpl,
    });
    expect(result.status).toBe(200);
    expect(result.body).toContain("ok");
  });

  it("解決後 IP が private なら最初のホップで拒否", async () => {
    const { fetchImpl } = makeMockFetch({});
    await expect(
      fetchHtmlSafe("https://attacker.example.com/", {
        resolveAll: async () => ["169.254.169.254"],
        fetchImpl,
      }),
    ).rejects.toThrow(SsrfDeniedError);
  });

  it("複数 A レコードで public+private 混在は拒否", async () => {
    const { fetchImpl } = makeMockFetch({});
    await expect(
      fetchHtmlSafe("https://multi.example.com/", {
        resolveAll: async () => ["93.184.216.34", "10.0.0.1"],
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
        resolveAll: async (host) => {
          const ip = ipMap[host];
          if (!ip) throw new Error(`未定義: ${host}`);
          return [ip];
        },
        fetchImpl,
      }),
    ).rejects.toThrow(SsrfDeniedError);
    expect(calls.length).toBe(1);
  });

  it("リダイレクト回数上限超過は拒否", async () => {
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
        resolveAll: async () => ["93.184.216.34"],
        fetchImpl,
        maxRedirects: 2,
      }),
    ).rejects.toMatchObject({ code: "too_many_redirects" });
  });

  it("Location 欠落は拒否", async () => {
    const { fetchImpl } = makeMockFetch({
      "https://example.com/r": () => new Response(null, { status: 302 }),
    });
    await expect(
      fetchHtmlSafe("https://example.com/r", {
        resolveAll: async () => ["93.184.216.34"],
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "invalid_redirect" });
  });

  it("Content-Length 超過は早期拒否", async () => {
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
        resolveAll: async () => ["93.184.216.34"],
        fetchImpl,
        maxBytes: 5 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ code: "size_exceeded" });
  });

  it("ストリーミング中のサイズ超過も打ち切る", async () => {
    const big = "x".repeat(6 * 1024);
    const { fetchImpl } = makeMockFetch({
      "https://example.com/big": () =>
        new Response(big, { status: 200, headers: { "Content-Type": "text/html" } }),
    });
    await expect(
      fetchHtmlSafe("https://example.com/big", {
        resolveAll: async () => ["93.184.216.34"],
        fetchImpl,
        maxBytes: 4 * 1024,
      }),
    ).rejects.toMatchObject({ code: "size_exceeded" });
  });

  it("正規のリダイレクトは追跡", async () => {
    const { fetchImpl } = makeMockFetch({
      "https://example.com/old": () =>
        new Response(null, {
          status: 301,
          headers: { Location: "https://example.com/new" },
        }),
      "https://example.com/new": () => okHtml("<p>moved</p>"),
    });
    const result = await fetchHtmlSafe("https://example.com/old", {
      resolveAll: async () => ["93.184.216.34"],
      fetchImpl,
    });
    expect(result.url).toBe("https://example.com/new");
    expect(result.body).toContain("moved");
  });

  it("file:/ スキームは拒否", async () => {
    const { fetchImpl } = makeMockFetch({});
    await expect(
      fetchHtmlSafe("file:///etc/passwd", {
        resolveAll: async () => ["127.0.0.1"],
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(FetchSafetyError);
  });

  it("相対 Location を絶対 URL に解決", async () => {
    const { fetchImpl } = makeMockFetch({
      "https://example.com/a": () =>
        new Response(null, { status: 302, headers: { Location: "/b" } }),
      "https://example.com/b": () => okHtml("<p>relative</p>"),
    });
    const result = await fetchHtmlSafe("https://example.com/a", {
      resolveAll: async () => ["93.184.216.34"],
      fetchImpl,
    });
    expect(result.url).toBe("https://example.com/b");
  });
});

// ---------- DNS rebinding (TOCTOU) 遮断: Issue #63 の核心 ----------

describe("DNS rebinding (TOCTOU) 遮断", () => {
  it("validated IP が onValidatedIp で観測でき、connect も同じ IP に固定される", async () => {
    const { fetchImpl } = makeMockFetch({
      "https://example.com/page": () => okHtml("<p>ok</p>"),
    });
    const validatedIps: string[] = [];
    await fetchHtmlSafe("https://example.com/page", {
      resolveAll: async () => ["93.184.216.34"],
      fetchImpl,
      onValidatedIp: (ip) => validatedIps.push(ip),
    });
    expect(validatedIps).toEqual(["93.184.216.34"]);
  });

  it("DNS リバインディングの再現: 1 回目 public / 2 回目 private を返す resolveAll でも validate は最初の呼び出しのみ", async () => {
    let call = 0;
    const { fetchImpl } = makeMockFetch({
      "https://attacker.example.com/page": () => okHtml("<p>ok</p>"),
    });
    const validatedIps: string[] = [];
    await fetchHtmlSafe("https://attacker.example.com/page", {
      resolveAll: async () => {
        call++;
        return call === 1 ? ["93.184.216.34"] : ["169.254.169.254"];
      },
      fetchImpl,
      onValidatedIp: (ip) => validatedIps.push(ip),
    });
    // dispatcher 経由で connect は validated IP に固定。攻撃者が DNS を切り替えても無効。
    expect(validatedIps).toEqual(["93.184.216.34"]);
    // 各ホップで resolveAll が 1 回しか呼ばれない（validate 用のみ）。
    // fetch 内部の独立 DNS 解決は dispatcher により bypass される。
    expect(call).toBe(1);
  });

  it("リダイレクトの各ホップで再 validate (per-hop pinning)", async () => {
    const { fetchImpl } = makeMockFetch({
      "https://a.example.com/x": () =>
        new Response(null, {
          status: 302,
          headers: { Location: "https://b.example.com/y" },
        }),
      "https://b.example.com/y": () => okHtml("<p>ok</p>"),
    });
    const ipMap: Record<string, string> = {
      "a.example.com": "93.184.216.34",
      "b.example.com": "8.8.8.8",
    };
    const validatedIps: string[] = [];
    await fetchHtmlSafe("https://a.example.com/x", {
      resolveAll: async (host) => {
        const ip = ipMap[host];
        if (!ip) throw new Error(`未定義: ${host}`);
        return [ip];
      },
      fetchImpl,
      onValidatedIp: (ip) => validatedIps.push(ip),
    });
    expect(validatedIps).toEqual(["93.184.216.34", "8.8.8.8"]);
  });
});
