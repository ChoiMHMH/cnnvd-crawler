import CnnvdCrawler from "../crawlers/CnnvdCrawler.js";
import BooksCrawler from "../crawlers/BooksCrawler.js";
import type { PipelineConfig, Runnable } from "../core/runCrawlerPipeline.js";

type PipelineEntry = Omit<PipelineConfig, "crawler"> & {
  createCrawler: () => Runnable;
};

/**
 * AliExpress 수신 서버용 파이프라인 설정.
 * 확장프로그램에서 전송한 데이터의 validate → save에 사용한다.
 */
export const ALIEXPRESS_PIPELINE = {
  requiredFields: [
    { field: "productId", check: "string" as const },
    { field: "title", check: "string" as const },
    { field: "price", check: "string" as const },
  ],
  outputPath: "output/aliexpress_result.json",
  dedupKey: (item: Record<string, unknown>) => item.productId as string,
  useTranslate: false,
};

/**
 * 사이트별 파이프라인 설정.
 * 새 크롤러 추가 시 이 객체에 항목만 추가하면 됩니다.
 */
export const PIPELINES: Record<string, PipelineEntry> = {
  cnnvd: {
    createCrawler: () => new CnnvdCrawler(),
    requiredFields: undefined,
    outputPath: "output/result.json",
    dedupKey: (item) => (item.originalSubtitle as string) ?? (item.detailSubtitle as string),
    useTranslate: true,
  },
  books: {
    createCrawler: () => new BooksCrawler(),
    requiredFields: [
      { field: "title", check: "string" },
      { field: "price", check: "string" },
      { field: "upc", check: "string" },
    ],
    outputPath: "output/books_result.json",
    dedupKey: (item) => item.upc as string,
    useTranslate: false,
  },
};
