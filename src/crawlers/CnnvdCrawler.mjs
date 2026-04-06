import BaseCrawler from "../core/BaseCrawler.mjs";
import { SELECTORS } from "../config/selectors.js";

const BASE_URL = "https://www.cnnvd.org.cn/home/warn";
const PAGE_COUNT = 2;
const ITEMS_PER_PAGE = 10;

/**
 * CNNVD 보안 경고 페이지 전용 크롤러입니다.
 * BaseCrawler를 상속하여 목록 수집, 상세 페이지 추출,
 * 네비게이션 등 사이트 특화 로직을 구현합니다.
 */
export default class CnnvdCrawler extends BaseCrawler {
  /**
   * 크롤러의 전체 실행 파이프라인입니다.
   * @returns {Promise<Array<Object>>} 수집된 원시 데이터 배열
   */
  async run() {
    const results = [];

    await this.launch();
    try {
      await this.navigate(BASE_URL, SELECTORS.CONTENT_TITLE);

      for (let pageIndex = 1; pageIndex <= PAGE_COUNT; pageIndex++) {
        await this.navigateToPage(pageIndex);
        const listItems = await this.extractList();
        const itemCount = Math.min(ITEMS_PER_PAGE, listItems.length);

        for (let itemIndex = 0; itemIndex < itemCount; itemIndex++) {
          const data = await this.retry(async () => {
            await this.navigateToPage(pageIndex);
            return await this.navigateToDetail(itemIndex);
          });

          if (data) {
            results.push(data);
            console.log(`[수집 완료] 페이지 ${pageIndex} / 항목 ${itemIndex + 1}`);
          }
        }
      }
    } finally {
      await this.close();
    }

    return results;
  }

  /**
   * 현재 목록 페이지의 아이템 목록을 추출합니다.
   * @returns {Promise<Array<{title: string, date: string}>>}
   */
  async extractList() {
    return await this.page.$$eval(
      SELECTORS.CONTENT_CENTER,
      (elements, titleSel, dateSel) =>
        elements.map((e) => ({
          title: e.querySelector(titleSel)?.textContent?.trim() ?? "",
          date: e.querySelector(dateSel)?.textContent?.trim() ?? "",
        })),
      SELECTORS.CONTENT_TITLE,
      SELECTORS.CONTENT_DETAIL,
    );
  }

  /**
   * 현재 상세 페이지에서 데이터를 추출합니다.
   * - strong 태그 → 소제목 구분
   * - &nbsp; 빈 단락 또는 table → break 처리
   * - table → 별도 추출
   * @returns {Promise<Object>} 상세 데이터 객체
   */
  async extractDetail() {
    await this.page.waitForSelector(SELECTORS.DETAIL_INFO);

    return await this.page.evaluate((selectors) => {
      const detailTitle =
        document.querySelector(selectors.DETAIL_TITLE)?.textContent?.trim() ?? "";
      const detailSubtitle =
        document.querySelector(selectors.DETAIL_SUBTITLE)?.textContent?.trim() ?? "";

      const sections = [];
      let currentSection = [];
      const detailContent = document.querySelector(selectors.DETAIL_CONTENT);

      if (detailContent) {
        for (const tag of detailContent.children) {
          const tagName = tag.tagName.toLowerCase();
          const tagText = tag.textContent.trim();

          // table 또는 &nbsp; 빈 단락 → break
          if (
            tagName === "table" ||
            (tagName === "p" && tag.innerHTML.trim() === "&nbsp;")
          ) {
            break;
          }

          if (tagName === "p" && tag.querySelector("strong") !== null) {
            // 누적된 일반 문단 저장 후 소제목 추가
            if (currentSection.length > 0) {
              sections.push(`<div>${currentSection.join(" ")}</div>`);
              currentSection = [];
            }
            sections.push(
              `<div class="font-extrabold mt-3 mb-1">${tagText}</div>`,
            );
          } else {
            currentSection.push(tagText);
          }
        }

        if (currentSection.length > 0) {
          sections.push(`<div>${currentSection.join(" ")}</div>`);
        }
      }

      const contents = sections.join("");

      // table 추출 (최대 11행)
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      const table = rows
        .slice(0, 11)
        .map((row) =>
          Array.from(row.querySelectorAll("td"))
            .map((cell) => cell?.textContent.trim())
            .join(" + "),
        )
        .join(" + ");

      return { detailTitle, detailSubtitle, contents, table };
    }, SELECTORS);
  }

  /**
   * 특정 인덱스의 항목을 클릭하고 상세 페이지 데이터를 반환합니다.
   * @param {number} index - 클릭할 항목의 인덱스
   * @returns {Promise<Object|null>} 상세 데이터 또는 null
   */
  async navigateToDetail(index) {
    const elements = await this.page.$$(SELECTORS.LIST_ITEMS);
    if (!elements[index]) {
      console.warn(`[navigateToDetail] 인덱스 ${index} 항목이 없습니다.`);
      return null;
    }

    await this.page.evaluate((selector, i) => {
      const el = document.querySelectorAll(selector)[i];
      if (el) el.click();
    }, SELECTORS.LIST_ITEMS, index);

    await this.page.waitForSelector(SELECTORS.DETAIL_INFO, { timeout: 30000 });
    const data = await this.extractDetail();
    await this.backToList();
    return data;
  }

  /**
   * 목록 페이지로 돌아갑니다.
   */
  async backToList() {
    await this.navigate(BASE_URL, SELECTORS.CONTENT_TITLE);
  }

  /**
   * 페이지네이션을 통해 특정 페이지로 이동합니다.
   * @param {number} pageIndex - 이동할 페이지 번호 (1부터 시작)
   */
  async navigateToPage(pageIndex) {
    if (pageIndex === 1) return;

    await this.page.click(SELECTORS.PAGINATION_ITEM_N(pageIndex));
    await this.page.waitForSelector(SELECTORS.CONTENT_TITLE, { timeout: 30000 });
  }
}
