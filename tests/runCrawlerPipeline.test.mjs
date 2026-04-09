import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runCrawlerPipeline } from "../src/core/runCrawlerPipeline.mjs";
import fs from "fs/promises";
import path from "path";
import os from "os";

vi.spyOn(console, "log").mockImplementation(() => {});

// translate 모듈 모킹
vi.mock("../src/translate.js", () => ({
  translate: vi.fn((items) =>
    Promise.resolve(items.map((i) => ({ ...i, translated: true }))),
  ),
}));

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pipeline-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeFakeCrawler(data) {
  return {
    constructor: { name: "FakeCrawler" },
    run: vi.fn().mockResolvedValue(data),
  };
}

describe("runCrawlerPipeline", () => {
  it("수집 → 검증 → 저장 파이프라인을 실행한다", async () => {
    const outputPath = path.join(tmpDir, "output.json");
    const items = [{ title: "Book A", price: "£10.00", upc: "aaa" }];

    await runCrawlerPipeline({
      crawler: makeFakeCrawler(items),
      requiredFields: [
        { field: "title", check: "string" },
        { field: "price", check: "string" },
      ],
      outputPath,
      dedupKey: (item) => item.upc,
      useTranslate: false,
    });

    const saved = JSON.parse(await fs.readFile(outputPath, "utf-8"));
    expect(saved).toHaveLength(1);
    expect(saved[0].title).toBe("Book A");
  });

  it("useTranslate가 true이면 번역을 거친다", async () => {
    const outputPath = path.join(tmpDir, "output.json");
    const items = [{ title: "测试", price: "£5.00", upc: "bbb" }];

    await runCrawlerPipeline({
      crawler: makeFakeCrawler(items),
      requiredFields: [{ field: "title", check: "string" }],
      outputPath,
      useTranslate: true,
    });

    const saved = JSON.parse(await fs.readFile(outputPath, "utf-8"));
    expect(saved[0].translated).toBe(true);
  });

  it("검증 실패 항목은 저장되지 않는다", async () => {
    const outputPath = path.join(tmpDir, "output.json");
    const items = [
      { title: "Good", price: "£10.00" },
      { title: "", price: "£10.00" }, // title 빈 값 → 실패
    ];

    vi.spyOn(console, "warn").mockImplementation(() => {});

    await runCrawlerPipeline({
      crawler: makeFakeCrawler(items),
      requiredFields: [{ field: "title", check: "string" }],
      outputPath,
      useTranslate: false,
    });

    const saved = JSON.parse(await fs.readFile(outputPath, "utf-8"));
    expect(saved).toHaveLength(1);
    expect(saved[0].title).toBe("Good");
  });
});
