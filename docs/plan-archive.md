# 완료된 Phase 기록 (plan-archive.md)

> plan.md에서 완료된 Phase의 상세 내용을 이동한 아카이브 문서.
> 각 Phase의 배경, 문제 정의, 대안 검토, 트레이드오프, 실측 수치를 보존한다.

---

## Phase 1 — Playwright 전환 ✅

### 배경

현재 Puppeteer를 사용 중이다. Playwright는 auto-waiting 내장, 네트워크 인터셉트 API, 더 풍부한 로케이터 API를 제공한다. `BaseCrawler` 추상화 덕분에 `launch()` 구현부만 교체하면 나머지 코드는 그대로 유지할 수 있는 구조가 이미 갖춰져 있다.

**Playwright를 테스트보다 먼저 전환하는 이유:**
Playwright로 전환하면 `@playwright/test` 러너를 E2E 테스트에 바로 사용할 수 있다. Puppeteer 상태에서 테스트를 먼저 작성하면, Playwright 전환 시 E2E 테스트를 다시 작성해야 한다. 인프라 교체를 먼저 완료하고 그 위에 테스트를 쌓는 것이 재작업을 줄인다.

### 문제 정의

| 문제 | 현재 Puppeteer 상황 |
|------|-------------------|
| 수동 waitForSelector 관리 | 모든 네비게이션 후 직접 명시 필요 |
| 네트워크 인터셉트 제한 | 요청 가로채기·모킹이 Playwright 대비 불편 |
| 멀티브라우저 테스트 불가 | Chromium 전용 |
| 테스트 통합 | Playwright Test runner가 E2E에 더 적합 |

### 작업 목록

- [x] `BaseCrawler.mjs`의 `launch()` / `close()` Playwright로 교체
  - `chromium.launch()` → `browser.newContext()` → `context.newPage()` 흐름 적용
  - `withTimeout` 타이머 누수 수정 (`finally { clearTimeout(timer) }`)
- [x] `navigate()` 메서드: Playwright 방식으로 조정
  - `waitUntil: "networkidle"` (Playwright에서는 `"networkidle"`로 통합됨)
- [x] `CnnvdCrawler.mjs`: `$$eval` → `evaluate()` 교체
  - Playwright `evaluate`는 인자 1개만 허용 → 객체로 래핑하여 전달
  - `SELECTORS` 전체 전달 시 함수(`PAGINATION_ITEM_N`)가 직렬화 불가 → 필요한 문자열 셀렉터만 추출하여 전달
- [x] `package.json`: `puppeteer` 제거 → `playwright` 추가
- [ ] 실행 시간 before/after 측정 (Puppeteer vs Playwright, 20건 기준)
- [x] GitHub Actions: `npx puppeteer browsers install chrome` → `npx playwright install chromium --with-deps` 변경

### API 변환 매핑

| Puppeteer | Playwright | 비고 |
|-----------|-----------|------|
| `puppeteer.launch()` | `chromium.launch()` | import 변경 |
| `browser.newPage()` | `browser.newContext()` → `context.newPage()` | context 계층 추가 |
| `page.$$eval(sel, fn)` | `page.evaluate(fn)` 또는 `page.locator(sel).evaluateAll(fn)` | `$$eval` 미제공 |
| `page.waitForSelector(sel)` | `page.waitForSelector(sel)` | 동일 (auto-waiting이 대부분 대체) |
| `page.goto(url, {waitUntil})` | `page.goto(url, {waitUntil})` | 옵션값만 다름 |
| `page.click(sel)` | `page.click(sel)` | 동일 |
| `page.evaluate(fn)` | `page.evaluate(fn)` | 동일 |

### 대안 검토

| 방안 | 장점 | 단점 | 결정 |
|------|------|------|------|
| Puppeteer 유지 | 현재 동작, 코드 변경 없음 | auto-waiting 없음, 테스트 통합 약함 | 탈락 |
| Playwright 전환 | auto-waiting, 네트워크 인터셉트, Playwright Test | 마이그레이션 공수 (예상 ~2시간) | **채택** |
| Playwright + Puppeteer 병행 | 점진적 전환 가능 | 의존성 중복, 두 API 혼재로 혼란 | 탈락 |

