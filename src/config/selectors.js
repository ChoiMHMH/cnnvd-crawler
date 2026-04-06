// CNNVD 크롤러에서 사용하는 모든 CSS 셀렉터 상수 모음
// 셀렉터가 변경될 경우 이 파일만 수정하면 됩니다.

export const SELECTORS = {
  // 페이지네이션
  PAGINATION_ITEMS: ".el-pager li",
  PAGINATION_ITEM_N: (n) => `.el-pager li:nth-child(${n})`,

  // 목록 페이지
  CONTENT_CENTER: ".content-center",
  CONTENT_TITLE: ".content-title",
  CONTENT_DETAIL: ".content-detail",
  LIST_ITEMS: ".el-col-16 > *",

  // 상세 페이지
  DETAIL_INFO: ".detail-info",
  DETAIL_TITLE: ".detail-title",
  DETAIL_SUBTITLE: ".detail-subtitle",
  DETAIL_CONTENT: ".detail-content",
};
