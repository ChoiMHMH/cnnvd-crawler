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
| **Phase 5** | 확장프로그램 기반 상품 데이터 파싱 엔진 PoC | 진행 예정 |

---


## Phase 5 — 확장프로그램 기반 상품 데이터 파싱 엔진 PoC

### 배경

Phase 3-B에서 이커머스 실서비스의 headless 크롤링 한계를 확인했다:
- 1688: punish 리다이렉트로 목록→상세 흐름 불가
- Alibaba: CAPTCHA 차단
- stealth/프록시 우회는 약관 위반으로 채택하지 않음

이후 실제 이커머스 수집 서비스(윈들리)의 네트워크 흐름을 DevTools로 분석한 결과, 다른 접근 구조를 발견했다:

| 관찰 항목 | 내용 |
|-----------|------|
| 실행 위치 | `chrome-extension://.../offscreen.html` — 서버 크롤러가 아닌 확장프로그램 내부 |
| scrap 응답 | 단순 HTML이 아닌 정규화된 상품 객체 (productId, title, attributes, optionGroups, stockKeepingUnits, imageUrls 등) |
| 파이프라인 구조 | scrap → translate → media(S3 업로드) → products(최종 저장) 순차 실행 |
| 핵심 차이 | "페이지 긁기"가 아니라 **상품 데이터 파싱 엔진 + 후처리 파이프라인** |

### 문제 정의

| 문제 | 설명 |
|------|------|
| headless 크롤링 한계 | 서버 측 자동화는 봇 탐지에 취약, 실서비스에서 안정적 수집 불가 |
| 구조 전환 필요 | "크롤링 기술 문제"가 아니라 "수집 아키텍처 문제"라는 인식 |
| 파이프라인 재사용 검증 | 기존 validate/translate/save 모듈이 다른 수집 소스(확장프로그램)에서도 재사용되는지 확인 필요 |

### 대안 검토

| 대안 | 장점 | 단점 | 결정 |
|------|------|------|------|
| **A. 확장프로그램 + 로컬 서버** | 실제 브라우저 컨텍스트에서 동작 → 봇 탐지 회피, 기존 파이프라인 연결 가능 | 반자동 (사용자가 페이지 방문 필요), 대량 수집에 한계 | **채택** |
| B. AliExpress Affiliate API 연동 | 공식 API, 안정적, 자동화 가능 | 프로모션 데이터 중심, 상품 스펙 상세 제한, 등록 심사 필요 | Phase 5와 별도로 추후 검토 가능 |
| C. headless + stealth 강화 | 기존 구조 유지 | 약관 위반, 불안정, 공개 레포 부적합 | **탈락** |

대안 A 채택 이유:
- 윈들리 분석에서 확인한 구조를 직접 PoC로 검증할 수 있다
- 기존 파이프라인(validate → translate → save) 재사용 여부를 실측할 수 있다
- 대량 수집 한계는 인정하되, "대량은 API, 개별 상세는 확장프로그램"이라는 하이브리드 구조로 설명 가능

### 목표

1. Chrome 확장프로그램(Manifest V3)이 AliExpress 상품 페이지에서 정규화된 상품 데이터를 추출한다
2. 추출된 데이터를 로컬 수신 서버를 통해 기존 validate → translate → saveToJson 파이프라인에 연결한다
3. 파서의 추출 정확도와 파이프라인 재사용률을 수치로 기록한다

### 작업 목록

#### 5-1. 확장프로그램 구현 (Manifest V3)
- [ ] `manifest.json` 작성 (permissions, content_scripts, background service worker)
- [ ] content script: AliExpress 상품 상세 페이지에서 DOM 파싱
  - 추출 대상: productId, title, price, images, attributes, options/SKU, description
- [ ] background service worker: content script에서 받은 데이터를 로컬 서버로 POST
- [ ] 개발자 모드 로드로 동작 확인

#### 5-2. 로컬 수신 서버
- [ ] Express 기반 간단한 수신 서버 (POST /product 엔드포인트)
- [ ] 수신 데이터 → 기존 validate → translate → saveToJson 연결
- [ ] 상품 스키마 타입 정의 (AliExpressProduct 인터페이스)

#### 5-3. 테스트
- [ ] 파서 단위 테스트: HTML fixture → 스키마 변환 정확도 검증
- [ ] 파이프라인 통합 테스트: 확장프로그램 출력 → validate → save 흐름
- [ ] before/after 수치 기록

### 측정 항목

| 항목 | 측정 방법 |
|------|-----------|
| 파싱 정확도 | 수동 확인 상품 데이터 vs 파서 출력 필드별 일치율 |
| 추출 필드 수 | 정규화된 스키마에 포함된 필드 개수 |
| 기존 파이프라인 재사용률 | validate/translate/save 중 수정 없이 재사용한 모듈 수 |
| 신규 코드 vs 재사용 코드 | 확장프로그램 신규 줄 수 vs 기존 파이프라인 재사용 줄 수 |
| headless 대비 접근 성공률 | Phase 3-B에서 차단된 사이트가 확장프로그램에서 접근되는지 |

### 트레이드오프

- **자동화 한계**: 사용자가 직접 페이지를 방문해야 한다 → 대량 수집에는 부적합
  - 대응: "대량은 API, 개별 상세는 확장프로그램"이라는 하이브리드 구조로 위치를 명확히 함
