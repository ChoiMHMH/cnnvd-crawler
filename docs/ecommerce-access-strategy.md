# 이커머스 실서비스 접근 전략 (Phase 3-B)

> 작성일: 2026-04-09
> 목적: 차단이 강한 이커머스 도메인에서 어떤 수집 전략이 현실적인지 정리하고, 후속 구현 방향을 결정한다.

---

## 1. 사이트별 접근 가능성 분석

### 1.1 1688.com

#### Headless 크롤링 테스트 결과 (2026-04-09)

| 테스트 | 결과 |
|--------|------|
| 메인 페이지 | 200 OK — SPA 렌더링 안 됨, `networkidle` 타임아웃 |
| 검색 페이지 | `punish` 페이지로 리다이렉트 |
| 카테고리 페이지 | 200 OK — 상품 링크 0개 |
| 상품 상세 페이지 | 목록에서 링크 추출 불가로 미검증 |

**결론**: Headless 크롤링으로는 목록→상세 수집 흐름이 불가능하다.

#### API 접근 경로

| 경로 | 인증 조건 | 접근 가능성 |
|------|-----------|-------------|
| **1688 Open Platform (open.1688.com)** | 중국 사업자등록증 + 기업 실명 인증 + AppKey 발급 | **불가** — 해외 개인 개발자는 등록 불가 |
| **OTCommerce API (otcommerce.com)** | 유료 구독 (3rd party 중개) | **가능** — 월 구독료 발생, 상품 검색/상세 API 제공 |
| **Apify / Oxylabs 등 SaaS 스크래퍼** | 유료 (크레딧 기반) | **가능** — 프록시 회전 + CAPTCHA 우회 포함, 운영비용 높음 |

#### 제약 요약

- 공식 API: 중국 기업 전용, 개인 개발자 접근 불가
- 3rd party API: 접근 가능하나 비용 발생 (OTCommerce 기준 월 구독)
- 직접 크롤링: punish 리다이렉트로 사실상 불가, stealth/프록시 우회는 약관 위반

---

### 1.2 Alibaba.com

#### Headless 크롤링 테스트 결과 (2026-04-09)

| 테스트 | 결과 |
|--------|------|
| 메인 페이지 | 200 OK |
| 검색 페이지 | `Captcha Interception` |
| 상품 상세 페이지 | `Captcha Interception` |
| 홈에서 상품 링크 추출 | 0개 |

**결론**: 홈 진입은 가능하나 검색/상세는 CAPTCHA 차단.

#### API 접근 경로

| 경로 | 인증 조건 | 접근 가능성 |
|------|-----------|-------------|
| **Alibaba Open Platform (openapi.alibaba.com)** | 기업 개발자 등록 + 앱 심사 | **제한적** — 주로 공급자/바이어 통합용, 제품 데이터 조회 API 존재 |
| **Alibaba Affiliate Program** | 제휴 마케터 등록 | **가능** — 상품 링크/프로모션 데이터 접근, 상세 데이터는 제한적 |

#### 제약 요약

- 공식 API: 기업 통합 목적이라 개인 프로젝트에는 과한 절차
- Affiliate: 등록은 가능하나 프로모션 목적 데이터만 제공, 상품 스펙/재고 상세는 부족

---

### 1.3 AliExpress

#### API 접근 경로 (가장 현실적)

| 경로 | 인증 조건 | 접근 가능성 |
|------|-----------|-------------|
| **AliExpress Affiliate API** | Affiliate 등록 (portals.aliexpress.com) + AppKey 발급, 1~2일 심사 | **가능** — 개인 개발자도 등록 가능 |
| **AliExpress Open Platform** | 기업 개발자 등록 + 앱 심사 | **제한적** — Self Developer 등록 후 심사 필요 |

#### Affiliate API 주요 엔드포인트

| API | 기능 |
|-----|------|
| `aliexpress.affiliate.product.query` | 키워드 기반 상품 검색 |
| `aliexpress.affiliate.productdetail.get` | 상품 ID로 상세 정보 조회 |
| `aliexpress.affiliate.link.generate` | 제휴 링크 생성 |

#### 제공 데이터 범위

- 상품명, 가격, 이미지, 카테고리, 판매량, 평점
- 배송 정보, 프로모션 가격
- **제한**: 판매자 상세 정보, 재고 수량 등은 미제공 가능

#### 제약 요약

