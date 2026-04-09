import BooksCrawler from "./src/crawlers/BooksCrawler.mjs";
import { validate } from "./src/validate.js";
import { save } from "./src/saveToJson.js";

const BOOKS_REQUIRED_FIELDS = [
  { field: "title", check: "string" },
  { field: "price", check: "string" },
  { field: "upc", check: "string" },
];

/**
 * books.toscrape.com 크롤링 파이프라인 진입점
 * 수집 → 검증 → 저장 순서로 실행됩니다.
 * (번역 단계 없음 — 영문 사이트이므로 불필요)
 */
async function main() {
  console.log("[pipeline:books] 크롤링 시작");

  const crawler = new BooksCrawler();
  const rawData = await crawler.run();
  console.log(`[pipeline:books] 수집 완료 — ${rawData.length}건`);

  const validated = validate(rawData, { requiredFields: BOOKS_REQUIRED_FIELDS });
  console.log(`[pipeline:books] 검증 완료 — ${validated.length}건`);

  await save(validated, "output/books_result.json", {
    dedupKey: (item) => item.upc,
  });
  console.log("[pipeline:books] 파이프라인 완료");
}

main().catch((error) => {
  console.error("[pipeline:books] 치명적 오류:", error);
  process.exit(1);
});
