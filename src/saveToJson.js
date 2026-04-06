import fs from "fs/promises";
import path from "path";

const OUTPUT_PATH = path.resolve("output/result.json");

/**
 * 번역·검증된 데이터를 output/result.json에 저장합니다.
 * - detailSubtitle 기준으로 중복을 방지합니다.
 * - 저장 시 각 항목에 timestamp를 추가합니다.
 * @param {Array<Object>} items - 저장할 데이터 배열
 */
export async function save(items) {
  // 기존 파일 읽기 (없으면 빈 배열)
  let existing = [];
  try {
    const raw = await fs.readFile(OUTPUT_PATH, "utf-8");
    existing = JSON.parse(raw);
  } catch {
    // 파일이 없거나 파싱 실패 → 새로 시작
  }

  const existingSubtitles = new Set(existing.map((item) => item.detailSubtitle));
  const timestamp = new Date().toISOString();
  let addedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    if (existingSubtitles.has(item.detailSubtitle)) {
      console.log(`[save] 중복 스킵: ${item.detailSubtitle}`);
      skippedCount++;
    } else {
      existing.push({ ...item, savedAt: timestamp });
      existingSubtitles.add(item.detailSubtitle);
      addedCount++;
    }
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(existing, null, 2), "utf-8");

  console.log(
    `[save] 저장 완료 — 신규 ${addedCount}건 추가, 중복 ${skippedCount}건 스킵 → ${OUTPUT_PATH}`,
  );
}
