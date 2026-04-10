(function() {
  "use strict";
  const ALI_SELECTORS = {
    // 상품 기본 정보 — h1은 클래스가 빈 문자열
    TITLE: "h1",
    // 가격 (한국 로케일 기준 price-kr 네임스페이스)
    PRICE: "[class*='price-kr--current--']",
    ORIGINAL_PRICE: "[class*='price-kr--originWrap--']",
    DISCOUNT: "[class*='price-kr--discount--']",
    // 이미지
    IMAGE_THUMBS: "[class*='slider--img--'] img",
    MAIN_IMAGE: "[class*='magnifier--image--']",
    // 옵션/SKU
    OPTION_GROUP: "[class*='sku-item--wrap--']",
    OPTION_GROUP_TITLE: "[class*='sku-item--title--']",
    OPTION_ITEM: "[class*='sku-item--box--'] > div, [class*='sku-item--image--']",
    OPTION_ITEM_IMAGE: "img",
    OPTION_ITEM_TEXT: "[class*='sku-item--text--'], [class*='sku-item--name--']",
    // 속성/스펙
    ATTRIBUTE_LIST: "[class*='specification--list--']",
    ATTRIBUTE_ITEM: "[class*='specification--prop--']",
    ATTRIBUTE_TITLE: "[class*='specification--title--']",
    ATTRIBUTE_DESC: "[class*='specification--desc--']",
    // 판매자 정보
    SELLER_NAME: "[class*='store-header--storeName--'], [class*='seller--storeName--']",
    STORE_LINK: "[class*='store-header--storeName--'] a, [class*='seller--storeName--'] a",
    // 평점/리뷰
    RATING: "[class*='reviewer--rating--'], [class*='review--average--']",
    REVIEW_COUNT: "[class*='reviewer--reviews--'], [class*='review--count--']",
    ORDER_COUNT: "[class*='reviewer--sold--'], [class*='review--trade--']",
    // 배송
    SHIPPING: "[class*='dynamic-shipping--content--'], [class*='shipping--content--']",
    // 카테고리 (breadcrumb)
    BREADCRUMB: "[class*='breadcrumb--item--'] a, [class*='breadcrumb--text--'] a",
    // 설명
    DESCRIPTION_TEXT: "#product-description, [class*='description--content--']"
  };
  function parseProductPage() {
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
      scrapedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  function extractProductId() {
    const match = window.location.pathname.match(/\/item\/(\d+)\.html/);
    if (match) return match[1];
    const canonical = document.querySelector("link[rel='canonical']");
    const canonicalMatch = canonical?.href?.match(/\/item\/(\d+)\.html/);
    return canonicalMatch?.[1] ?? "";
  }
  function extractTitle() {
    const el = document.querySelector(ALI_SELECTORS.TITLE);
    return el?.textContent?.trim() ?? "";
  }
  function extractPriceInfo() {
    const priceEl = document.querySelector(ALI_SELECTORS.PRICE);
    const price = priceEl?.textContent?.trim() ?? "";
    const origEl = document.querySelector(ALI_SELECTORS.ORIGINAL_PRICE);
    const originalPrice = origEl?.textContent?.trim() || void 0;
    const discountEl = document.querySelector(ALI_SELECTORS.DISCOUNT);
    const discount = discountEl?.textContent?.trim() || void 0;
    return { price, originalPrice, discount };
  }
  function extractCurrency() {
    const priceEl = document.querySelector(ALI_SELECTORS.PRICE);
    const text = priceEl?.textContent?.trim() ?? "";
    if (text.includes("₩")) return "KRW";
    if (text.includes("$")) return "USD";
    if (text.includes("€")) return "EUR";
    if (text.includes("¥")) return "CNY";
    return "USD";
  }
  function extractImages() {
    const urls = [];
    const thumbs = document.querySelectorAll(ALI_SELECTORS.IMAGE_THUMBS);
    for (const img of thumbs) {
      const src = img.src || img.dataset.src || "";
      if (src) {
        const fullSrc = src.replace(/_\d+x\d+\.\w+$/, "").replace(/\?.*$/, "");
        if (!urls.includes(fullSrc)) urls.push(fullSrc);
      }
    }
    if (urls.length === 0) {
      const mainImg = document.querySelector(ALI_SELECTORS.MAIN_IMAGE);
      if (mainImg?.src) urls.push(mainImg.src);
    }
    return urls;
  }
  function extractAttributes() {
    const attrs = [];
    const items = document.querySelectorAll(ALI_SELECTORS.ATTRIBUTE_ITEM);
    for (const item of items) {
      const name = item.querySelector(ALI_SELECTORS.ATTRIBUTE_TITLE)?.textContent?.trim() ?? "";
      const value = item.querySelector(ALI_SELECTORS.ATTRIBUTE_DESC)?.textContent?.trim() ?? "";
      if (name && value) attrs.push({ name, value });
    }
    if (attrs.length === 0) {
      const list = document.querySelector(ALI_SELECTORS.ATTRIBUTE_LIST);
      if (list) {
        const children = list.querySelectorAll("li, div[class*='prop']");
        for (const child of children) {
          const text = child.textContent?.trim() ?? "";
          const colonIdx = text.indexOf(":");
          if (colonIdx > 0) {
            attrs.push({
              name: text.slice(0, colonIdx).trim(),
              value: text.slice(colonIdx + 1).trim()
            });
          }
        }
      }
    }
    return attrs;
  }
  function extractOptionGroups() {
    const groups = [];
    const groupEls = document.querySelectorAll(ALI_SELECTORS.OPTION_GROUP);
    for (const groupEl of groupEls) {
      const name = groupEl.querySelector(ALI_SELECTORS.OPTION_GROUP_TITLE)?.textContent?.trim() ?? "";
      const optionEls = groupEl.querySelectorAll(ALI_SELECTORS.OPTION_ITEM);
      const options = Array.from(optionEls).map((optEl) => {
        const img = optEl.querySelector(ALI_SELECTORS.OPTION_ITEM_IMAGE);
        const textEl = optEl.querySelector(ALI_SELECTORS.OPTION_ITEM_TEXT);
        return {
          name: textEl?.textContent?.trim() ?? optEl.getAttribute("title") ?? optEl.textContent?.trim() ?? "",
          imageUrl: img?.src || void 0
        };
      });
      if (name || options.length > 0) {
        groups.push({ name, options });
      }
    }
    return groups;
  }
  function extractDescription() {
    const descEl = document.querySelector(ALI_SELECTORS.DESCRIPTION_TEXT);
    return descEl?.textContent?.trim() ?? "";
  }
  function extractSeller() {
    const nameEl = document.querySelector(ALI_SELECTORS.SELLER_NAME);
    const linkEl = document.querySelector(ALI_SELECTORS.STORE_LINK);
    return {
      name: nameEl?.textContent?.trim() ?? "",
      storeUrl: linkEl?.href ?? ""
    };
  }
  function extractRatings() {
    const avgEl = document.querySelector(ALI_SELECTORS.RATING);
    const countEl = document.querySelector(ALI_SELECTORS.REVIEW_COUNT);
    const orderEl = document.querySelector(ALI_SELECTORS.ORDER_COUNT);
    return {
      average: avgEl?.textContent?.trim() ?? "",
      totalReviews: countEl?.textContent?.trim()?.replace(/[^\d]/g, "") ?? "",
      totalOrders: orderEl?.textContent?.trim() || void 0
    };
  }
  function extractShipping() {
    const el = document.querySelector(ALI_SELECTORS.SHIPPING);
    return el?.textContent?.trim() ?? "";
  }
  function extractCategory() {
    const links = document.querySelectorAll(ALI_SELECTORS.BREADCRUMB);
    return Array.from(links).map((a) => a.textContent?.trim() ?? "").filter(Boolean);
  }
  const SCRAPE_DELAY_MS = 2e3;
  async function scrape() {
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
      attributes: product.attributes.length
    });
    const message = {
      type: "SCRAP_PRODUCT",
      payload: product
    };
    const response = await chrome.runtime.sendMessage(message);
    if (response?.success) {
      console.log("[AliScraper] 서버 전송 성공");
    } else {
      console.error("[AliScraper] 서버 전송 실패:", response?.error);
    }
  }
  scrape();
})();
