# CNNVD Crawler

중국 국가정보보안취약성데이터베이스(CNNVD)의 보안 경고를 자동으로 수집하고,
Claude AI로 번역하여 JSON으로 저장하는 크롤링 파이프라인입니다.

---

## 파이프라인 구조

```
수집 (CnnvdCrawler)
  → 검증 (validate)
    → 번역 (translate / Claude API)
      → 저장 (saveToJson / output/result.json)
```

| 단계 | 모듈 | 역할 |
|------|------|------|
| 수집 | `src/crawlers/CnnvdCrawler.mjs` | Puppeteer로 목록 및 상세 페이지 크롤링 |
| 검증 | `src/validate.js` | 필수 필드 빈값 체크, 불량 데이터 스킵 |
| 번역 | `src/translate.js` | Claude Haiku API로 중→한 번역 |
| 저장 | `src/saveToJson.js` | 중복 방지 후 JSON 파일 저장 |

---

## 도구 선택 이유

### Puppeteer 채택 이유

| 도구 | 탈락 이유 |
|------|-----------|
| **Cheerio** | 정적 HTML 파싱 전용 — CNNVD는 Vue 기반 SPA라 JS 실행 불가 |
| **Selenium** | Python 기반이라 Next.js 프로젝트와 언어가 분리되어 유지보수 부담 |
| **Playwright** | 멀티브라우저 지원 등 기능은 우수하나, 처음 크롤러를 만드는 시점에서 Puppeteer가 레퍼런스와 커뮤니티가 더 풍부해 학습 비용 기준으로 Puppeteer 선택 |
| **Puppeteer** | Chrome DevTools Protocol 직접 사용, Node.js 네이티브, 경량 |

---

## 실제 실행 결과 (2026-04-07)

```
[pipeline] 크롤링 시작
[수집 완료] 페이지 1 / 항목 1 ~ 10
[수집 완료] 페이지 2 / 항목 1 ~ 10
[pipeline] 수집 완료 — 20건
[validate] 검증 완료 — 성공 8건 / 실패 12건 (빈 본문 항목 스킵)
[pipeline] 검증 완료 — 8건
[pipeline] 번역 완료 — 8건  ← 크레딧 충전 시 한국어 번역 자동 적용
[save] 저장 완료 — 신규 4건 추가, 중복 4건 스킵 → output/result.json
[pipeline] 파이프라인 완료
```

| 단계 | 수치 | 비고 |
|------|------|------|
| 수집 | **20건** | 2페이지 × 10건 |
| 검증 통과 | **8건** | 12건은 본문 없는 항목 → 정상 스킵 |
| 번역 | **8건** | Claude Haiku API (크레딧 충전 시 한국어 변환) |
| 신규 저장 | **4건** | 나머지 4건은 중복 스킵 (재실행 안전) |

---

## Before / After 개선사항

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| 하드코딩 셀렉터 수 | **9개** | **0개** | 100% 감소 → `selectors.js` 1곳 관리 |
| `delay()` 사용 횟수 | **1회** | **0회** | `waitForSelector`로 대체 |
| SPA 로딩 전략 | **networkidle0** (타임아웃 발생) | **networkidle2** | Vue SPA 안정 대응 |
| 재시도 로직 | 없음 | **retry(fn, 3)** | 일시적 네트워크 오류 흡수 |
| 타임아웃 처리 | 없음 | **withTimeout()** | 무한 대기 방지 |
| 데이터 검증 레이어 | 없음 | **validate.js** | 불량 데이터 번역 API 도달 차단 |
| 중복 방지 | 없음 | **subtitle 기준** | 재실행해도 데이터 오염 없음 |
| 번역 API | 자체 handler | **Claude Haiku** | 표준 SDK, 실패 시 원문 반환 |
| GitHub Actions 자동화 | 없음 | **주간 스케줄** | 무인 운영 가능 |
| 모듈 파일 수 | **1개** | **6개** | 관심사 분리, 단일 책임 원칙 |
| 평균 함수 길이 | **~14줄** | **~10줄** | 단순화 |

---

## 실행 방법

### 1. 설치

```bash
git clone https://github.com/<your-github-id>/cnnvd-crawler.git
cd cnnvd-crawler
npm install
npx puppeteer browsers install chrome
```

### 2. 환경변수 설정

```bash
cp .env.example .env
# .env 파일을 열어 ANTHROPIC_API_KEY 값을 입력하세요
```

### 3. 실행

```bash
node index.mjs
```

결과는 `output/result.json`에 저장됩니다.

---

## 환경변수

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `ANTHROPIC_API_KEY` | ✅ | Claude API 키 ([발급](https://console.anthropic.com)) |

---

## GitHub Actions 자동화

`.github/workflows/schedule.yml`에 정의된 워크플로우가
**매주 일요일 00:00 UTC**에 자동으로 크롤링을 실행합니다.

### 설정 방법

1. GitHub 레포 → Settings → Secrets and variables → Actions
2. `ANTHROPIC_API_KEY` 시크릿 추가
3. Actions 탭에서 `workflow_dispatch`로 수동 실행 테스트

### 워크플로우 흐름

```
트리거 (cron / 수동)
  → ubuntu-latest 환경 준비
    → npm ci + Chrome 설치
      → node index.mjs 실행
        → output/result.json 자동 커밋
```

---

## 프로젝트 구조

```
cnnvd-crawler/
├── src/
│   ├── core/
│   │   └── BaseCrawler.mjs     # 브라우저 생명주기, 재시도, 타임아웃
│   ├── crawlers/
│   │   └── CnnvdCrawler.mjs    # CNNVD 전용 크롤링 로직
│   ├── config/
│   │   └── selectors.js        # CSS 셀렉터 상수 모음
│   ├── translate.js            # Claude API 번역
│   ├── validate.js             # 데이터 검증
│   └── saveToJson.js           # JSON 저장 + 중복 방지
├── output/
│   └── result.json             # 크롤링 결과
├── index.mjs                   # 파이프라인 진입점
├── .env.example                # 환경변수 예시
└── .github/workflows/
    └── schedule.yml            # 주간 자동화
```