**결정**: Playwright 단독 전환. `BaseCrawler` 추상화로 교체 범위가 2개 파일(BaseCrawler, CnnvdCrawler)로 격리되어 있어 교체 비용이 낮다.

### 실측 before/after

| 항목 | Before (Puppeteer) | After (Playwright) |
|------|-------------------|-------------------|
| 수동 waitForSelector 호출 수 | navigate마다 필수 | auto-waiting으로 일부 제거 |
| 네트워크 인터셉트 | 제한적 | `page.route()` API |
| E2E 테스트 러너 | 없음 (별도 설정 필요) | `@playwright/test` 바로 사용 |
| 실행 시간 (20건) | 측정 예정 | 측정 후 비교 기록 |
| 변경 파일 수 | — | 3개 (BaseCrawler, CnnvdCrawler, package.json) |

### 트레이드오프

- Playwright는 패키지 크기가 Puppeteer보다 큼 (브라우저 번들 포함)
- `$$eval` 패턴이 사라지고 `locator` API로 변경되어 기존 코드 패턴이 달라짐
- 그러나 `BaseCrawler` 추상화 덕분에 교체 범위가 명확하게 격리되어 있음
- auto-waiting이 내장되면 `waitForSelector`를 직접 관리하는 수고가 줄어 장기적으로 코드가 단순해짐

---

## Phase 1.5 — extractDetail 구조 변경 ✅

> Playwright 전환 직후, 테스트 작성 직전에 수행.
> 이 작업만 Phase 2 이전에 분리하는 이유: `extractDetail`의 반환 타입이 HTML 문자열 → `{type, text}[]`로 바뀌는 **인터페이스 변경**이기 때문이다. 기존 반환 타입이 바뀌면 테스트의 기대값 자체가 달라지므로, TDD로 접근할 수 없다 (먼저 "올바른 반환 형태"를 확정해야 테스트를 쌓을 수 있다).

### 발견된 취약점 목록 (전체)

코드 리뷰에서 발견한 6개 항목. 이 Phase에서는 `extractDetail` 구조 변경만 수행하고, 나머지는 Phase 2에서 TDD로 수정.

| 우선순위 | 항목 | 유형 | 위치 | 처리 시점 |
|---------|------|------|------|----------|
| **높음** | withTimeout 타이머 누수 | 버그 | `BaseCrawler.mjs:82-92` | Phase 2 (TDD) ✅ |
| **높음** | 중복 키가 번역된 텍스트 기반 | 로직 결함 | `saveToJson.js:22` | Phase 2 (TDD) ✅ |
| **중간** | extractDetail에서 HTML 스타일 직접 삽입 | 인터페이스 변경 | `CnnvdCrawler.mjs:99-106` | 이 Phase ✅ |
| **중간** | table 셀렉터 미분리 + 범위 제한 없음 | 버그 + 일관성 | `CnnvdCrawler.mjs:121` | Phase 2 (TDD) ✅ |
| **낮음** | 번역 concurrency 제어 없음 | 확장성 | `translate.js:42-48` | Phase 3 이후 |
| **낮음** | PAGE_COUNT 등 설정 하드코딩 | 유연성 | `CnnvdCrawler.mjs:5-6` | Phase 3 이후 |

---

### extractDetail에서 HTML 스타일 직접 삽입

**문제**: `CnnvdCrawler.mjs:99-106`에서 `<div class="font-extrabold mt-3 mb-1">`같은 Tailwind 클래스를 크롤러 안에서 직접 삽입하고 있다. 크롤러의 책임은 데이터 수집이고, 프레젠테이션 스타일링은 출력/렌더링 단계에서 해야 한다.

**현재**:
```js
sections.push(`<div class="font-extrabold mt-3 mb-1">${tagText}</div>`);
```

