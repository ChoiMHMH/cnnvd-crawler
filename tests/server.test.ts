import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import type { AliExpressProduct } from "../extension/src/types.js";

// 서버를 직접 import하지 않고 validate + save 파이프라인만 테스트한다.
// 실제 HTTP 서버 테스트는 수동 확인 범위.
import { validate } from "../src/validate.js";
import { save } from "../src/saveToJson.js";
import { ALIEXPRESS_PIPELINE } from "../src/config/pipelineConfigs.js";

const TEST_OUTPUT = path.resolve("output/test_aliexpress.json");

function makeProduct(overrides: Partial<AliExpressProduct> = {}): AliExpressProduct {
  return {
    productId: "1005006123456789",
    title: "Test Wireless Earbuds",
    price: "₩15,900",
    currency: "KRW",
    imageUrls: ["https://ae01.alicdn.com/img1.jpg"],
    attributes: [{ name: "Brand", value: "TestBrand" }],
    optionGroups: [
      {
        name: "Color",
        options: [{ name: "Black" }, { name: "White" }],
      },
    ],
    stockKeepingUnits: [],
    description: "Test product description",
    seller: { name: "TestStore", storeUrl: "https://aliexpress.com/store/12345" },
    ratings: { average: "4.8", totalReviews: "2456" },
    shipping: "Free Shipping",
    category: ["Electronics", "Audio"],
    sourceUrl: "https://www.aliexpress.com/item/1005006123456789.html",
    scrapedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("AliExpress 파이프라인 통합", () => {
  beforeEach(async () => {
    try {
      await fs.unlink(TEST_OUTPUT);
    } catch {
      // 파일이 없으면 무시
    }
  });

  afterAll(async () => {
    try {
      await fs.unlink(TEST_OUTPUT);
    } catch {
      // cleanup
    }
  });

  describe("validate", () => {
    it("필수 필드가 있으면 통과한다", () => {
      const product = makeProduct();
      const result = validate([product], {
        requiredFields: ALIEXPRESS_PIPELINE.requiredFields,
      });
      expect(result).toHaveLength(1);
    });

    it("productId가 없으면 탈락한다", () => {
      const product = makeProduct({ productId: "" });
      const result = validate([product], {
        requiredFields: ALIEXPRESS_PIPELINE.requiredFields,
      });
      expect(result).toHaveLength(0);
    });

    it("title이 없으면 탈락한다", () => {
      const product = makeProduct({ title: "" });
      const result = validate([product], {
        requiredFields: ALIEXPRESS_PIPELINE.requiredFields,
      });
      expect(result).toHaveLength(0);
    });

    it("price가 없으면 탈락한다", () => {
      const product = makeProduct({ price: "" });
      const result = validate([product], {
        requiredFields: ALIEXPRESS_PIPELINE.requiredFields,
      });
      expect(result).toHaveLength(0);
    });
  });

  describe("save", () => {
    it("상품을 JSON 파일로 저장한다", async () => {
      const product = makeProduct();
      await save([product], TEST_OUTPUT, {
        dedupKey: ALIEXPRESS_PIPELINE.dedupKey,
      });

      const raw = await fs.readFile(TEST_OUTPUT, "utf-8");
      const data = JSON.parse(raw);
      expect(data).toHaveLength(1);
      expect(data[0].productId).toBe("1005006123456789");
      expect(data[0].savedAt).toBeDefined();
    });

    it("동일 productId는 중복 저장하지 않는다", async () => {
      const product = makeProduct();
      await save([product], TEST_OUTPUT, {
        dedupKey: ALIEXPRESS_PIPELINE.dedupKey,
      });
      await save([product], TEST_OUTPUT, {
        dedupKey: ALIEXPRESS_PIPELINE.dedupKey,
      });

      const raw = await fs.readFile(TEST_OUTPUT, "utf-8");
      const data = JSON.parse(raw);
      expect(data).toHaveLength(1);
    });

    it("다른 productId는 추가 저장한다", async () => {
      const product1 = makeProduct({ productId: "100001" });
      const product2 = makeProduct({ productId: "100002", title: "Product 2" });

      await save([product1], TEST_OUTPUT, {
        dedupKey: ALIEXPRESS_PIPELINE.dedupKey,
      });
      await save([product2], TEST_OUTPUT, {
        dedupKey: ALIEXPRESS_PIPELINE.dedupKey,
      });

      const raw = await fs.readFile(TEST_OUTPUT, "utf-8");
      const data = JSON.parse(raw);
      expect(data).toHaveLength(2);
    });
  });

  describe("validate → save 연쇄 실행", () => {
    it("정상 상품은 검증 후 저장된다", async () => {
      const product = makeProduct();
      const validated = validate([product], {
        requiredFields: ALIEXPRESS_PIPELINE.requiredFields,
      });

      await save(validated, TEST_OUTPUT, {
        dedupKey: ALIEXPRESS_PIPELINE.dedupKey,
      });

      const raw = await fs.readFile(TEST_OUTPUT, "utf-8");
      const data = JSON.parse(raw);
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe("Test Wireless Earbuds");
    });

    it("필수 필드 누락 상품은 검증에서 걸러져 저장되지 않는다", async () => {
      const good = makeProduct({ productId: "good1" });
      const bad = makeProduct({ productId: "", title: "" });

      const validated = validate([good, bad], {
        requiredFields: ALIEXPRESS_PIPELINE.requiredFields,
      });

      await save(validated, TEST_OUTPUT, {
        dedupKey: ALIEXPRESS_PIPELINE.dedupKey,
      });

      const raw = await fs.readFile(TEST_OUTPUT, "utf-8");
      const data = JSON.parse(raw);
      expect(data).toHaveLength(1);
      expect(data[0].productId).toBe("good1");
    });
  });
});
