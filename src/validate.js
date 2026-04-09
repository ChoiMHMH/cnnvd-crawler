/**
 * 수집된 데이터 항목의 필수 필드를 검증합니다.
 * 검증 실패 항목은 스킵하고 로그를 출력합니다.
 * 마지막에 성공/실패 summary를 출력합니다.
 * @param {Array<Object>} items - 검증할 데이터 배열
 * @param {Object} [options]
 * @param {Array<{field: string, check: 'string'|'array'}>} [options.requiredFields] - 필수 필드 목록
 * @returns {Array<Object>} 유효한 데이터만 포함한 배열
 */
export function validate(items, { requiredFields } = {}) {
  const fields = requiredFields ?? [
    { field: "detailTitle", check: "string" },
    { field: "detailSubtitle", check: "string" },
    { field: "contents", check: "array" },
  ];

  let successCount = 0;
  let failCount = 0;
  const valid = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const failures = [];

    for (const { field, check } of fields) {
      if (check === "array") {
        if (!Array.isArray(item[field]) || item[field].length === 0) failures.push(field);
      } else {
        if (!item[field]?.trim()) failures.push(field);
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