**수정안**: 구조화된 데이터로 반환하고, HTML 변환은 별도 단계에서 처리한다.
```js
// 크롤러에서 반환하는 데이터
{ type: "heading", text: "一、漏洞介绍" }
{ type: "paragraph", text: "Cisco Catalyst..." }
```

**왜 TDD로 할 수 없는가**:
- 반환 타입 자체가 `string` → `{ type, text }[]`로 변경됨
- "기존 동작을 검증하는 테스트"를 먼저 쓰면 HTML 문자열을 기대값으로 고정하게 되고, 구조 변경 시 테스트를 전면 재작성해야 함
- 반면 withTimeout 누수나 dedup 키 문제는 반환 타입이 그대로이므로 TDD 가능

**트레이드오프**:
- 기존 output/result.json의 데이터 구조가 바뀜 → 하위 호환 깨짐
- 그러나 현재 소비자가 없으므로 (result.json을 읽는 프론트엔드 없음) 지금이 바꿀 적기
- 구조화된 데이터는 번역 단계에서도 heading/paragraph를 구분해서 처리 가능
- extractDetail 구조 변경은 translate.js에도 영향 (contents가 문자열 → 배열로 바뀜)

### 작업 목록

- [x] `extractDetail` 반환 구조를 `{ type, text }[]` 형태로 변경 (`CnnvdCrawler.mjs`)
- [x] `translate.js` — contents가 배열로 바뀜에 따라 번역 로직 수정
  - `translateContents()` 함수 추가: 배열의 각 요소를 `Promise.all`로 병렬 번역
  - 결정: heading/paragraph 동일하게 번역 (짧은 텍스트는 API가 자연스럽게 처리)
  - 결정: `table` 필드는 현재 단계에서 구조화하지 않음 (Phase 2에서 재검토)
- [x] `validate.js` — contents 검증 로직을 배열 기반으로 수정
- [x] 수정 후 파이프라인 실행해서 정상 동작 확인 (20건 수집, 9건 검증 통과)
- [x] result.json 데이터 구조 변경 확인

### 실측 before/after

| 항목 | Before | After |
|------|--------|-------|
| extractDetail 반환값 | HTML 문자열 (Tailwind 클래스 포함) | 구조화 데이터 `{ type, text }[]` |
| translate.js contents 처리 | `translateText(string)` 1회 호출 | `translateContents([])` — 요소별 병렬 번역 |
| validate.js contents 검증 | `!item.contents?.trim()` | `!Array.isArray(item.contents) \|\| item.contents.length === 0` |

---

## Phase 2 — 테스트 코드 작성 + 버그 수정 (TDD) ✅

### 배경

현재 파이프라인에 테스트 코드가 전혀 없다. 정상 흐름에서는 보이지 않던 엣지 케이스(본문 없는 항목 12건)가 실제 실행에서 발견됐다. 검증 로직(`validate.js`)과 저장 로직(`saveToJson.js`)은 이미 브라우저와 분리되어 있어 픽스처 기반 단위 테스트가 바로 가능한 구조다.

### TDD로 버그 수정을 함께 진행하는 이유

Phase 1.5에서 분리된 취약점 중 **인터페이스가 바뀌지 않는 버그**는 TDD로 접근한다:
1. 현재의 **잘못된 동작을 검증하는 실패 테스트**를 먼저 작성한다 (Red)
2. 코드를 수정해서 테스트를 통과시킨다 (Green)
3. 필요하면 리팩토링한다 (Refactor)

이렇게 하면 "왜 이 수정이 필요한지"가 테스트로 문서화되고, 회귀 방지도 자동으로 확보된다.

### TDD 접근 방식 선택 — 대안 검토

