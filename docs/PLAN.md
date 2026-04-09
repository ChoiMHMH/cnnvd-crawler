# 작업 계획 (plan.md)

> 크롤링 파이프라인 개선 작업 계획서.
> 모든 작업은 **문제 정의 → 대안 검토 → 트레이드오프 → 수치 비교** 순서로 기록한다.
> 완료된 Phase의 상세 내용은 [plan-archive.md](plan-archive.md)에 보존한다.

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
6. **완료된 Phase의 상세 기록은 이 파일에 남기지 않고 `plan-archive.md`로 이동한다.**
   - `plan.md`에는 현재 진행 중이거나 앞으로 진행할 계획만 유지
   - 완료 보고에 필요한 실측 수치, 대안 검토, 트레이드오프는 `plan-archive.md`에 누적

---

## 완료된 Phase 요약

> 상세 내용: [plan-archive.md](plan-archive.md)

| Phase | 작업 | 핵심 결과 |
|-------|------|-----------|
| **Phase 1** ✅ | Puppeteer → Playwright 전환 | BaseCrawler 추상화로 교체 범위 2개 파일로 격리, auto-waiting 확보 |
| **Phase 1.5** ✅ | extractDetail 구조 변경 | HTML 문자열 → `{type, text}[]` 구조화 데이터, translate/validate 연쇄 수정 |
| **Phase 2** ✅ | 테스트 코드 작성 + TDD 버그 수정 | 23개 테스트 (vitest), 버그 3건 수정 (타이머 누수, dedup 키, 셀렉터 범위), CI 통합 |
| **Phase 3-A** ✅ | BooksCrawler 추가 (BaseCrawler 확장성 검증) | BaseCrawler 수정 0줄로 재사용, 신규 3파일+진입점 1, validate/save 옵션화로 파이프라인 재사용, 테스트 28개 |
| **Phase 3-A-2** ✅ | 파이프라인 진입점 재사용 구조 정리 | runCrawlerPipeline + pipelineConfigs 도입, 진입점 2→1개, 신규 사이트=크롤러+셀렉터+config 1항목, 테스트 31개 |
| **Phase 3-B** ✅ | 실서비스 접근 전략 정리 | 1688 불가, Alibaba 과잉, AliExpress Affiliate API 채택, 하이브리드 패턴 설계, 전략 문서화 |
| **Phase 4** ✅ | TypeScript 전환 | 전 파일 .ts 전환, tsc --noEmit 통과, Runnable/PipelineConfig 등 인터페이스 명시, 테스트 31개 유지 |

---

## Phase 3 — 두 번째 크롤러 추가 (확장성 실증)

### 배경

현재는 크롤러가 `CnnvdCrawler` 하나뿐이다. `BaseCrawler` 추상화가 실제로 재사용 가능한 구조인지 검증하려면, 성격이 다른 두 번째 크롤러를 추가해 신규 사이트 대응 비용을 측정할 필요가 있다.

### 1차 대상 사이트 검토 결과

| 사이트 | 장점 | 단점 | 상태 |
|--------|------|------|------|
| **1688.com** | 이커머스 도메인, 동적 렌더링, 실제 상품 데이터 | 봇 차단 강함, 공개 크롤러로 유지하기 어려움 | 보류 |
| **Alibaba.com** | 영문 글로벌 사이트, 상품 상세 경로 존재 | 검색/상세 진입 시 CAPTCHA 차단 | 보류 |
| **AliExpress** | 공개 상품 데이터, 이커머스 구조 | 차단 가능성 있음, 구조 변경 잦음 | 추가 검토 가능 |
| **books.toscrape.com** | 목록→상세 구조 명확, 차단 없음, 재현성 높음 | 실서비스가 아님 | Phase 3-A 후보 |
| **quotes.toscrape.com** | 차단 없음, 페이지네이션 있음 | 이커머스 구조 아님 | 탈락 |

### 1688.com / Alibaba.com 접근 테스트 결과 (2026-04-09)

#### 1688.com

Playwright headless 브라우저로 1688.com에 접근한 결과:

| 테스트 | 결과 |
|--------|------|
| 메인 페이지 (`1688.com`) | 200 OK — HTML은 오지만 SPA 렌더링 안 됨, `networkidle` 타임아웃 |
| 검색 페이지 (`s.1688.com/selloffer/...`) | `punish` 페이지로 리다이렉트 |
| 카테고리 페이지 (`sale.1688.com`) | 200 OK — 상품 링크 0개 |
| 상품 상세 페이지 (`detail.1688.com`) | 목록에서 링크 추출 불가로 미검증 |

