import BaseCrawler from "../core/BaseCrawler.js";
import { BOOKS_SELECTORS as S } from "../config/booksSelectors.js";

const BASE_URL = "https://books.toscrape.com/";
const PAGE_COUNT = 2;

export interface BookListItem {
  title: string;
  price: string;
  rating: number;
  detailUrl: string;
}

export interface BookDetailItem {
  title: string;
  price: string;
  availability: string;
  rating: number;
  description: string;
  category: string;
  upc: string;
  priceExclTax: string;
  priceInclTax: string;
  tax: string;
  stockCount: string;
}

/**
 * books.toscrape.com 전용 크롤러입니다.
 */
export default class BooksCrawler extends BaseCrawler {
  async run(): Promise<BookDetailItem[]> {
    const results: BookDetailItem[] = [];

    await this.launch();
    try {
      await this.navigate(BASE_URL, S.BOOK_ITEM);

      let currentUrl = BASE_URL;

      for (let pageIndex = 1; pageIndex <= PAGE_COUNT; pageIndex++) {
        const listItems = await this.extractList();
        console.log(`[BooksCrawler] 페이지 ${pageIndex} — ${listItems.length}건 발견`);

        for (let i = 0; i < listItems.length; i++) {
          const item = listItems[i];
          const data = await this.retry(async () => {
            await this.navigate(item.detailUrl, S.DETAIL_TITLE);
            return await this.extractDetail();
          });

          if (data) {
            results.push(data);
            console.log(`[수집 완료] 페이지 ${pageIndex} / 항목 ${i + 1}: ${data.title}`);
          }

          await this.navigate(currentUrl, S.BOOK_ITEM);
        }

        const nextUrl = await this.getNextPageUrl();
        if (!nextUrl || pageIndex >= PAGE_COUNT) break;
        currentUrl = nextUrl;
        await this.navigate(currentUrl, S.BOOK_ITEM);
      }
    } finally {
      await this.close();
    }

    return results;
  }

  async extractList(): Promise<BookListItem[]> {
    return await this.page!.evaluate(
      ({ itemSel, titleSel, priceSel, ratingSel }) => {
        const ratingMap: Record<string, number> = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5 };

        return Array.from(document.querySelectorAll(itemSel)).map((el) => {
          const titleEl = el.querySelector(titleSel);
          const priceEl = el.querySelector(priceSel);
          const ratingEl = el.querySelector(ratingSel);

          const ratingWord = ratingEl?.className?.replace("star-rating ", "") ?? "";

          return {
            title: titleEl?.getAttribute("title") ?? titleEl?.textContent?.trim() ?? "",
            price: priceEl?.textContent?.trim() ?? "",
            rating: ratingMap[ratingWord] ?? 0,
            detailUrl: new URL(
              titleEl?.getAttribute("href") ?? "",
              document.location.href,
            ).href,
          };
        });
      },
      {
        itemSel: S.BOOK_ITEM,
        titleSel: S.BOOK_TITLE,
        priceSel: S.BOOK_PRICE,
        ratingSel: S.BOOK_RATING,
      },
    );
  }

  async extractDetail(): Promise<BookDetailItem> {
    return await this.page!.evaluate(
      (selectors) => {
        const title =
          document.querySelector(selectors.DETAIL_TITLE)?.textContent?.trim() ?? "";
        const price =
          document.querySelector(selectors.DETAIL_PRICE)?.textContent?.trim() ?? "";
        const availability =
          document.querySelector(selectors.DETAIL_AVAILABILITY)?.textContent?.trim() ?? "";
        const description =
          document.querySelector(selectors.DETAIL_DESCRIPTION)?.textContent?.trim() ?? "";

        const ratingMap: Record<string, number> = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5 };
        const ratingEl = document.querySelector(selectors.DETAIL_RATING);
        const ratingWord = ratingEl?.className?.replace("star-rating ", "") ?? "";
        const rating = ratingMap[ratingWord] ?? 0;

        const breadcrumbLinks = Array.from(
          document.querySelectorAll(selectors.DETAIL_BREADCRUMB + " a"),
        );
        const category = breadcrumbLinks.length >= 3
          ? breadcrumbLinks[2]?.textContent?.trim() ?? ""
          : "";

        const tableData: Record<string, string> = {};
        const rows = document.querySelectorAll(selectors.DETAIL_TABLE_ROWS);
        for (const row of rows) {
          const key = row.querySelector("th")?.textContent?.trim();
          const value = row.querySelector("td")?.textContent?.trim();
          if (key && value) tableData[key] = value;
        }

        return {
          title,
          price,
          availability,
          rating,
          description,
          category,
          upc: tableData["UPC"] ?? "",
          priceExclTax: tableData["Price (excl. tax)"] ?? "",
          priceInclTax: tableData["Price (incl. tax)"] ?? "",
          tax: tableData["Tax"] ?? "",
          stockCount: availability.match(/\((\d+) available\)/)?.[1] ?? "",
        };
      },
      {
        DETAIL_TITLE: S.DETAIL_TITLE,
        DETAIL_PRICE: S.DETAIL_PRICE,
        DETAIL_AVAILABILITY: S.DETAIL_AVAILABILITY,
        DETAIL_RATING: S.DETAIL_RATING,
        DETAIL_DESCRIPTION: S.DETAIL_DESCRIPTION,
        DETAIL_BREADCRUMB: S.DETAIL_BREADCRUMB,
        DETAIL_TABLE_ROWS: S.DETAIL_TABLE_ROWS,
      },
    );
  }

  async getNextPageUrl(): Promise<string | null> {
    return await this.page!.evaluate((nextSel) => {
      const nextEl = document.querySelector(nextSel);
      if (!nextEl) return null;
      return new URL(nextEl.getAttribute("href")!, document.location.href).href;
    }, S.NEXT_PAGE);
  }
}
