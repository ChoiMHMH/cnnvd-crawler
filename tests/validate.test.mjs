import { describe, it, expect, vi } from "vitest";
import { validate } from "../src/validate.js";

// console 출력 억제
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});

function makeItem(overrides = {}) {
  return {
    detailTitle: "테스트 제목",
    detailSubtitle: "发布时间：2026-04-03",
    contents: [{ type: "paragraph", text: "본문 내용" }],
    table: "col1 + col2",
    ...overrides,
  };
}

describe("validate", () => {
  // V1: 정상
  it("유효한 항목을 통과시킨다", () => {
    const result = validate([makeItem()]);
    expect(result).toHaveLength(1);
    expect(result[0].detailTitle).toBe("테스트 제목");
  });

  // V2: title 빈 문자열
  it("빈 detailTitle이면 스킵한다", () => {
    const result = validate([makeItem({ detailTitle: "" })]);
    expect(result).toHaveLength(0);
  });

  // V3: subtitle 빈 문자열
  it("빈 detailSubtitle이면 스킵한다", () => {
    const result = validate([makeItem({ detailSubtitle: "" })]);
    expect(result).toHaveLength(0);
  });

  // V4: contents 빈 배열
  it("빈 contents 배열이면 스킵한다", () => {
    const result = validate([makeItem({ contents: [] })]);
    expect(result).toHaveLength(0);
  });

  // V5: 필드가 undefined
  it("필드가 undefined이면 스킵한다", () => {
    const result = validate([{ detailTitle: undefined, detailSubtitle: undefined, contents: undefined }]);
    expect(result).toHaveLength(0);
  });

  // V6: 공백만 있는 문자열
  it("공백만 있는 detailTitle이면 스킵한다", () => {
    const result = validate([makeItem({ detailTitle: "   " })]);
    expect(result).toHaveLength(0);
  });

  // V7: 전부 빈 경우
  it("모든 필드가 비어있으면 스킵하고 빈 필드 3개를 로그에 남긴다", () => {
    const warnSpy = vi.spyOn(console, "warn");
    validate([{ detailTitle: "", detailSubtitle: "", contents: [] }]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("detailTitle, detailSubtitle, contents"),
    );
  });

  // V8: 빈 배열 입력
  it("빈 배열 입력 시 빈 배열을 반환한다", () => {
    const result = validate([]);
    expect(result).toHaveLength(0);
  });

  // V9: summary 정확성
  it("성공/실패 건수를 정확히 로그에 출력한다", () => {
    const logSpy = vi.spyOn(console, "log");
    validate([makeItem(), makeItem({ detailTitle: "" }), makeItem()]);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("성공 2건 / 실패 1건"),
    );
  });
});
