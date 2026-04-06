import "dotenv/config";
import CnnvdCrawler from "./src/crawlers/CnnvdCrawler.mjs";
import { validate } from "./src/validate.js";
import { translate } from "./src/translate.js";
import { save } from "./src/saveToJson.js";

/**
 * 크롤링 파이프라인 진입점
 * 수집 → 검증 → 번역 → 저장 순서로 실행됩니다.
 */
async function main() {
  console.log("[pipeline] 크롤링 시작");

  const crawler = new CnnvdCrawler();
  const rawData = await crawler.run();
  console.log(`[pipeline] 수집 완료 — ${rawData.length}건`);

  const validated = validate(rawData);
  console.log(`[pipeline] 검증 완료 — ${validated.length}건`);

  const translated = await translate(validated);
  console.log(`[pipeline] 번역 완료 — ${translated.length}건`);

  await save(translated);
  console.log("[pipeline] 파이프라인 완료");
}

main().catch((error) => {
  console.error("[pipeline] 치명적 오류:", error);
  process.exit(1);
});
