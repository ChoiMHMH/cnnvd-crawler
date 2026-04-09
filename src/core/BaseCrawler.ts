import { chromium, Browser, BrowserContext, Page } from "playwright";

/**
 * 모든 크롤러의 기반이 되는 추상 클래스입니다.
 * 브라우저 생명주기, 네비게이션, 재시도, 타임아웃 등의
 * 공통 인프라 기능을 제공합니다.
 */
export default class BaseCrawler {
  browser: Browser | null = null;
  context: BrowserContext | null = null;
  page: Page | null = null;

  /**
   * 브라우저를 실행하고 새 페이지를 엽니다.
   */
  async launch(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
  }

  /**
   * 브라우저를 종료합니다.
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  /**
   * 지정한 URL로 이동하고 특정 셀렉터가 나타날 때까지 대기합니다.
   */
  async navigate(
    url: string,
    waitSelector: string,
    { timeout = 60000 }: { timeout?: number } = {},
  ): Promise<void> {
    await this.page!.goto(url, { waitUntil: "networkidle", timeout });
    if (waitSelector) {
      await this.page!.waitForSelector(waitSelector, { timeout });
    }
  }

  /**
   * 주어진 비동기 함수를 최대 times회 재시도합니다.
   */
  async retry<T>(fn: () => Promise<T>, times: number = 3): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= times; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        console.error(`[retry] 시도 ${attempt}/${times} 실패:`, lastError.message);
      }
    }
    throw new Error(
      `[retry] ${times}회 모두 실패. 마지막 오류: ${lastError?.message}`,
    );
  }

  /**
   * 주어진 비동기 함수에 타임아웃을 적용합니다.
   */
  async withTimeout<T>(fn: () => Promise<T>, ms: number = 10000): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`[withTimeout] ${ms}ms 초과`)),
            ms,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer!);
    }
  }
}
