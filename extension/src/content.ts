import { parseProductPage } from "./parser.js";
import type { ScrapMessage, ScrapResponse } from "./types.js";

/**
 * AliExpress 상품 상세 페이지에서 동작하는 content script.
 * 페이지 로드 완료 후 자동으로 파싱하고, 결과를 background로 전송한다.
 */

const SCRAPE_DELAY_MS = 2000;

async function scrape(): Promise<void> {
  // AliExpress는 SPA 구조로 hydration이 필요하므로 잠시 대기
  await new Promise((r) => setTimeout(r, SCRAPE_DELAY_MS));

  console.log("[AliScraper] 상품 페이지 파싱 시작:", window.location.href);

  const product = parseProductPage();

  if (!product.productId || !product.title) {
    console.warn("[AliScraper] 필수 데이터 누락 — productId 또는 title이 비어있음");
    return;
  }

  console.log("[AliScraper] 파싱 완료:", {
    productId: product.productId,
    title: product.title,
    price: product.price,
    images: product.imageUrls.length,
    options: product.optionGroups.length,
    attributes: product.attributes.length,
  });

  const message: ScrapMessage = {
    type: "SCRAP_PRODUCT",
    payload: product,
  };

  const response: ScrapResponse = await chrome.runtime.sendMessage(message);

  if (response?.success) {
    console.log("[AliScraper] 서버 전송 성공");
  } else {
    console.error("[AliScraper] 서버 전송 실패:", response?.error);
  }
}

scrape();