| 접근 방식 | 설명 | 장점 | 단점 | 결정 |
|-----------|------|------|------|------|
| **코드 먼저, 테스트 나중** (code-first) | 버그를 먼저 수정하고 테스트를 사후에 작성 | 익숙한 흐름, 즉시 수정 가능 | "왜 이 테스트가 필요한가"가 불명확, 테스트가 수정 이유를 문서화하지 못함, 테스트 작성을 건너뛰기 쉬움 | 탈락 |
| **TDD (Red → Green → Refactor)** | 실패 테스트를 먼저 작성하고 코드를 수정해서 통과시킴 | 수정 이유가 테스트로 문서화됨, 회귀 방지 자동 확보, "이 버그가 재발하면 이 테스트가 잡는다"는 보장 | 인터페이스가 바뀌는 경우 적용 불가 (기대값을 확정할 수 없음) | **채택** |
| **테스트 없이 수정** (no-test) | 버그만 수정하고 테스트 생략 | 가장 빠름 | 회귀 감지 불가, 동일 버그 재발 시 다시 디버깅 필요 | 탈락 |

**TDD가 적용 가능한 조건**: 반환 타입(인터페이스)이 변경되지 않는 버그. 인터페이스가 바뀌면 "올바른 기대값"을 먼저 확정할 수 없으므로 TDD가 불가능하다 — Phase 1.5의 `extractDetail` 구조 변경이 이 경우에 해당한다.

**TDD가 적용 불가능한 경우의 대안**: 인터페이스를 먼저 확정(Phase 1.5)한 뒤, 새 인터페이스 기준으로 테스트를 작성한다. 순서가 "설계 → 구현 → 테스트"가 되며, 이것은 TDD가 아니라 일반적인 테스트 작성이다.

#### 이 Phase에서 TDD로 수정한 취약점

| 항목 | TDD 접근 |
|------|----------|
| **withTimeout 타이머 누수** | 타이머 누수를 감지하는 테스트 작성 → `finally { clearTimeout(timer) }` 패턴으로 수정 |
| **중복 키가 번역된 텍스트 기반** | 번역 결과가 달라져도 중복 감지하는 테스트 작성 → `originalSubtitle` 필드 도입 |
| **table 셀렉터 미분리 + 범위 제한 없음** | `document.querySelectorAll("table tbody tr")`이 페이지 전체 table을 긁는 버그 — `detailContent` 내부로 범위 제한 + 셀렉터를 `selectors.js`로 이동 |

Phase 1에서 Playwright 전환을 완료한 뒤 테스트를 작성하는 이유:
- 단위 테스트(validate, saveToJson)는 브라우저 무관이므로 전환 순서에 영향 없음
- E2E 테스트(CnnvdCrawler)는 Playwright 전환 후 `@playwright/test`로 바로 작성 가능
- Puppeteer 상태에서 E2E를 먼저 쓰면 전환 시 재작성 필요 → 낭비

### 테스트 도구 선택 — 두 가지 도구 병용

테스트 종류마다 최적 도구가 다르다. 하나로 통일하면 한쪽이 반드시 비효율적이 된다.

| 테스트 종류 | 대상 모듈 | 도구 | 이유 |
|------------|----------|------|------|
| **단위 테스트** | validate.js, saveToJson.js, translate.js | **vitest** | 브라우저 불필요, ESM 네이티브, 100ms 내 실행, TS 전환 시에도 설정 변경 없음 |
| **E2E 테스트** | CnnvdCrawler (실제 브라우저 동작) | **@playwright/test** | 브라우저 컨텍스트 필요, auto-waiting 내장, 네트워크 모킹 통합 |

#### 왜 Playwright Test 하나로 통일하지 않는가?

| 방안 | 장점 | 단점 | 결정 |
|------|------|------|------|
| **Playwright Test만** | 도구 1개, 설정 단순 | 단위 테스트에 브라우저 불필요한데 무거운 러너 사용, 실행 느림 | 탈락 |
| **vitest만** | 도구 1개, 빠름 | 브라우저 E2E 불가, 별도 브라우저 연동 설정 필요 | 탈락 |
| **vitest + @playwright/test** | 각 영역 최적 도구, 단위는 빠르고 E2E는 브라우저 내장 | 도구 2개 관리 필요 | **채택** |

#### vitest를 선택한 이유 (단위 테스트)

