/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

// parser.ts는 document를 직접 사용하므로 jsdom 환경에서 테스트한다.
// 단, parser는 extension/src에 있으므로 상대 경로로 import 한다.
import { parseProductPage } from "../extension/src/parser.js";

const FIXTURE_PATH = path.resolve(__dirname, "fixtures/aliexpress-product.html");

describe("AliExpress parser", () => {
  beforeAll(() => {
    const html = fs.readFileSync(FIXTURE_PATH, "utf-8");
    document.documentElement.innerHTML = html;

    // jsdom에서 location을 AliExpress URL로 설정
    Object.defineProperty(window, "location", {
      value: new URL("https://www.aliexpress.com/item/1005006123456789.html"),
      writable: true,
    });
  });

  describe("productId 추출", () => {
    it("URL pathname에서 productId를 추출한다", () => {
      const product = parseProductPage();
      expect(product.productId).toBe("1005006123456789");
    });
  });

  describe("title 추출", () => {
    it("h1[data-pl='product-title']에서 제목을 추출한다", () => {
      const product = parseProductPage();
      expect(product.title).toBe("Test Product - Wireless Bluetooth Earbuds");
    });
  });

  describe("가격 정보 추출", () => {
    it("현재 가격을 추출한다", () => {
      const product = parseProductPage();
      expect(product.price).toBe("₩15,900");
    });

    it("원래 가격을 추출한다", () => {
      const product = parseProductPage();
      expect(product.originalPrice).toBe("₩29,900");
    });

    it("할인율을 추출한다", () => {
      const product = parseProductPage();
      expect(product.discount).toBe("-47%");
    });

    it("통화를 감지한다", () => {
      const product = parseProductPage();
      expect(product.currency).toBe("KRW");
    });
  });

  describe("이미지 추출", () => {
    it("이미지 URL 목록을 추출한다", () => {
      const product = parseProductPage();
      expect(product.imageUrls).toHaveLength(3);
      expect(product.imageUrls[0]).toContain("alicdn.com");
    });

    it("중복 이미지를 제거한다", () => {
      const product = parseProductPage();
      const unique = new Set(product.imageUrls);
      expect(unique.size).toBe(product.imageUrls.length);
    });
  });

  describe("옵션 그룹 추출", () => {
    it("옵션 그룹을 추출한다", () => {
      const product = parseProductPage();
      expect(product.optionGroups).toHaveLength(2);
    });

    it("Color 그룹의 이름과 옵션을 추출한다", () => {
      const product = parseProductPage();
      const colorGroup = product.optionGroups[0];
      expect(colorGroup.name).toBe("Color");
      expect(colorGroup.options).toHaveLength(2);
      expect(colorGroup.options[0].name).toBe("Black");
      expect(colorGroup.options[0].imageUrl).toContain("color-black");
    });

    it("Size 그룹의 이름과 옵션을 추출한다", () => {
      const product = parseProductPage();
      const sizeGroup = product.optionGroups[1];
      expect(sizeGroup.name).toBe("Size");
      expect(sizeGroup.options).toHaveLength(3);
      expect(sizeGroup.options.map((o) => o.name)).toEqual(["S", "M", "L"]);
    });
  });

  describe("속성 추출", () => {
    it("상품 속성을 추출한다", () => {
      const product = parseProductPage();
      expect(product.attributes).toHaveLength(3);
    });

    it("속성 이름-값 쌍이 올바르다", () => {
      const product = parseProductPage();
      expect(product.attributes[0]).toEqual({ name: "Brand", value: "TestBrand" });
      expect(product.attributes[1]).toEqual({ name: "Material", value: "ABS Plastic" });
      expect(product.attributes[2]).toEqual({ name: "Battery", value: "300mAh" });
    });
  });

  describe("판매자 정보 추출", () => {
    it("판매자 이름을 추출한다", () => {
      const product = parseProductPage();
      expect(product.seller.name).toBe("TestStore Official");
    });

    it("스토어 URL을 추출한다", () => {
      const product = parseProductPage();
      expect(product.seller.storeUrl).toContain("/store/12345");
    });
  });

  describe("평점 정보 추출", () => {
    it("평균 평점을 추출한다", () => {
      const product = parseProductPage();
      expect(product.ratings.average).toBe("4.8");
    });

    it("리뷰 수를 추출한다", () => {
      const product = parseProductPage();
      expect(product.ratings.totalReviews).toBe("2456");
    });

    it("판매 수를 추출한다", () => {
      const product = parseProductPage();
      expect(product.ratings.totalOrders).toBe("5,000+ sold");
    });
  });

  describe("배송 정보 추출", () => {
    it("배송 정보를 추출한다", () => {
      const product = parseProductPage();
      expect(product.shipping).toBe("Free Shipping to South Korea");
    });
  });

  describe("카테고리 추출", () => {
    it("breadcrumb에서 카테고리를 추출한다", () => {
      const product = parseProductPage();
      expect(product.category).toEqual(["Electronics", "Audio", "Earphones"]);
    });
  });

  describe("설명 추출", () => {
    it("상품 설명을 추출한다", () => {
      const product = parseProductPage();
      expect(product.description).toContain("wireless bluetooth earbuds");
    });
  });

  describe("메타데이터", () => {
    it("sourceUrl을 포함한다", () => {
      const product = parseProductPage();
      expect(product.sourceUrl).toContain("aliexpress.com/item/1005006123456789");
    });

    it("scrapedAt에 ISO 타임스탬프를 포함한다", () => {
      const product = parseProductPage();
      expect(product.scrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("stockKeepingUnits는 빈 배열이다 (PoC 범위 외)", () => {
      const product = parseProductPage();
      expect(product.stockKeepingUnits).toEqual([]);
    });
  });
});
