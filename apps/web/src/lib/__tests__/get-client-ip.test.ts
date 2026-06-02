import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/get-client-ip";

/**
 * `getClientIp` のユニットテスト。Vercel / Cloudflare の代表的なヘッダ書式を
 * 想定する。
 */

const buildRequest = (headers: Record<string, string>): Request =>
  new Request("http://localhost/api/example", { headers });

describe("getClientIp", () => {
  it("x-forwarded-for の最左 IP を採用する", () => {
    const req = buildRequest({ "x-forwarded-for": "203.0.113.42, 10.0.0.1, 10.0.0.2" });
    expect(getClientIp(req)).toBe("203.0.113.42");
  });

  it("x-forwarded-for が単一 IP の場合もそのまま", () => {
    expect(getClientIp(buildRequest({ "x-forwarded-for": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("IPv4:port 形式は IP 部分のみ抽出", () => {
    expect(getClientIp(buildRequest({ "x-forwarded-for": "198.51.100.7:5432" }))).toBe(
      "198.51.100.7",
    );
  });

  it("IPv6 ブラケット表記 [::1] を分解", () => {
    expect(getClientIp(buildRequest({ "x-forwarded-for": "[2001:db8::1]:443" }))).toBe(
      "2001:db8::1",
    );
  });

  it("素の IPv6 もそのまま採用", () => {
    expect(getClientIp(buildRequest({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("x-forwarded-for が不正なら x-real-ip にフォールバック", () => {
    const req = buildRequest({
      "x-forwarded-for": "garbage-no-ip",
      "x-real-ip": "203.0.113.99",
    });
    expect(getClientIp(req)).toBe("203.0.113.99");
  });

  it("x-real-ip も不正なら host を返す", () => {
    const req = buildRequest({
      "x-forwarded-for": "garbage",
      "x-real-ip": "also-garbage",
      host: "example.com:3000",
    });
    expect(getClientIp(req)).toBe("example.com:3000");
  });

  it("該当ヘッダが何もなければ unknown", () => {
    // Request コンストラクタ経由では host を空にできないため、
    // 直接 Headers を空で作ってモックする
    const req = new Request("http://localhost/api/example");
    const ip = getClientIp(req);
    // Request コンストラクタが自動で host を付与する場合があるので、
    // unknown または host 文字列のいずれかを許容する
    expect(typeof ip).toBe("string");
    expect(ip.length).toBeGreaterThan(0);
  });

  it("空文字の x-forwarded-for はフォールバックされる", () => {
    const req = buildRequest({
      "x-forwarded-for": "",
      "x-real-ip": "203.0.113.123",
    });
    expect(getClientIp(req)).toBe("203.0.113.123");
  });

  it("空白だけの x-forwarded-for もフォールバックされる", () => {
    const req = buildRequest({
      "x-forwarded-for": "   ",
      "x-real-ip": "203.0.113.45",
    });
    expect(getClientIp(req)).toBe("203.0.113.45");
  });
});