- Affiliate 등록 심사 1~2일, 개인도 가능
- 앱 개발 완료 후 별도 심사 필요 (서비스 전문가 감사)
- 호출 제한 존재 (일반적으로 일 단위 쿼터)
- 데이터가 프로모션/마케팅 목적에 맞춰져 있어, 순수 상품 데이터 수집과는 범위 차이

---

## 2. 접근 방식 비교

| 항목 | 직접 크롤링 | 3rd Party SaaS | 공식 API (Affiliate) |
|------|------------|----------------|---------------------|
| **대상** | 1688, Alibaba, AliExpress | 1688, AliExpress | AliExpress |
| **접근 난이도** | 높음 (차단 우회 필요) | 낮음 (구독만 하면 됨) | 중간 (등록 + 심사) |
| **비용** | 인프라 비용 (프록시 등) | 월 구독 $50~200+ | 무료 (쿼터 내) |
| **안정성** | 낮음 (사이트 변경/차단에 취약) | 중간 (SaaS가 유지보수) | 높음 (공식 제공) |
| **약관 준수** | 위반 가능성 높음 | SaaS 업체 책임 전가 불가 | 준수 |
| **데이터 범위** | 페이지에 보이는 모든 것 | SaaS별 상이 | 프로모션 데이터 중심 |
| **공개 레포 적합성** | 부적합 (우회 코드 포함) | 부적합 (API 키 노출) | **적합** (키 분리 가능) |

---

## 3. 하이브리드 패턴 설계

### 권장 구조: API 우선 + 크롤링 보완

```
[1단계] API로 기본 데이터 수집
  - AliExpress Affiliate API로 상품 검색/상세 조회
  - 구조화된 JSON 응답 → validate → save (기존 파이프라인 재사용)

[2단계] 크롤링으로 부족한 데이터 보완 (필요 시)
  - API에서 제공하지 않는 필드 (리뷰 상세, 판매자 정보 등)
  - Playwright 기반 BaseCrawler 활용
  - robots.txt 준수, rate limiting 적용

[3단계] 데이터 병합
  - API 데이터를 기준으로, 크롤링 보완 데이터를 merge
  - 중복 방지는 상품 ID 기준 dedupKey 사용
```

### 파이프라인 적용 방법

현재 `runCrawlerPipeline` 구조에 API 기반 수집기를 추가할 수 있다:

```
pipelineConfigs에 추가:
  aliexpress: {
    createCrawler: () => new AliExpressFetcher(),  // API 호출 기반
    requiredFields: [{ field: "productId", check: "string" }, ...],
    outputPath: "output/aliexpress_result.json",
    dedupKey: (item) => item.productId,
    useTranslate: false,
  }
```

`AliExpressFetcher`는 `BaseCrawler`를 상속하지 않고 `run()` 메서드만 구현하면 `runCrawlerPipeline`에 연결 가능하다. 이는 현재 파이프라인이 크롤러 구현체에 의존하지 않고 `run()` 인터페이스에만 의존하기 때문이다.

---

## 4. 후속 구현 우선순위

| 순위 | 작업 | 이유 |
|------|------|------|
| **1** | AliExpress Affiliate API 등록 및 연동 | 개인 개발자 접근 가능, 무료, 공개 레포 적합 |
| **2** | `AliExpressFetcher` 구현 (`run()` 인터페이스) | 기존 파이프라인 재사용으로 최소 비용 |
| **3** | API 미제공 데이터에 대한 크롤링 보완 검토 | API 데이터 범위 확인 후 판단 |
| 보류 | 1688 공식 API | 중국 사업자 등록 필요 — 현재 불가 |
| 보류 | 3rd Party SaaS | 비용 발생, 공개 레포에 부적합 |

---

## 5. 결론

1. **1688은 현재 접근 불가** — 공식 API는 중국 기업 전용, 크롤링은 차단.
2. **Alibaba.com은 과한 절차** — 기업 통합 목적 API라 개인 프로젝트에 비효율.
3. **AliExpress Affiliate API가 현실적 선택** — 개인 등록 가능, 무료, 상품 검색/상세 제공.
4. 기존 `runCrawlerPipeline` 구조는 API 기반 수집기도 수용 가능 — `run()` 인터페이스만 맞추면 됨.
5. 우회 크롤링은 공개 레포에서 채택하지 않는다. 약관 준수 + API 우선이 이 프로젝트의 원칙이다.
