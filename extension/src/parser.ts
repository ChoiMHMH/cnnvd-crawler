import { ALI_SELECTORS as S } from "./selectors.js";
import type {
  AliExpressProduct,
  ProductAttribute,
  OptionGroup,
  SellerInfo,
  RatingInfo,
} from "./types.js";

/**
 * 현재 AliExpress 상품 상세 페이지 DOM에서 정규화된 상품 데이터를 추출한다.
 * content script 내부에서 실행되므로 document에 직접 접근한다.
 */
export function parseProductPage(): AliExpressProduct {
  return {
    productId: extractProductId(),
    title: extractTitle(),
    ...extractPriceInfo(),
    currency: extractCurrency(),
    imageUrls: extractImages(),
    attributes: extractAttributes(),
    optionGroups: extractOptionGroups(),
    stockKeepingUnits: [],
    description: extractDescription(),
    seller: extractSeller(),
    ratings: extractRatings(),
    shipping: extractShipping(),
    category: extractCategory(),
    sourceUrl: window.location.href,
    scrapedAt: new Date().toISOString(),
  };
}

function extractProductId(): string {
  const match = window.location.pathname.match(/\/item\/(\d+)\.html/);
  if (match) return match[1];

  const canonical = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
  const canonicalMatch = canonical?.href?.match(/\/item\/(\d+)\.html/);
  return canonicalMatch?.[1] ?? "";
}

function extractTitle(): string {
  const el = document.querySelector(S.TITLE) ?? document.querySelector(S.TITLE_FALLBACK);
  return el?.textContent?.trim() ?? "";
}

function extractPriceInfo(): { price: string; originalPrice?: string; discount?: string } {
  const priceEl = document.querySelector(S.PRICE) ?? document.querySelector(S.PRICE_FALLBACK);
  const price = priceEl?.textContent?.trim() ?? "";

  const origEl = document.querySelector(S.ORIGINAL_PRICE);
  const originalPrice = origEl?.textContent?.trim() || undefined;

  const discountEl = document.querySelector(S.DISCOUNT);
  const discount = discountEl?.textContent?.trim() || undefined;

  return { price, originalPrice, discount };
}

function extractCurrency(): string {
  const priceEl = document.querySelector(S.PRICE) ?? document.querySelector(S.PRICE_FALLBACK);
  const text = priceEl?.textContent?.trim() ?? "";

  if (text.includes("₩")) return "KRW";
  if (text.includes("$")) return "USD";
  if (text.includes("€")) return "EUR";
  if (text.includes("¥")) return "CNY";

  return "USD";
}

function extractImages(): string[] {
  const urls: string[] = [];

  const thumbs = document.querySelectorAll<HTMLImageElement>(S.IMAGE_THUMBS);
  for (const img of thumbs) {
    const src = img.src || img.dataset.src || "";
    if (src) {
      // AliExpress 썸네일 → 원본 크기로 변환
      const fullSrc = src.replace(/_\d+x\d+\.\w+$/, "").replace(/\?.*$/, "");
      if (!urls.includes(fullSrc)) urls.push(fullSrc);
    }
  }

  if (urls.length === 0) {
    const mainImg = document.querySelector<HTMLImageElement>(S.MAIN_IMAGE);
    if (mainImg?.src) urls.push(mainImg.src);
  }

  return urls;
}

function extractAttributes(): ProductAttribute[] {
  const attrs: ProductAttribute[] = [];
  const items = document.querySelectorAll(S.ATTRIBUTE_ITEM);

  for (const item of items) {
    const name = item.querySelector(S.ATTRIBUTE_TITLE)?.textContent?.trim() ?? "";
    const value = item.querySelector(S.ATTRIBUTE_DESC)?.textContent?.trim() ?? "";
    if (name && value) attrs.push({ name, value });
  }

  // 대체: 속성 리스트 구조가 다를 경우
  if (attrs.length === 0) {
    const list = document.querySelector(S.ATTRIBUTE_LIST);
    if (list) {
      const children = list.querySelectorAll("li, div[class*='prop']");
      for (const child of children) {
        const text = child.textContent?.trim() ?? "";
        const colonIdx = text.indexOf(":");
        if (colonIdx > 0) {
          attrs.push({
            name: text.slice(0, colonIdx).trim(),
            value: text.slice(colonIdx + 1).trim(),
          });
        }
      }
    }
  }

  return attrs;
}

function extractOptionGroups(): OptionGroup[] {
  const groups: OptionGroup[] = [];
  const groupEls = document.querySelectorAll(S.OPTION_GROUP);

  for (const groupEl of groupEls) {
    const name = groupEl.querySelector(S.OPTION_GROUP_TITLE)?.textContent?.trim() ?? "";
    const optionEls = groupEl.querySelectorAll(S.OPTION_ITEM);
    const options = Array.from(optionEls).map((optEl) => {
      const img = optEl.querySelector<HTMLImageElement>(S.OPTION_ITEM_IMAGE);
      const textEl = optEl.querySelector(S.OPTION_ITEM_TEXT);
      return {
        name: textEl?.textContent?.trim() ?? optEl.getAttribute("title") ?? optEl.textContent?.trim() ?? "",
        imageUrl: img?.src || undefined,
      };
    });

    if (name || options.length > 0) {
      groups.push({ name, options });
    }
  }

  return groups;
}

function extractDescription(): string {
  const descEl = document.querySelector(S.DESCRIPTION_TEXT);
  return descEl?.textContent?.trim() ?? "";
}

function extractSeller(): SellerInfo {
  const nameEl = document.querySelector(S.SELLER_NAME) ?? document.querySelector(S.SELLER_NAME_FALLBACK);
  const linkEl = document.querySelector<HTMLAnchorElement>(S.STORE_LINK);

  return {
    name: nameEl?.textContent?.trim() ?? "",
    storeUrl: linkEl?.href ?? "",
  };
}

function extractRatings(): RatingInfo {
  const avgEl = document.querySelector(S.RATING);
  const countEl = document.querySelector(S.REVIEW_COUNT);
  const orderEl = document.querySelector(S.ORDER_COUNT);

  return {
    average: avgEl?.textContent?.trim() ?? "",
    totalReviews: countEl?.textContent?.trim()?.replace(/[^\d]/g, "") ?? "",
    totalOrders: orderEl?.textContent?.trim() || undefined,
  };
}

function extractShipping(): string {
  const el = document.querySelector(S.SHIPPING);
  return el?.textContent?.trim() ?? "";
}

function extractCategory(): string[] {
  const links = document.querySelectorAll(S.BREADCRUMB);
  return Array.from(links)
    .map((a) => a.textContent?.trim() ?? "")
    .filter(Boolean);
}
