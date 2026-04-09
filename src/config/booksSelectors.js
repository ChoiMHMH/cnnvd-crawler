// books.toscrape.com 크롤러에서 사용하는 모든 CSS 셀렉터 상수 모음
// 셀렉터가 변경될 경우 이 파일만 수정하면 됩니다.

export const BOOKS_SELECTORS = {
  // 목록 페이지
  BOOK_ITEM: "article.product_pod",
  BOOK_TITLE: "h3 a",
  BOOK_PRICE: ".price_color",
  BOOK_RATING: ".star-rating",
  BOOK_LINK: "h3 a",
  NEXT_PAGE: ".pager .next a",

  // 상세 페이지
  DETAIL_TITLE: ".product_main h1",
  DETAIL_PRICE: ".product_main .price_color",
  DETAIL_AVAILABILITY: ".product_main .instock.availability",
  DETAIL_RATING: ".product_main .star-rating",
  DETAIL_DESCRIPTION: "#product_description ~ p",
  DETAIL_TABLE: ".table-striped",
  DETAIL_TABLE_ROWS: ".table-striped tr",
  DETAIL_BREADCRUMB: ".breadcrumb",
};
