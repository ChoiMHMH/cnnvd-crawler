import fs from "fs/promises";
import path from "path";

const OUTPUT_PATH = path.resolve("output/result.json");

export interface SaveOptions {
  dedupKey?: (item: Record<string, unknown>) => string | undefined;
}

/**
 * 번역·검증된 데이터를 JSON 파일에 저장합니다.
 */
export async function save(
  items: Record<string, unknown>[],
  outputPath: string = OUTPUT_PATH,
  { dedupKey: customDedupKey }: SaveOptions = {},
): Promise<void> {
  let existing: Record<string, unknown>[] = [];
  try {
    const raw = await fs.readFile(outputPath, "utf-8");
    existing = JSON.parse(raw);
  } catch {
    // 파일이 없거나 파싱 실패 → 새로 시작
  }

  const dedupKey = customDedupKey ??
    ((item: Record<string, unknown>) =>
      (item.originalSubtitle as string | undefined) ?? (item.detailSubtitle as string | undefined));

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
