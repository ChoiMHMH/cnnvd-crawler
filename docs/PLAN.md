# 작업 계획 (plan.md)

> 크롤링 파이프라인 개선 작업 계획서.
> 모든 작업은 **문제 정의 → 대안 검토 → 트레이드오프 → 수치 비교** 순서로 기록한다.

---

## 작업 원칙

1. **코드 수정 전 문제를 먼저 글로 정의한다.**
   - "왜 바꾸는가", "무엇이 문제인가"를 먼저 작성하고 작업 시작
2. **대안을 최소 2개 검토하고 탈락 이유를 남긴다.**
3. **before/after는 반드시 수치로 남긴다.**
   - 줄 수, 함수 수, 셀렉터 수, 실행 시간(ms), 테스트 커버리지(%) 등
4. **트레이드오프를 명시한다.**
   - 개선점과 함께 "이 선택의 단점 / 언제 재검토해야 하는가"를 반드시 기록
5. **작업 단위는 하나의 커밋, 하나의 목적으로 유지한다.**

---

## Phase 1 — Playwright 전환 (현재 단계)

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

### 예상 before/after

| 항목 | Before (Puppeteer) | After (Playwright) |
|------|-------------------|-------------------|
| 수동 waitForSelector 호출 수 | navigate마다 필수 | auto-waiting으로 일부 제거 |
| 네트워크 인터셉트 | 제한적 | `page.route()` API |
| E2E 테스트 러너 | 없음 (별도 설정 필요) | `@playwright/test` 바로 사용 |
| 실행 시간 (20건) | 측정 예정 | 측정 후 비교 기록 |
| 변경 파일 수 | — | 예상 3개 (BaseCrawler, CnnvdCrawler, package.json) |

### 트레이드오프

- Playwright는 패키지 크기가 Puppeteer보다 큼 (브라우저 번들 포함)
- `$$eval` 패턴이 사라지고 `locator` API로 변경되어 기존 코드 패턴이 달라짐
- 그러나 `BaseCrawler` 추상화 덕분에 교체 범위가 명확하게 격리되어 있음
- auto-waiting이 내장되면 `waitForSelector`를 직접 관리하는 수고가 줄어 장기적으로 코드가 단순해짐

---

## Phase 1.5 — extractDetail 구조 변경

> Playwright 전환 직후, 테스트 작성 직전에 수행한다.
> 이 작업만 Phase 2 이전에 분리하는 이유: `extractDetail`의 반환 타입이 HTML 문자열 → `{type, text}[]`로 바뀌는 **인터페이스 변경**이기 때문이다. 기존 반환 타입이 바뀌면 테스트의 기대값 자체가 달라지므로, TDD로 접근할 수 없다 (먼저 "올바른 반환 형태"를 확정해야 테스트를 쌓을 수 있다).

### 발견된 취약점 목록 (전체)

코드 리뷰에서 발견한 6개 항목. 이 Phase에서는 `extractDetail` 구조 변경만 수행하고, 나머지는 Phase 2에서 TDD로 수정한다.

| 우선순위 | 항목 | 유형 | 위치 | 처리 시점 |
|---------|------|------|------|----------|
| **높음** | withTimeout 타이머 누수 | 버그 | `BaseCrawler.mjs:82-92` | **Phase 2** (TDD) |
| **높음** | 중복 키가 번역된 텍스트 기반 | 로직 결함 | `saveToJson.js:22` | **Phase 2** (TDD) |
| **중간** | extractDetail에서 HTML 스타일 직접 삽입 | 인터페이스 변경 | `CnnvdCrawler.mjs:99-106` | **이번 Phase** |
| **중간** | table 셀렉터 미분리 + 범위 제한 없음 | 버그 + 일관성 | `CnnvdCrawler.mjs:121` | **Phase 2** (TDD) |
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

## Phase 2 — 테스트 코드 작성 + 버그 수정 (TDD)

### 배경

