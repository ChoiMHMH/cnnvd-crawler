/**
 * AliExpress 상품 상세 페이지 셀렉터.
 * 사이트 구조 변경 시 이 파일만 수정하면 된다.
 *
 * 실제 DOM 확인일: 2026-04-10
 * 클래스 패턴: BEM + 해시 (예: price-kr--current--NhhwBO1)
 * 매칭 전략: [class*='접두사--속성--'] 로 해시 부분 무시
 */
export const ALI_SELECTORS = {
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
  DESCRIPTION_TEXT: "#product-description, [class*='description--content--']",
} as const;
