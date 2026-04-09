import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { save } from "../src/saveToJson.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

vi.spyOn(console, "log").mockImplementation(() => {});

let tmpDir: string;
let outputPath: string;

function makeItem(subtitle: string = "发布时间：2026-04-03") {
  return {
    detailTitle: "제목",
    detailSubtitle: subtitle,
    contents: [{ type: "paragraph", text: "본문" }],
    table: "col1 + col2",
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "save-test-"));
  outputPath = path.join(tmpDir, "output", "result.json");
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("save", () => {
  it("기존 파일 없을 때 데이터를 저장한다", async () => {
    await save([makeItem("sub1"), makeItem("sub2")], outputPath);

    const data = JSON.parse(await fs.readFile(outputPath, "utf-8"));
    expect(data).toHaveLength(2);
    expect(data[0].detailSubtitle).toBe("sub1");
    expect(data[1].detailSubtitle).toBe("sub2");
  });

  it("기존 파일에 동일 subtitle이 있으면 스킵한다", async () => {
    await save([makeItem("sub1")], outputPath);
    await save([makeItem("sub1"), makeItem("sub2")], outputPath);

    const data = JSON.parse(await fs.readFile(outputPath, "utf-8"));
    expect(data).toHaveLength(2);
  });

  it("모든 항목이 이미 존재하면 0건 추가", async () => {
    await save([makeItem("sub1")], outputPath);
    await save([makeItem("sub1")], outputPath);

    const data = JSON.parse(await fs.readFile(outputPath, "utf-8"));
    expect(data).toHaveLength(1);
  });

  it("output 디렉토리가 없으면 자동 생성한다", async () => {
    const deepPath = path.join(tmpDir, "deep", "nested", "result.json");
    await save([makeItem()], deepPath);

    const data = JSON.parse(await fs.readFile(deepPath, "utf-8"));
    expect(data).toHaveLength(1);
  });

  it("기존 파일이 손상되면 빈 배열로 초기화 후 저장한다", async () => {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, "NOT VALID JSON", "utf-8");

    await save([makeItem()], outputPath);

    const data = JSON.parse(await fs.readFile(outputPath, "utf-8"));
    expect(data).toHaveLength(1);
  });

  it("저장 시 ISO 8601 형식의 savedAt을 추가한다", async () => {
    await save([makeItem()], outputPath);

    const data = JSON.parse(await fs.readFile(outputPath, "utf-8"));
    expect(data[0].savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("번역된 subtitle이 달라도 originalSubtitle이 같으면 중복으로 처리한다", async () => {
    const item1 = { ...makeItem(), detailSubtitle: "게시 시간: 2026-04-03", originalSubtitle: "发布时间：2026-04-03" };
    const item2 = { ...makeItem(), detailSubtitle: "발표 시간: 2026-04-03", originalSubtitle: "发布时间：2026-04-03" };

    await save([item1], outputPath);
    await save([item2], outputPath);

    const data = JSON.parse(await fs.readFile(outputPath, "utf-8"));
    expect(data).toHaveLength(1);
  });
});