현재 파이프라인에 테스트 코드가 전혀 없다. 정상 흐름에서는 보이지 않던 엣지 케이스(본문 없는 항목 12건)가 실제 실행에서 발견됐다. 검증 로직(`validate.js`)과 저장 로직(`saveToJson.js`)은 이미 브라우저와 분리되어 있어 픽스처 기반 단위 테스트가 바로 가능한 구조다.

### TDD로 버그 수정을 함께 진행하는 이유

Phase 1.5에서 분리된 취약점 중 **인터페이스가 바뀌지 않는 버그**는 TDD로 접근한다:
1. 현재의 **잘못된 동작을 검증하는 실패 테스트**를 먼저 작성한다 (Red)
2. 코드를 수정해서 테스트를 통과시킨다 (Green)
3. 필요하면 리팩토링한다 (Refactor)

이렇게 하면 "왜 이 수정이 필요한지"가 테스트로 문서화되고, 회귀 방지도 자동으로 확보된다.

#### 이 Phase에서 TDD로 수정할 취약점

| 항목 | TDD 접근 |
|------|----------|
| **withTimeout 타이머 누수** | 타이머 누수를 감지하는 테스트 작성 → `finally { clearTimeout(timer) }` 패턴으로 수정 (아래 코드 예시 참고) |
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
- [ ] vitest 설치 및 설정
- [ ] 테스트 픽스처 준비 (`tests/fixtures/`)
  - 정상 데이터, 빈 데이터, 중복 데이터 JSON

**TDD로 버그 수정 (Red → Green → Refactor)**
- [ ] `withTimeout` 타이머 누수 — 실패 테스트 작성 → `clearTimeout` 수정 (`BaseCrawler.mjs`)
  - 수정 방향:
    ```js
    async withTimeout(fn, ms = 10000) {
      let timer;
      try {
        return await Promise.race([
          fn(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`[withTimeout] ${ms}ms 초과`)), ms);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
    ```
- [ ] 중복 키 문제 — 번역 결과 다를 때 중복 감지 실패 테스트 작성 → `originalSubtitle` 도입 (`CnnvdCrawler.mjs` + `saveToJson.js` + `translate.js` — 번역 시 원문 subtitle 보존 필요)
- [ ] `table tbody tr` 셀렉터를 `selectors.js`로 분리 (리팩토링, 동작 변경 없음)

**나머지 테스트 작성**
- [ ] `validate.js` 단위 테스트 작성 (V1~V9)
- [ ] `saveToJson.js` 단위 테스트 작성 (S1~S6)
- [ ] `@playwright/test`로 E2E 테스트 작성 (E1~E4)
- [ ] `package.json`에 `test:unit`, `test:e2e` 스크립트 추가
- [ ] GitHub Actions에 테스트 스텝 추가

### 예상 before/after

| 항목 | Before | After |
|------|--------|-------|
| 테스트 파일 수 | 0개 | 3개 (validate, saveToJson, e2e) |
| 테스트 케이스 수 | 0개 | 예상 19개 (V9 + S6 + E4) |
| CI 테스트 실행 | 없음 | Actions에서 자동 실행 |
| 엣지 케이스 문서화 | 없음 | 테스트 코드가 곧 명세 |
| 회귀 감지 | 불가 | validate 규칙 변경 시 즉시 감지 |

### 트레이드오프

- 도구가 2개(vitest + Playwright Test)라 설정 파일이 늘어남
- 그러나 단위 테스트를 Playwright로 돌리면 불필요하게 느리고, E2E를 vitest로 돌리면 브라우저 연동이 복잡해짐
- 각 도구가 최적인 영역에서만 사용하는 것이 장기 유지보수에 유리함
- TypeScript 전환(Phase 4) 시 vitest는 설정 변경 없이 그대로 사용 가능

---

## Phase 3 — 두 번째 크롤러 추가 (확장성 실증)

### 배경

현재는 크롤러가 `CnnvdCrawler` 하나뿐이다. "확장 가능한 구조"를 실제로 증명하려면 두 번째 크롤러를 추가해서 BaseCrawler 상속으로 얼마나 빠르게 새 사이트를 대응할 수 있는지 보여야 한다.

