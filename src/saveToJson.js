import fs from "fs/promises";
import path from "path";

const OUTPUT_PATH = path.resolve("output/result.json");

/**
 * 번역·검증된 데이터를 JSON 파일에 저장합니다.
 * - dedupKey 함수 기준으로 중복을 방지합니다.
 * - 저장 시 각 항목에 timestamp를 추가합니다.
 * @param {Array<Object>} items - 저장할 데이터 배열
 * @param {string} [outputPath] - 저장 경로 (기본값: output/result.json)
 * @param {Object} [options]
 * @param {Function} [options.dedupKey] - 중복 판별 키 함수
 */
export async function save(items, outputPath = OUTPUT_PATH, { dedupKey: customDedupKey } = {}) {
  let existing = [];
  try {
    const raw = await fs.readFile(outputPath, "utf-8");
    existing = JSON.parse(raw);
  } catch {
    // 파일이 없거나 파싱 실패 → 새로 시작
  }

  const dedupKey = customDedupKey ?? ((item) => item.originalSubtitle ?? item.detailSubtitle);
  const existingKeys = new Set(existing.map(dedupKey));
  const timestamp = new Date().toISOString();
  let addedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    const key = dedupKey(item);
    if (existingKeys.has(key)) {
      console.log(`[save] 중복 스킵: ${key}`);
      skippedCount++;
    } else {
      existing.push({ ...item, savedAt: timestamp });
      existingKeys.add(key);
      addedCount++;
    }
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(existing, null, 2), "utf-8");

  console.log(
    `[save] 저장 완료 — 신규 ${addedCount}건 추가, 중복 ${skippedCount}건 스킵 → ${outputPath}`,
  );
}
