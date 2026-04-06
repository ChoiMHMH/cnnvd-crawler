# 아키텍처 설계 문서

---

## BaseCrawler 설계 의도

`BaseCrawler`는 모든 크롤러가 공유하는 **인프라 계층**입니다.
사이트별 로직(어떤 데이터를 뽑을지)과 공통 인프라(브라우저 제어, 재시도, 타임아웃)를
명확히 분리하기 위해 추상 기반 클래스로 설계했습니다.

```
BaseCrawler (인프라)
├── launch() / close()      → 브라우저 생명주기
├── navigate(url, selector) → 로딩 감지
├── retry(fn, times)        → 재시도
└── withTimeout(fn, ms)     → 무한 대기 방지

CnnvdCrawler (사이트 특화)
├── run()                   → 전체 파이프라인
├── extractList()           → 목록 페이지 파싱
├── extractDetail()         → 상세 페이지 파싱
├── navigateToDetail(i)     → 클릭 + 대기
└── backToList()            → 목록 복귀
```

새 크롤러를 추가할 때 `BaseCrawler`를 상속하면 인프라를 재구현할 필요가 없습니다.

---

## 각 모듈 역할과 분리 이유

| 모듈 | 역할 | 분리 이유 |
|------|------|-----------|
| `selectors.js` | CSS 셀렉터 상수 | 사이트 구조 변경 시 한 파일만 수정 |
| `BaseCrawler.mjs` | 공통 브라우저 인프라 | 크롤러마다 재작성하지 않도록 |
| `CnnvdCrawler.mjs` | CNNVD 전용 파싱 | 사이트 특화 로직 격리 |
| `translate.js` | 번역 API 연동 | 번역 엔진 교체 시 이 파일만 수정 |
| `validate.js` | 데이터 검증 | 파싱 로직과 검증 로직 혼재 방지 |
| `saveToJson.js` | 저장 및 중복 처리 | 저장 전략 교체 시 이 파일만 수정 |

---

## 새 크롤러 추가 방법

`BaseCrawler`를 상속하고 `run()` 메서드를 구현하면 됩니다.
`selectors.js`에 해당 사이트의 셀렉터를 추가하거나 별도 설정 파일을 만드세요.

```js
// src/crawlers/NewSiteCrawler.mjs
import BaseCrawler from "../core/BaseCrawler.mjs";

export default class NewSiteCrawler extends BaseCrawler {
  async run() {
    const results = [];
    await this.launch();

    try {
      // retry + withTimeout으로 안정적 수집
      await this.navigate("https://example.com", ".target-selector");

      const items = await this.retry(() =>
        this.withTimeout(() => this.extractList(), 15000),
      );

      for (const item of items) {
        results.push(item);
      }
    } finally {
      await this.close(); // 에러가 나도 브라우저 반드시 종료
    }

    return results;
  }

  async extractList() {
    return await this.page.$$eval(".item", (els) =>
      els.map((el) => ({ title: el.textContent })),
    );
  }
}
```

`index.mjs`에서는 크롤러만 교체하면 됩니다:

```js
// index.mjs
import NewSiteCrawler from "./src/crawlers/NewSiteCrawler.mjs";
const crawler = new NewSiteCrawler();
const rawData = await crawler.run();
```

---

## retry / withTimeout 설계 이유

### retry(fn, times=3)

크롤링은 네트워크 불안정, 렌더링 지연, 일시적 서버 오류로 실패할 수 있습니다.
단순 실패로 전체 파이프라인을 중단하면 수집된 데이터가 손실됩니다.
`retry`는 일시적 오류를 흡수하고, 각 시도마다 로그를 남겨 디버깅을 돕습니다.

```
시도 1 실패 → 에러 로깅 → 시도 2
시도 2 실패 → 에러 로깅 → 시도 3
시도 3 실패 → 최종 에러 throw
```

### withTimeout(fn, ms=10000)

`waitForSelector`는 셀렉터를 찾지 못하면 타임아웃까지 블로킹됩니다.
Puppeteer 기본 타임아웃(30초)은 상황에 따라 너무 길거나 짧을 수 있습니다.
`withTimeout`으로 작업별 타임아웃을 유연하게 제어합니다.

---

## 데이터 검증 레이어를 별도로 둔 이유

기존 코드는 파싱과 데이터 사용이 혼재되어 있었습니다:

```js
// 기존: 파싱 → 번역 → 로그 (검증 없음)
const pageData = await extractPageData(page);
await translateAndLogData(pageData, token); // 빈값도 그냥 번역 호출
```

빈 값이 번역 API로 전달되면 토큰 낭비와 저장 오염이 발생합니다.
`validate.js`를 파싱과 번역 사이에 배치함으로써:

1. 불량 데이터가 번역 API에 도달하지 않아 **비용 절감**
2. 어떤 항목이 왜 실패했는지 **명확히 로깅**
3. 파싱 로직을 건드리지 않고 **검증 규칙만 독립적으로 수정 가능**

```
수집 → [validate] → 번역 → 저장
         ↑
    이 레이어가 불량 데이터를 걸러냄
```

---

## 셀렉터를 별도 파일로 분리한 이유

CNNVD는 Vue.js 기반 SPA로, 프론트엔드 배포 시 클래스명이 변경될 수 있습니다.
기존 코드처럼 셀렉터가 여러 함수에 하드코딩되어 있으면
변경 시 파일 전체를 검색해야 합니다.

`selectors.js`에 상수로 모아두면:
- 셀렉터 변경 = **한 파일 수정**으로 완료
- 크롤러 코드에서 셀렉터 문자열이 사라져 **가독성 향상**
- 테스트 시 셀렉터를 쉽게 모킹 가능