### 대상 사이트 검토

| 사이트 | 장점 | 단점 | 결정 |
|--------|------|------|------|
| **1688.com** (알리바바 도매) | 이커머스 상품 데이터 수집, SPA + 봇 차단 대응 경험 | 봇 차단 강함, 로그인 필요할 수 있음 | **1순위** |
| **AliExpress** | 공개 상품 데이터 | 구조 변경 잦음, 봇 차단 | 2순위 |
| **NVD (NIST)** | CNNVD와 동일 도메인(보안 DB), 비교 용이 | 도메인 다양성 부족 | 탈락 |
| **공공데이터 포털** | 차단 없음, 안정적 | 크롤링 난이도 낮아 BaseCrawler 검증에 부족 | 탈락 |

**1688.com 채택 이유**: CNNVD(정적 콘텐츠)와 성격이 다른 이커머스 도메인을 추가해야 BaseCrawler 추상화의 범용성을 실제로 검증할 수 있다. 상품명·옵션·가격·이미지 등 구조화된 상품 데이터 수집은 봇 차단 대응, 동적 렌더링 처리 등 기술적 난이도가 높아 BaseCrawler 확장성을 증명하기에 적합하다.

### 작업 목록

- [ ] 1688.com DOM 구조 분석 및 selectors 정의
- [ ] `src/config/selectors1688.js` 작성
- [ ] `src/crawlers/Alibaba1688Crawler.mjs` 작성 — BaseCrawler 상속
- [ ] extractList(): 상품 목록 추출 (상품명, 가격, 이미지)
- [ ] extractDetail(): 상세 페이지 추출 (옵션, 상세 이미지, 설명)
- [ ] `index1688.mjs` 파이프라인 작성 (수집 → 검증 → 번역 → 저장)
- [ ] 작업 소요 시간 측정 및 기록
- [ ] README에 "두 번째 크롤러 추가 소요 시간 N분" 수치 기록

### 예상 before/after

| 항목 | CnnvdCrawler (1번째) | Alibaba1688Crawler (2번째) |
|------|---------------------|---------------------------|
| 브라우저 인프라 작성 | 필요 (BaseCrawler 구현) | 불필요 (상속) |
| retry·withTimeout 작성 | 필요 | 불필요 (상속) |
| navigate 구현 | 필요 | 불필요 (상속) |
| 작성 필요 파일 | selectors + crawler + BaseCrawler | selectors + crawler만 |
| 예상 추가 소요 시간 | — | 측정 후 기록 |

### 기술적 리스크

| 리스크 | 상세 | 대응 |
|--------|------|------|
| 봇 차단 | Cloudflare + 자체 방어, 로그인 없이 접근 가능 범위 제한적 | UserAgent 설정, 요청 간격 조절, stealth plugin 검토 |
| 로그인 벽 | 일부 데이터는 로그인 필수 | 쿠키 주입 또는 로그인 불필요 페이지로 범위 축소 |
| 안정성 미확보 시 | 차단이 빈번하면 자동화 파이프라인으로 운영 불가 | 대안 사이트(AliExpress 등)로 전환 |

### 트레이드오프

- 1688.com은 봇 차단이 강해 UserAgent 설정, 요청 간격 조절 등 추가 작업 필요
- 로그인 벽이 있으면 쿠키 주입 또는 범위 축소(로그인 불필요 페이지만) 필요
- 그러나 봇 차단 대응은 실무 크롤러에서 빈번한 문제이므로 대응 패턴을 확보하는 것 자체가 가치 있음
- 안정성이 확보되지 않으면 대안 사이트로 전환하여 BaseCrawler 확장성 검증에 집중

---

## Phase 4 — TypeScript 전환

### 배경

현재 `.mjs`(순수 JS)로 작성되어 있다. TypeScript로 전환하면 타입 안정성으로 리팩토링 안전성이 높아지고, 크롤러 인터페이스를 명시적으로 정의할 수 있다.