| 프레임워크 | 장점 | 단점 | 결정 |
|-----------|------|------|------|
| `node:test` (내장) | 의존성 없음 | assert API 불편, watch 모드 미흡, 커버리지 설정 복잡 | 탈락 |
| `vitest` | ESM 네이티브, `.mjs` 그대로 사용, 빠름, TypeScript 전환 시 설정 변경 없음 | 의존성 추가 | **채택** |
| `jest` | 레퍼런스 많음 | ESM 설정 복잡, `--experimental-vm-modules` 필요 | 탈락 |

### 문제 정의

| 문제 | 영향 |
|------|------|
| 테스트 없음 | 셀렉터 변경, 검증 규칙 변경 시 회귀 감지 불가 |
| 엣지 케이스 미정의 | 빈 본문, 빈 제목, subtitle 중복 등 경계값 처리가 코드에만 존재 |
| CI에서 테스트 미실행 | GitHub Actions가 배포만 하고 검증은 안 함 |

### 엣지 케이스 사전 분석

코드를 작성하기 전에 먼저 엣지 케이스를 정의한다. 이 목록이 곧 테스트 명세가 된다.

#### validate.js 엣지 케이스

| # | 케이스 | 입력 | 기대 결과 |
|---|--------|------|-----------|
| V1 | 정상 | title, subtitle, contents 모두 존재 | 통과 |
| V2 | title 빈 문자열 | `{ detailTitle: "", ... }` | 스킵 |
| V3 | subtitle 빈 문자열 | `{ detailSubtitle: "", ... }` | 스킵 |
| V4 | contents 빈 문자열 | `{ contents: "", ... }` | 스킵 (실제 실행에서 12건 발생) |
| V5 | 필드가 아예 없음 (undefined) | `{ detailTitle: undefined }` | 스킵 |
| V6 | 공백만 있는 문자열 | `{ detailTitle: "   ", ... }` | 스킵 (trim 후 빈값) |
| V7 | 전부 빈 경우 | 모든 필드 빈 문자열 | 스킵, 빈 필드 3개 로그 |
| V8 | 빈 배열 입력 | `[]` | 빈 배열 반환, 성공 0 / 실패 0 |
| V9 | summary 정확성 | 3건 중 1건 실패 | "성공 2건 / 실패 1건" |

#### saveToJson.js 엣지 케이스

| # | 케이스 | 입력 | 기대 결과 |
|---|--------|------|-----------|
| S1 | 신규 저장 | 기존 파일 없음 + 데이터 2건 | 2건 저장, timestamp 포함 |
| S2 | 중복 스킵 | 기존 파일에 동일 subtitle 존재 | 중복 건 스킵, 신규만 추가 |
| S3 | 완전 중복 | 모든 항목이 이미 존재 | 0건 추가 |
| S4 | output 폴더 없음 | output/ 디렉토리 미존재 | 자동 생성 후 저장 |
| S5 | 기존 파일 JSON 파싱 실패 | 손상된 파일 | 빈 배열로 초기화 후 저장 |
| S6 | timestamp 형식 | 저장 후 읽기 | ISO 8601 형식 (`savedAt`) |

#### CnnvdCrawler E2E 엣지 케이스 (Playwright Test)

| # | 케이스 | 상황 | 기대 결과 |
|---|--------|------|-----------|
| E1 | 정상 수집 | 1페이지 1항목 | detailTitle, detailSubtitle, contents 존재 |
| E2 | 본문 없는 항목 | 상세 페이지에 detail-content 비어있음 | contents 빈 문자열 (크래시 없음) |
| E3 | 네트워크 타임아웃 | 페이지 로딩 지연 | retry로 재시도, 최종 실패 시 에러 throw |
| E4 | 셀렉터 불일치 | DOM 구조 변경 시뮬레이션 | waitForSelector 타임아웃, 에러 로그 |

### 작업 목록

**환경 세팅**
- [x] vitest 설치 및 설정
- [x] 테스트 픽스처 — 별도 fixture 파일 대신 테스트 내 `makeItem()` 헬퍼 함수로 처리 (파일 I/O 없이 더 간결)

