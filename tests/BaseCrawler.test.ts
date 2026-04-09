import { describe, it, expect, vi } from "vitest";
import BaseCrawler from "../src/core/BaseCrawler.js";

describe("withTimeout", () => {
  it("함수가 시간 내에 완료되면 결과를 반환한다", async () => {
    const crawler = new BaseCrawler();
    const result = await crawler.withTimeout(() => Promise.resolve("ok"), 1000);
    expect(result).toBe("ok");
  });

  it("함수가 타임아웃을 초과하면 에러를 던진다", async () => {
    const crawler = new BaseCrawler();
    await expect(
      crawler.withTimeout(
        () => new Promise((resolve) => setTimeout(resolve, 500)),
        50,
      ),
    ).rejects.toThrow("50ms 초과");
  });

  it("성공 시 타이머가 정리되어 누수가 없다", async () => {
    const crawler = new BaseCrawler();
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");

    await crawler.withTimeout(() => Promise.resolve("ok"), 5000);

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("실패 시에도 타이머가 정리된다", async () => {
    const crawler = new BaseCrawler();
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");

    await expect(
      crawler.withTimeout(() => Promise.reject(new Error("fail")), 5000),
    ).rejects.toThrow("fail");

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

describe("retry", () => {
  it("첫 시도에 성공하면 결과를 반환한다", async () => {
    const crawler = new BaseCrawler();
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await crawler.retry(fn, 3);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("실패 후 재시도하여 성공한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const crawler = new BaseCrawler();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockResolvedValue("ok");
    const result = await crawler.retry(fn, 3);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("모든 시도가 실패하면 에러를 던진다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const crawler = new BaseCrawler();
    const fn = vi.fn().mockRejectedValue(new Error("always fail"));
    await expect(crawler.retry(fn, 2)).rejects.toThrow("2회 모두 실패");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
