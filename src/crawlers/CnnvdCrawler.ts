import BaseCrawler from "../core/BaseCrawler.js";
import { SELECTORS } from "../config/selectors.js";

const BASE_URL = "https://www.cnnvd.org.cn/home/warn";
const PAGE_COUNT = 2;
const ITEMS_PER_PAGE = 10;

export interface CnnvdItem {
  detailTitle: string;
  detailSubtitle: string;
  originalSubtitle: string;
  contents: { type: string; text: string }[];
  table: string;
}

/**
 * CNNVD 보안 경고 페이지 전용 크롤러입니다.
 */
export default class CnnvdCrawler extends BaseCrawler {
  async run(): Promise<CnnvdItem[]> {
    const results: CnnvdItem[] = [];

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

  async extractList(): Promise<{ title: string; date: string }[]> {
    return await this.page!.evaluate(
      ({ centerSel, titleSel, dateSel }) =>
        Array.from(document.querySelectorAll(centerSel)).map((e) => ({
          title: e.querySelector(titleSel)?.textContent?.trim() ?? "",
          date: e.querySelector(dateSel)?.textContent?.trim() ?? "",
        })),
      {
        centerSel: SELECTORS.CONTENT_CENTER,
        titleSel: SELECTORS.CONTENT_TITLE,
        dateSel: SELECTORS.CONTENT_DETAIL,
      },
    );
  }

  async extractDetail(): Promise<CnnvdItem> {
    await this.page!.waitForSelector(SELECTORS.DETAIL_INFO);

    const detailSelectors = {
      DETAIL_TITLE: SELECTORS.DETAIL_TITLE,
      DETAIL_SUBTITLE: SELECTORS.DETAIL_SUBTITLE,
      DETAIL_CONTENT: SELECTORS.DETAIL_CONTENT,
      DETAIL_TABLE_ROWS: SELECTORS.DETAIL_TABLE_ROWS,
    };

    return await this.page!.evaluate((selectors) => {
      const detailTitle =
        document.querySelector(selectors.DETAIL_TITLE)?.textContent?.trim() ?? "";
      const detailSubtitle =
        document.querySelector(selectors.DETAIL_SUBTITLE)?.textContent?.trim() ?? "";

      const contents: { type: string; text: string }[] = [];
      let currentParagraphs: string[] = [];
      const detailContent = document.querySelector(selectors.DETAIL_CONTENT);

      if (detailContent) {
        for (const tag of detailContent.children) {
          const tagName = tag.tagName.toLowerCase();
          const tagText = tag.textContent!.trim();

          if (
            tagName === "table" ||
            (tagName === "p" && tag.innerHTML.trim() === "&nbsp;")
          ) {
            break;
          }

          if (tagName === "p" && tag.querySelector("strong") !== null) {
            if (currentParagraphs.length > 0) {
              contents.push({ type: "paragraph", text: currentParagraphs.join(" ") });
              currentParagraphs = [];
            }
            contents.push({ type: "heading", text: tagText });
          } else {
            currentParagraphs.push(tagText);
          }
        }

        if (currentParagraphs.length > 0) {
          contents.push({ type: "paragraph", text: currentParagraphs.join(" ") });
        }
      }

      const rows = Array.from(document.querySelectorAll(selectors.DETAIL_TABLE_ROWS));
      const table = rows
        .slice(0, 11)
        .map((row) =>
          Array.from(row.querySelectorAll("td"))
            .map((cell) => cell?.textContent!.trim())
            .join(" + "),
        )
        .join(" + ");

      return { detailTitle, detailSubtitle, originalSubtitle: detailSubtitle, contents, table };
    }, detailSelectors);
  }

  async navigateToDetail(index: number): Promise<CnnvdItem | null> {
    const count = await this.page!.locator(SELECTORS.LIST_ITEMS).count();
    if (index >= count) {
      console.warn(`[navigateToDetail] 인덱스 ${index} 항목이 없습니다.`);
      return null;
    }

    await this.page!.evaluate(({ selector, i }: { selector: string; i: number }) => {
      const el = document.querySelectorAll(selector)[i] as HTMLElement;
      if (el) el.click();
    }, { selector: SELECTORS.LIST_ITEMS, i: index });

    await this.page!.waitForSelector(SELECTORS.DETAIL_INFO, { timeout: 30000 });
    const data = await this.extractDetail();
    await this.backToList();
    return data;
  }

  async backToList(): Promise<void> {
    await this.navigate(BASE_URL, SELECTORS.CONTENT_TITLE);
  }

  async navigateToPage(pageIndex: number): Promise<void> {
    if (pageIndex === 1) return;

    await this.page!.click(SELECTORS.PAGINATION_ITEM_N(pageIndex));
    await this.page!.waitForSelector(SELECTORS.CONTENT_TITLE, { timeout: 30000 });
  }
}
