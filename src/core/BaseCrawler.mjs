import puppeteer from "puppeteer";

/**
 * 모든 크롤러의 기반이 되는 추상 클래스입니다.
 * 브라우저 생명주기, 네비게이션, 재시도, 타임아웃 등의
 * 공통 인프라 기능을 제공합니다.
 */
export default class BaseCrawler {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * 브라우저를 실행하고 새 페이지를 엽니다.
   */
  async launch() {
    this.browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    this.page = await this.browser.newPage();
  }

  /**
   * 브라우저를 종료합니다.
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * 지정한 URL로 이동하고 특정 셀렉터가 나타날 때까지 대기합니다.
   * delay() 대신 waitForSelector를 사용하여 안정적으로 로딩을 감지합니다.
   * @param {string} url - 이동할 URL
   * @param {string} waitSelector - 로딩 완료 기준 셀렉터
   * @param {Object} options
   * @param {number} [options.timeout=30000] - 대기 타임아웃(ms)
   */
  async navigate(url, waitSelector, { timeout = 30000 } = {}) {
    await this.page.goto(url, { waitUntil: "networkidle0", timeout });
    if (waitSelector) {
      await this.page.waitForSelector(waitSelector, { timeout });
    }
  }

  /**
   * 주어진 비동기 함수를 최대 times회 재시도합니다.
   * 각 시도마다 실패 이유를 로깅합니다.
   * @param {Function} fn - 재시도할 비동기 함수
   * @param {number} [times=3] - 최대 시도 횟수
   * @returns {Promise<*>} 함수 반환값
   */
  async retry(fn, times = 3) {
    let lastError;
    for (let attempt = 1; attempt <= times; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        console.error(`[retry] 시도 ${attempt}/${times} 실패:`, error.message);
      }
    }
    throw new Error(
      `[retry] ${times}회 모두 실패. 마지막 오류: ${lastError?.message}`,
    );
  }

  /**
   * 주어진 비동기 함수에 타임아웃을 적용합니다.
   * @param {Function} fn - 실행할 비동기 함수
   * @param {number} [ms=10000] - 타임아웃(ms)
   * @returns {Promise<*>} 함수 반환값
   */
  async withTimeout(fn, ms = 10000) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`[withTimeout] ${ms}ms 초과`)),
          ms,
        ),
      ),
    ]);
  }
}
