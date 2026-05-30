import { Readability } from "@mozilla/readability";
import { load as cheerioLoad } from "cheerio";
import { JSDOM } from "jsdom";

/**
 * 物件掲載ページ HTML から本文を抽出する。
 *
 * - Mozilla Readability で記事本文を取得
 * - 失敗時は Cheerio で <main> / <body> を fallback
 * - script / style / nav / footer は常に除去
 */

export type ExtractedContent = {
  readonly title: string;
  readonly textContent: string;
  readonly byline?: string;
};

const DROP_SELECTORS = ["script", "style", "noscript", "nav", "footer", "iframe"];

export const extractReadableContent = (html: string, url: string): ExtractedContent => {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const parsed = reader.parse();

  if (parsed?.textContent && parsed.textContent.length > 200) {
    return {
      title: parsed.title ?? "",
      textContent: parsed.textContent.trim(),
      ...(parsed.byline ? { byline: parsed.byline } : {}),
    };
  }

  const $ = cheerioLoad(html);
  for (const selector of DROP_SELECTORS) {
    $(selector).remove();
  }
  const body = $("main, article, body").first().text().trim();
  return {
    title: $("title").text().trim() || $("h1").first().text().trim() || "",
    textContent: body.replace(/\s+/g, " "),
  };
};

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

export const isValidIngestUrl = (input: string): boolean => {
  if (!URL_PATTERN.test(input)) return false;
  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};