#### Alibaba.com

Playwright headless 브라우저로 Alibaba.com에 접근한 결과:

| 테스트 | 결과 |
|--------|------|
| 메인 페이지 (`www.alibaba.com`) | 200 OK — 홈 진입 가능 |
| 검색 페이지 (`/trade/search?...`) | `Captcha Interception` 노출 |
| 상품 상세 페이지 (`/product-detail/...`) | `Captcha Interception` 노출 |
| 홈에서 상품 링크 추출 | `/product-detail/` 링크 0개 |

#### 결론

- 두 사이트 모두 홈 진입 자체는 가능할 수 있으나, 실제 `목록 → 상세` 수집 흐름은 headless 환경에서 안정적으로 재현되지 않았다.
- 공개 레포 기준에서는 우회 목적의 stealth, 프록시 회전, 로그인 쿠키 재사용 같은 방식은 채택하지 않는다.
- 따라서 Phase 3은 `구조 확장성 검증`과 `실서비스 데이터 접근 전략`을 분리해 진행한다.

### 방향 전환: Phase 3을 두 트랙으로 분리

#### Phase 3-A: 제어 가능한 사이트에서 BaseCrawler 확장성 검증 ✅

목적은 `BaseCrawler` 상속 구조가 새 사이트 추가에 실제로 유효한지 검증하는 것이다. 재현 가능한 환경에서 두 번째 크롤러를 구현하고, 신규 크롤러 추가 비용을 수치로 기록한다.

후보:

| 사이트 | 장점 | 단점 | 결정 |
|--------|------|------|------|
| **books.toscrape.com** | 목록→상세 구조, 가격/재고/카테고리 등 상품성 데이터, 차단 없음 | 실서비스 아님 | **채택 및 완료** |
| **AliExpress** | 실서비스 이커머스 | 차단/불안정 가능성 | 예비 후보 |

상세 기록:
- 구현 내용, 실측 수치, 변경 파일 목록은 [plan-archive.md](plan-archive.md)의 `Phase 3-A` 항목으로 이동

#### Phase 3-A-2: 파이프라인 진입점 재사용 구조로 정리

배경:
- `Phase 3-A`에서 `BaseCrawler`, `validate`, `save` 재사용은 확인했지만, 실행 진입점이 `index.mjs`와 `index.books.mjs`로 분리되었다.
- 현재는 진입점이 2개뿐이라 즉시 문제가 되지는 않지만, 신규 크롤러가 늘어나면 파이프라인 조립 코드가 사이트별로 반복될 가능성이 있다.
- 이는 현재의 장애 수정이 아니라 구조적 완성도 개선에 가깝지만, "새 크롤러를 붙일 때 재사용되는 층"을 진입점까지 확장해 두면 이후 Phase 3-B와 후속 크롤러 추가 시 설명력과 유지보수성이 좋아진다.
- 변경 범위가 작고 기존 테스트 28개가 안전망 역할을 하므로, Phase 3-B 전에 끼워 넣는 소규모 리팩토링으로 수행한다.

목표:
- `runCrawlerPipeline()` 공통 실행 함수 도입
- 사이트별 차이는 설정(`crawler`, `requiredFields`, `outputPath`, `dedupKey`, 번역 사용 여부)으로만 분리
- 신규 사이트 추가 비용을 `크롤러 1 + 셀렉터 1 + config 1항목` 수준으로 축소

작업 목록:
- [x] `runCrawlerPipeline` 공통 실행 모듈 설계
- [x] 사이트별 파이프라인 설정 객체(`pipelineConfigs`) 설계
- [x] `index.mjs`를 공통 진입점 구조로 전환
- [x] `index.books.mjs` 제거 → 공통 진입점으로 흡수
- [x] 기존 테스트 회귀 확인 + `runCrawlerPipeline` 테스트 3건 추가
- [x] before/after 수치 및 변경 범위 기록

