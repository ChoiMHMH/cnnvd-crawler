import { validate, type FieldCheck } from "../validate.js";
import { translate } from "../translate.js";
import { save } from "../saveToJson.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Runnable {
  run(): Promise<any[]>;
  constructor: { name: string };
}

export interface PipelineConfig {
  crawler: Runnable;
  requiredFields?: FieldCheck[];
  outputPath: string;
  dedupKey?: (item: Record<string, unknown>) => string | undefined;
  useTranslate?: boolean;
}

/**
 * 크롤러 파이프라인을 공통으로 실행합니다.
 * 수집 → 검증 → (번역) → 저장 순서로 진행됩니다.
 */
export async function runCrawlerPipeline({
  crawler,
  requiredFields,
  outputPath,
  dedupKey,
  useTranslate = false,
}: PipelineConfig): Promise<void> {
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