**TDD로 버그 수정 (Red → Green → Refactor)**
- [x] `withTimeout` 타이머 누수 — Phase 1에서 코드 수정 완료, 이번 Phase에서 테스트 4개 작성 (성공·실패 시 clearTimeout 호출 검증)
- [x] 중복 키 문제 — TDD Red: 번역 결과 다를 때 중복 감지 실패 테스트 작성 → Green: `originalSubtitle` 필드 도입 (`CnnvdCrawler.mjs` + `saveToJson.js`)
  - `saveToJson.js`: `dedupKey()` 함수로 `originalSubtitle ?? detailSubtitle` 우선순위 적용
  - `CnnvdCrawler.mjs`: `extractDetail` 반환값에 `originalSubtitle` 필드 추가
  - `translate.js`: `...item` spread로 `originalSubtitle` 자동 보존 (변경 불필요)
- [x] `table tbody tr` 셀렉터를 `selectors.js`로 분리 → `DETAIL_TABLE_ROWS: ".detail-content table tbody tr"` (범위를 detail-content 내부로 제한)

**나머지 테스트 작성**
- [x] `validate.js` 단위 테스트 작성 (V1~V9) — 9개 통과
- [x] `saveToJson.js` 단위 테스트 작성 (S1~S7) — 7개 통과 (S7: originalSubtitle 중복 감지 추가)
- [x] `BaseCrawler` 단위 테스트 작성 (withTimeout 4개 + retry 3개) — 7개 통과
- [ ] `@playwright/test`로 E2E 테스트 작성 (E1~E4) — Phase 3 이후로 이동 (사이트 의존 테스트는 크롤러 추가 후 일괄 작성)
- [x] `package.json`에 `test`, `test:unit`, `test:watch` 스크립트 추가
- [x] GitHub Actions에 단위 테스트 스텝 추가 (`npm test`)

### 실측 before/after

| 항목 | Before | After |
|------|--------|-------|
| 테스트 파일 수 | 0개 | 3개 (validate, saveToJson, BaseCrawler) |
| 테스트 케이스 수 | 0개 | **23개** (V9 + S7 + B7) |
| 테스트 실행 시간 | — | ~920ms |
| CI 테스트 실행 | 없음 | Actions에서 자동 실행 |
| 하드코딩 셀렉터 | 1개 (`table tbody tr`) | **0개** (전부 selectors.js) |
| 중복 키 안정성 | 불안정 (번역 결과 의존) | **안정** (originalSubtitle) |
| 회귀 감지 | 불가 | 즉시 감지 |

### 트레이드오프

- 도구가 2개(vitest + Playwright Test)라 설정 파일이 늘어남
- 그러나 단위 테스트를 Playwright로 돌리면 불필요하게 느리고, E2E를 vitest로 돌리면 브라우저 연동이 복잡해짐
- 각 도구가 최적인 영역에서만 사용하는 것이 장기 유지보수에 유리함
- TypeScript 전환(Phase 4) 시 vitest는 설정 변경 없이 그대로 사용 가능

---

## Phase 3-A — BooksCrawler 추가 (BaseCrawler 확장성 검증) ✅

### 배경

현재는 크롤러가 `CnnvdCrawler` 하나뿐이었다. `BaseCrawler` 추상화가 실제로 재사용 가능한 구조인지 검증하려면, 성격이 다른 두 번째 크롤러를 추가해 신규 사이트 대응 비용을 측정할 필요가 있었다.

실서비스 이커머스 후보로 검토한 1688.com과 Alibaba.com은 headless 브라우저 기준 `목록 → 상세` 수집 흐름이 안정적으로 재현되지 않았다. 따라서 Phase 3-A의 목적은 실서비스 수집 성공이 아니라, 제어 가능한 사이트에서 구조 확장성을 검증하는 것으로 한정했다.

### 대상 사이트 결정