Phase 3-A-2 실측 결과:
- 신규 파일 2개: `runCrawlerPipeline.mjs`, `pipelineConfigs.js`
- 신규 테스트 1개: `runCrawlerPipeline.test.mjs` (3건)
- 삭제 파일 1개: `index.books.mjs`
- 수정 파일 2개: `index.mjs` (공통 진입점 전환), `package.json` (스크립트 정리)
- 진입점 수: 2개 → **1개** (`node index.mjs [target]`)
- 신규 사이트 추가 비용: 크롤러 1 + 셀렉터 1 + `pipelineConfigs`에 설정 1항목
- 테스트: 28개 → **31개** (전부 통과)

트레이드오프:
- 현재 드러난 장애를 수정하는 작업은 아니므로, 지나친 일반화가 되지 않도록 범위를 작게 유지해야 한다.
- 다만 세 번째 크롤러 추가 전에 진입점 중복을 정리해 두면 이후 변경의 설명력과 유지보수성이 높아진다.

#### Phase 3-B: 실서비스 대상 접근 전략 정리 ✅

목적은 차단이 강한 이커머스 도메인에서 어떤 수집 전략이 현실적인지 문서화하고, 필요 시 API 중심 접근으로 전환하는 것이다.

작업 목록:
- [x] 1688 Open Platform API 문서 분석 및 인증 흐름 파악
- [x] Alibaba.com / AliExpress의 공개 접근 가능 범위 재검토
- [x] API 우선 / 크롤링 보완 하이브리드 패턴 초안 작성
- [x] 각 접근 방식의 제약(약관, 인증, 안정성, 운영비용) 비교
- [x] 후속 구현 우선순위 결정

상세 전략 문서: [ecommerce-access-strategy.md](ecommerce-access-strategy.md)

핵심 결론:
- 1688: 공식 API는 중국 기업 전용 → 현재 접근 불가
- Alibaba.com: 기업 통합 목적 API → 개인 프로젝트에 과한 절차
- **AliExpress Affiliate API가 현실적 선택** — 개인 등록 가능, 무료, 상품 검색/상세 제공
- 기존 `runCrawlerPipeline` 구조에 API 기반 수집기도 `run()` 인터페이스만 맞추면 연결 가능
- 우회 크롤링은 공개 레포에서 채택하지 않음 (약관 준수 원칙)

### Phase 3 트레이드오프

- Phase 3-A는 재현성과 구현 속도 면에서 유리하지만, 실서비스 접근성 자체를 증명하지는 못한다.
- Phase 3-B는 실제 운영 환경에 더 가깝지만, 인증·차단·약관 제약으로 구현 난도가 높다.
- 따라서 먼저 Phase 3-A로 구조 확장성을 검증하고, Phase 3-A-2로 진입점 재사용까지 정리한 뒤, Phase 3-B에서 실서비스 접근 전략을 별도로 정리한다.

---

## Phase 4 — TypeScript 전환

### 배경

현재 `.mjs`(순수 JS)로 작성되어 있다. TypeScript로 전환하면 타입 안정성으로 리팩토링 안전성이 높아지고, 크롤러 인터페이스를 명시적으로 정의할 수 있다.

### 작업 목록

- [x] `tsconfig.json` 설정 (ESM + Node16 모듈)
- [x] `BaseCrawler.mjs` → `BaseCrawler.ts` 전환
  - `Runnable` 인터페이스 정의 (`run()`)
  - `CnnvdItem`, `BookListItem`, `BookDetailItem` 타입 정의
- [x] `CnnvdCrawler.mjs` → `CnnvdCrawler.ts` 전환
- [x] `BooksCrawler.mjs` → `BooksCrawler.ts` 전환
- [x] `validate.js` → `validate.ts` (FieldCheck, ValidateOptions 타입 추가)
- [x] `saveToJson.js` → `saveToJson.ts` (SaveOptions 타입 추가)
- [x] `translate.js` → `translate.ts` 전환
- [x] `runCrawlerPipeline.mjs` → `runCrawlerPipeline.ts` (PipelineConfig 인터페이스)
- [x] `pipelineConfigs.js` → `pipelineConfigs.ts` 전환
- [x] `selectors.js`, `booksSelectors.js` → `.ts` 전환 (`as const`)
- [x] `index.mjs` → `index.ts` 전환
- [x] `tsx` 런타임 추가, `tsc --noEmit` 타입 체크 통과
- [x] vitest 31개 테스트 전부 통과 확인

