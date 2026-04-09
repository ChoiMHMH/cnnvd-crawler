export interface FieldCheck {
  field: string;
  check: "string" | "array";
}

export interface ValidateOptions {
  requiredFields?: FieldCheck[];
}

const DEFAULT_FIELDS: FieldCheck[] = [
  { field: "detailTitle", check: "string" },
  { field: "detailSubtitle", check: "string" },
  { field: "contents", check: "array" },
];

/**
 * 수집된 데이터 항목의 필수 필드를 검증합니다.
 */
export function validate<T extends Record<string, unknown>>(
  items: T[],
  { requiredFields }: ValidateOptions = {},
): T[] {
  const fields = requiredFields ?? DEFAULT_FIELDS;

  let successCount = 0;
  let failCount = 0;
  const valid: T[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const failures: string[] = [];

    for (const { field, check } of fields) {
      if (check === "array") {
        const val = item[field];
        if (!Array.isArray(val) || val.length === 0) failures.push(field);
      } else {
        const val = item[field];
        if (typeof val !== "string" || !val.trim()) failures.push(field);
      }
    }

    if (failures.length > 0) {
      console.warn(
        `[validate] 항목 ${i + 1} 스킵 — 빈 필드: ${failures.join(", ")}`,
      );
      failCount++;
    } else {
      valid.push(item);
      successCount++;
    }
  }

  console.log(
    `[validate] 검증 완료 — 성공 ${successCount}건 / 실패 ${failCount}건`,
  );
  return valid;
}