### 작업 목록

- [ ] `tsconfig.json` 설정 (ESM + Node.js 환경)
- [ ] `BaseCrawler.mjs` → `BaseCrawler.ts` 전환
  - `ICrawler` 인터페이스 정의 (`run()`, `extractList()`, `extractDetail()`)
- [ ] `CnnvdCrawler.mjs` → `CnnvdCrawler.ts` 전환
- [ ] `validate.js`, `saveToJson.js`, `translate.js` 전환
- [ ] 빌드 스크립트 추가 (`tsx` 또는 `tsup`)
- [ ] vitest 설정은 변경 없이 그대로 동작 확인

### 트레이드오프

- 전환 공수가 있음 (예상 반나절)
- 빌드 단계가 추가되어 실행 전 컴파일 필요
- 그러나 타입 안정성 + 인터페이스 명시 + IDE 자동완성으로 유지보수 이점
- vitest는 TypeScript 네이티브 지원이라 테스트 설정 변경 불필요

---

## 작업 순서 요약

```
Phase 1 (완료) → Phase 1.5 (완료)  → Phase 2 (현재)       → Phase 3      → Phase 4
Playwright      extractDetail      테스트 작성 + 버그 수정   2번째 크롤러     TypeScript
전환 ✅         구조 변경 ✅       (TDD, vitest + PW)      (1688.com)      전환
```

**순서 결정 이유:**
1. Playwright 먼저 → E2E 테스트를 재작성 없이 바로 쌓을 수 있음
2. extractDetail 구조 변경 → 반환 타입이 바뀌는 인터페이스 변경이라 TDD 불가, 먼저 확정해야 테스트 기대값을 정할 수 있음
3. 테스트 + TDD 버그 수정 → 실패 테스트를 먼저 쓰고 코드를 고치면 "왜 고쳤는가"가 테스트로 문서화됨
4. 두 번째 크롤러 → BaseCrawler 구조 검증 + 이커머스 도메인 경험
5. TypeScript → 위 단계가 안정된 뒤 타입 추가 (기존 테스트가 전환 안전망)

각 Phase 완료 시:
1. before/after 수치를 이 파일에 실측값으로 업데이트
2. 커밋 메시지에 수치 포함

---

## 수치 추적 현황 (실측값 업데이트 예정)

| 항목 | 초기 (crawling.mjs) | 현재 | Phase 1 후 | Phase 1.5 후 | Phase 2 후 | Phase 3 후 | Phase 4 후 |
|------|--------------------|----|------------|-------------|------------|------------|------------|
| 파일 수 | 1 | 7 | 7 (동일) | 7 (동일) | +3 (테스트) | +3 (크롤러) | 동일 |
| 총 줄 수 | 130 | 422 | 434 | 444 | 측정 예정 | 측정 예정 | 측정 예정 |
| 하드코딩 셀렉터 | 9 | 1 | 1 | 1 | 0 | 0 | 0 |
| delay() 사용 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| 타이머 누수 | 있음 | 있음 | **수정 완료** | 수정 완료 | 수정 완료 | 수정 완료 | 수정 완료 |
| 중복 키 안정성 | — | 불안정 (번역본) | 불안정 | 불안정 | 안정 (TDD) | 안정 | 안정 |
| contents 구조 | HTML 문자열 | HTML 문자열 | HTML 문자열 | **`{type,text}[]`** | 동일 | 동일 | 동일 |
| 테스트 케이스 수 | 0 | 0 | 0 | 0 | 19+ (버그 수정 테스트 포함) | 측정 예정 | 측정 예정 |
| 테스트 커버리지 | 0% | 0% | 0% | 0% | 측정 예정 | 측정 예정 | 측정 예정 |
| 실행 시간 (20건) | 미측정 | 미측정 | 측정 예정 | 측정 예정 | 측정 예정 | — | 측정 예정 |
| 새 크롤러 추가 시간 | — | — | — | — | — | 측정 예정 | — |
