import "dotenv/config";
import { PIPELINES } from "./src/config/pipelineConfigs.js";
import { runCrawlerPipeline } from "./src/core/runCrawlerPipeline.js";

const target = process.argv[2] ?? "cnnvd";
const config = PIPELINES[target];

if (!config) {
  console.error(
    `[pipeline] 알 수 없는 대상: "${target}". 사용 가능: ${Object.keys(PIPELINES).join(", ")}`,
  );
  process.exit(1);
}

runCrawlerPipeline({
  crawler: config.createCrawler(),
  requiredFields: config.requiredFields,
  outputPath: config.outputPath,
  dedupKey: config.dedupKey,
  useTranslate: config.useTranslate,
}).catch((error) => {
  console.error(`[pipeline:${target}] 치명적 오류:`, error);
  process.exit(1);
});
