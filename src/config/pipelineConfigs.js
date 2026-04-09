import CnnvdCrawler from "../crawlers/CnnvdCrawler.mjs";
import BooksCrawler from "../crawlers/BooksCrawler.mjs";

/**
 * 사이트별 파이프라인 설정.
 * 새 크롤러 추가 시 이 객체에 항목만 추가하면 됩니다.
 */
export const PIPELINES = {
  cnnvd: {
    createCrawler: () => new CnnvdCrawler(),
    requiredFields: undefined,
    outputPath: "output/result.json",
    dedupKey: (item) => item.originalSubtitle ?? item.detailSubtitle,
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
    dedupKey: (item) => item.upc,
    useTranslate: false,
  },
};