- **사이트 구조 변경에 취약**: DOM 셀렉터 기반 파싱이므로 AliExpress 페이지 구조가 바뀌면 파서도 수정 필요
  - 대응: 셀렉터를 분리 파일로 관리 (기존 selectors 패턴 재사용)
- **단일 사이트 PoC**: AliExpress만 대상이므로 범용성 증명은 제한적
  - 대응: 파서 인터페이스를 사이트별로 교체 가능한 구조로 설계, 추후 확장 가능성만 열어둠

### Phase 5를 Phase 4 다음에 진행하는 이유

1. TypeScript 전환이 완료되어 새 코드도 타입 안전하게 작성 가능
2. 기존 파이프라인(validate/translate/save)이 안정화된 상태에서 재사용 검증이 의미 있음
3. Phase 3-B의 전략 문서에서 "API 우선 + 크롤링 보완" 방향을 정했는데, 확장프로그램 기반 수집은 "크롤링 보완" 트랙의 구체적 구현에 해당

---

## 작업 순서 요약

```
Phase 1 (완료) → Phase 1.5 (완료) → Phase 2 (완료) → Phase 3-A (완료) → Phase 3-A-2 (완료) → Phase 3-B (완료) → Phase 4 (완료) → Phase 5 (진행 예정)
Playwright      구조 변경          테스트·버그 수정    2번째 크롤러      진입점 재사용      실서비스 전략     TypeScript        확장프로그램
전환 ✅         완료 ✅             완료 ✅             검증 완료 ✅      완료 ✅            완료 ✅           완료 ✅            파싱 엔진 PoC
```

**순서 결정 이유:**
1. Playwright 전환을 먼저 완료해야 브라우저 동작 기반 구현과 후속 테스트가 안정된다.
2. `extractDetail` 구조를 먼저 확정해야 테스트 기대값과 downstream 모듈을 맞출 수 있다.
3. 테스트와 버그 수정을 선행해 이후 변경의 안전망을 확보한다.
4. Phase 3-A에서 두 번째 크롤러 추가 자체를 먼저 검증했다.
5. Phase 3-A-2에서 진입점 재사용까지 정리해 구조 설명력을 높인 뒤, Phase 3-B에서 실서비스 전략을 다룬다.
6. TypeScript 전환은 구조가 안정된 후 적용한다.
7. Phase 5는 파이프라인이 안정화된 상태에서 새로운 수집 소스(확장프로그램)를 연결하는 확장 작업이다.

각 Phase 완료 시:
1. before/after 수치를 이 파일에 실측값으로 업데이트
2. 커밋 메시지에 수치 포함

---

## 수치 추적 현황 (실측값 업데이트 예정)

| 항목 | 초기 (crawling.mjs) | 현재 | Phase 1 후 | Phase 1.5 후 | Phase 2 후 | Phase 3-A 후 | Phase 3-B 후 | Phase 4 후 | Phase 5 후 |
|------|--------------------|------|------------|---------------|------------|--------------|--------------|------------|------------|
| 파일 수 | 1 | 7 | 7 | 7 | **9** (src 6 + test 3) | **16** (src 10 + test 5 + entry 1) | 동일 | **16** (.ts) | 예정 |
| 총 줄 수 | 130 | 422 | 434 | 444 | **697** (src 448 + test 249) | **1153** (src 723 + test 430) | 동일 | **1122** (src 710 + test 412) | 예정 |
| 하드코딩 셀렉터 | 9 | 1 | 1 | 1 | **0** | **0** | 0 | 0 | 0 |
| delay() 사용 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 타이머 누수 | 있음 | 있음 | **수정 완료** | 수정 완료 | 수정 완료 | 수정 완료 | 수정 완료 | 수정 완료 | 수정 완료 |
| 중복 키 안정성 | — | 불안정 | 불안정 | 불안정 | **안정 (originalSubtitle)** | **안정 (dedupKey 옵션화)** | 안정 | 안정 (타입 보장) | 예정 |
| contents 구조 | HTML 문자열 | HTML 문자열 | HTML 문자열 | **`{type,text}[]`** | 동일 | 동일 (크롤러별 스키마 분리) | 동일 | 동일 (타입 정의) | 예정 |
| 진입점 수 | 1 | 1 | 1 | 1 | 1 | **1** (공통 runner + config) | 동일 | **1** (index.ts) | 예정 |
| 테스트 케이스 수 | 0 | 0 | 0 | 0 | **23개** | **31개** (+5 Books +3 Pipeline) | 동일 | **31개** (.ts) | 예정 |
| 테스트 커버리지 | 0% | 0% | 0% | 0% | validate·save·BaseCrawler 100% | +BooksCrawler +runCrawlerPipeline | 동일 | 동일 + tsc 타입 체크 | 예정 |
| 언어 | JS | JS | JS | JS | JS | JS (.mjs/.js) | JS | **TypeScript** | TypeScript |
| 수집 소스 | 서버 크롤링 | 서버 크롤링 | 서버 크롤링 | 서버 크롤링 | 서버 크롤링 | 서버 크롤링 | 서버 크롤링 | 서버 크롤링 | 예정 (+ 확장프로그램) |