Phase 4 실측 결과:
- `.mjs`/`.js` 파일 15개 → `.ts` 파일 16개 (src 10 + test 5 + entry 1)
- 총 줄 수: 1153 → **1122** (src 710 + test 412) — 타입 추가에도 불구하고 줄 수 감소 (JS 보일러플레이트 제거)
- `tsc --noEmit` 타입 체크 통과
- 런타임: `tsx` 사용 (빌드 없이 직접 실행)
- 테스트: 31개 유지 (전부 통과)

### 트레이드오프

- `tsx` 런타임 의존성 추가 (빌드 없이 직접 실행하는 대신 런타임 변환)
- `any` 타입 1곳 사용 (`Runnable.run()` 반환 — 크롤러별 반환 타입이 다르기 때문)
- 그러나 타입 안정성 + 인터페이스 명시 + IDE 자동완성으로 유지보수성이 높아졌다

---

## 작업 순서 요약

```
Phase 1 (완료) → Phase 1.5 (완료) → Phase 2 (완료) → Phase 3-A (완료) → Phase 3-A-2 (완료) → Phase 3-B (완료) → Phase 4 (완료)
Playwright      구조 변경          테스트·버그 수정    2번째 크롤러      진입점 재사용      실서비스 전략     TypeScript
전환 ✅         완료 ✅             완료 ✅             검증 완료 ✅      완료 ✅            완료 ✅           완료 ✅
```

**순서 결정 이유:**
1. Playwright 전환을 먼저 완료해야 브라우저 동작 기반 구현과 후속 테스트가 안정된다.
2. `extractDetail` 구조를 먼저 확정해야 테스트 기대값과 downstream 모듈을 맞출 수 있다.
3. 테스트와 버그 수정을 선행해 이후 변경의 안전망을 확보한다.
4. Phase 3-A에서 두 번째 크롤러 추가 자체를 먼저 검증했다.
5. Phase 3-A-2에서 진입점 재사용까지 정리해 구조 설명력을 높인 뒤, Phase 3-B에서 실서비스 전략을 다룬다.
6. TypeScript 전환은 구조가 안정된 후 적용한다.

각 Phase 완료 시:
1. before/after 수치를 이 파일에 실측값으로 업데이트
2. 커밋 메시지에 수치 포함

---

## 수치 추적 현황 (실측값 업데이트 예정)

| 항목 | 초기 (crawling.mjs) | 현재 | Phase 1 후 | Phase 1.5 후 | Phase 2 후 | Phase 3-A 후 | Phase 3-B 후 | Phase 4 후 |
|------|--------------------|------|------------|---------------|------------|--------------|--------------|------------|
| 파일 수 | 1 | 7 | 7 | 7 | **9** (src 6 + test 3) | **16** (src 10 + test 5 + entry 1) | 동일 | **16** (.ts) |
| 총 줄 수 | 130 | 422 | 434 | 444 | **697** (src 448 + test 249) | **1153** (src 723 + test 430) | 동일 | **1122** (src 710 + test 412) |
| 하드코딩 셀렉터 | 9 | 1 | 1 | 1 | **0** | **0** | 0 | 0 |
| delay() 사용 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 타이머 누수 | 있음 | 있음 | **수정 완료** | 수정 완료 | 수정 완료 | 수정 완료 | 수정 완료 | 수정 완료 |
| 중복 키 안정성 | — | 불안정 | 불안정 | 불안정 | **안정 (originalSubtitle)** | **안정 (dedupKey 옵션화)** | 안정 | 안정 (타입 보장) |
| contents 구조 | HTML 문자열 | HTML 문자열 | HTML 문자열 | **`{type,text}[]`** | 동일 | 동일 (크롤러별 스키마 분리) | 동일 | 동일 (타입 정의) |
| 진입점 수 | 1 | 1 | 1 | 1 | 1 | **1** (공통 runner + config) | 동일 | **1** (index.ts) |
| 테스트 케이스 수 | 0 | 0 | 0 | 0 | **23개** | **31개** (+5 Books +3 Pipeline) | 동일 | **31개** (.ts) |
| 테스트 커버리지 | 0% | 0% | 0% | 0% | validate·save·BaseCrawler 100% | +BooksCrawler +runCrawlerPipeline | 동일 | 동일 + tsc 타입 체크 |
| 언어 | JS | JS | JS | JS | JS | JS (.mjs/.js) | JS | **TypeScript** |
