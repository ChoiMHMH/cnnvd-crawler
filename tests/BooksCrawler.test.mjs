import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import BooksCrawler from "../src/crawlers/BooksCrawler.mjs";

/**
 * BooksCrawler 통합 테스트
 * books.toscrape.com에 실제 접속하여 extractList / extractDetail을 검증합니다.
 * 네트워크 의존적이므로 CI에서는 필요 시 스킵할 수 있습니다.
 */

let crawler;

beforeAll(async () => {
  crawler = new BooksCrawler();
  await crawler.launch();
}, 30000);

afterAll(async () => {
  await crawler.close();
});

describe("BooksCrawler.extractList", () => {
  it("목록 페이지에서 20건의 책을 추출한다", async () => {
    await crawler.navigate("https://books.toscrape.com/", "article.product_pod");
    const list = await crawler.extractList();

    expect(list).toHaveLength(20);
  }, 30000);

  it("각 항목에 title, price, rating, detailUrl이 있다", async () => {
    await crawler.navigate("https://books.toscrape.com/", "article.product_pod");
    const list = await crawler.extractList();
    const first = list[0];

    expect(first.title).toBeTruthy();
    expect(first.price).toMatch(/^£\d+\.\d{2}$/);
    expect(first.rating).toBeGreaterThanOrEqual(1);
    expect(first.rating).toBeLessThanOrEqual(5);
    expect(first.detailUrl).toContain("/catalogue/");
  }, 30000);
});

describe("BooksCrawler.extractDetail", () => {
  it("상세 페이지에서 책 데이터를 추출한다", async () => {
    await crawler.navigate(
      "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
      ".product_main h1",
    );
    const detail = await crawler.extractDetail();

    expect(detail.title).toBe("A Light in the Attic");
    expect(detail.price).toBe("£51.77");
    expect(detail.availability).toContain("In stock");
    expect(detail.rating).toBe(3);
    expect(detail.description).toBeTruthy();
    expect(detail.category).toBe("Poetry");
    expect(detail.upc).toBe("a897fe39b1053632");
    expect(detail.stockCount).toBe("22");
  }, 30000);
});

describe("BooksCrawler.getNextPageUrl", () => {
  it("1페이지에서 다음 페이지 URL을 반환한다", async () => {
    await crawler.navigate("https://books.toscrape.com/", "article.product_pod");
    const nextUrl = await crawler.getNextPageUrl();

    expect(nextUrl).toContain("page-2");
  }, 30000);
});

describe("validate with custom requiredFields", () => {
  it("BooksCrawler 데이터가 커스텀 필수 필드 검증을 통과한다", async () => {
    // validate 모듈 임포트
    const { validate } = await import("../src/validate.js");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const bookFields = [
      { field: "title", check: "string" },
      { field: "price", check: "string" },
      { field: "upc", check: "string" },
    ];

    const items = [
      { title: "Test Book", price: "£10.00", upc: "abc123" },
      { title: "", price: "£10.00", upc: "abc456" }, // title 빈 값 → 실패
    ];

    const result = validate(items, { requiredFields: bookFields });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Test Book");
  });
});