| 사이트 | 장점 | 단점 | 결정 |
|--------|------|------|------|
| **books.toscrape.com** | 목록→상세 구조, 가격/재고/카테고리 등 상품성 데이터, 차단 없음 | 실서비스 아님 | **채택** |
| **AliExpress** | 실서비스 이커머스 | 차단/불안정 가능성 | 예비 후보 |

### 문제 정의

`BaseCrawler`가 있더라도 실제로 새 크롤러를 붙일 때 공통 인프라를 재사용할 수 있는지, 그리고 기존 파이프라인 모듈을 최소 수정으로 재활용할 수 있는지를 검증해야 했다.

검증 포인트:
- `BaseCrawler` 수정 없이 두 번째 크롤러 추가가 가능한가
- 셀렉터를 별도 파일로 분리해 사이트 차이를 격리할 수 있는가
- `validate`, `save`를 사이트별 데이터 스키마에 맞게 재사용할 수 있는가
- 테스트 추가 시 기존 구조를 깨지 않고 안전망을 확장할 수 있는가

### 작업 목록

- [x] `books.toscrape.com` 셀렉터 조사 및 데이터 스키마 정의
- [x] `BooksCrawler` 작성 — `BaseCrawler` 상속
- [x] `extractList()` / `extractDetail()` 구현
- [x] 기존 파이프라인(검증 → 저장) 재사용 연결
- [x] BooksCrawler 실행 테스트
- [x] BooksCrawler 테스트 추가
- [x] before/after 수치 업데이트

### 구현 결과

- 신규 파일 3개: `booksSelectors.js`, `BooksCrawler.mjs`, `BooksCrawler.test.mjs`
- 기존 파일 수정 2개: `validate.js` (필수 필드 옵션화), `saveToJson.js` (dedupKey 옵션화)
- 진입점 추가 1개: `index.books.mjs`
- `BaseCrawler`의 `launch()`, `close()`, `navigate()`, `retry()`, `withTimeout()` 전부 재사용 — 수정 0줄
- `validate`, `save` 모듈은 옵션 파라미터 추가만으로 재사용
- 테스트 5건 추가 (총 28건)

### 실측 before/after

| 항목 | Phase 2 후 | Phase 3-A 후 |
|------|-----------|--------------|
| 파일 수 | 9 | **14** (src 8 + test 4 + entry 2) |
| 총 줄 수 | 697 | **995** (src 654 + test 341) |
| 하드코딩 셀렉터 | 0 | **0** 유지 |
| 테스트 케이스 수 | 23개 | **28개** |
| 중복 키 안정성 | `originalSubtitle` 기반 | **dedupKey 옵션화** |

### 트레이드오프

- 구조 확장성 검증에는 성공했지만, 실서비스 이커머스 접근성 자체를 증명한 것은 아니다.
- `BaseCrawler`와 후처리 모듈은 재사용했지만, 실행 진입점은 `index.mjs`와 `index.books.mjs`로 분리되었다.
- 현재는 진입점이 2개뿐이라 즉시 문제가 되지는 않지만, 신규 크롤러가 늘어나면 파이프라인 조립 코드가 반복될 가능성이 있다.

### 후속 작업으로 Phase 3-A-2를 추가한 이유

Phase 3-A 완료 후 구조 리뷰 결과, 재사용이 다음 두 층으로 나뉜다는 점이 확인됐다.

1. 크롤러 인프라 재사용
   - `BaseCrawler`의 브라우저 생명주기, 네비게이션, 재시도, 타임아웃은 잘 재사용됨
2. 파이프라인 진입점 재사용
   - `validate`, `save`는 옵션화로 재사용했지만, 실행 진입점은 사이트별 파일로 분리됨

이 상태는 잘못된 설계는 아니지만, 세 번째 크롤러부터는 "구조 재사용"보다 "파이프라인 조립 코드 복제"로 읽힐 수 있다. 변경 범위가 작고 테스트 28개가 안전망 역할을 하므로, Phase 3-B 전에 `runCrawlerPipeline + pipelineConfigs` 구조로 진입점 재사용을 정리하는 `Phase 3-A-2`를 추가하기로 결정했다.
