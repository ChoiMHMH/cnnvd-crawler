import { validate } from "../validate.js";
import { translate } from "../translate.js";
import { save } from "../saveToJson.js";

/**
 * 크롤러 파이프라인을 공통으로 실행합니다.
 * 수집 → 검증 → (번역) → 저장 순서로 진행됩니다.
 * @param {Object} config
 * @param {Object} config.crawler - run()을 구현한 크롤러 인스턴스
 * @param {Array<{field: string, check: string}>} [config.requiredFields] - 검증 필수 필드
 * @param {string} config.outputPath - 저장 경로
 * @param {Function} [config.dedupKey] - 중복 판별 키 함수
 * @param {boolean} [config.useTranslate=false] - 번역 사용 여부
 */
export async function runCrawlerPipeline({
  crawler,
  requiredFields,
  outputPath,
  dedupKey,
  useTranslate = false,
}) {
  const label = crawler.constructor.name;

  console.log(`[pipeline:${label}] 크롤링 시작`);

  const rawData = await crawler.run();
  console.log(`[pipeline:${label}] 수집 완료 — ${rawData.length}건`);

  const validated = validate(rawData, { requiredFields });
  console.log(`[pipeline:${label}] 검증 완료 — ${validated.length}건`);

  const finalData = useTranslate
    ? await translate(validated)
    : validated;

  if (useTranslate) {
    console.log(`[pipeline:${label}] 번역 완료 — ${finalData.length}건`);
  }

  await save(finalData, outputPath, { dedupKey });
  console.log(`[pipeline:${label}] 파이프라인 완료`);
}
