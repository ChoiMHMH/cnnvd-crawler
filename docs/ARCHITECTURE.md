# 아키텍처 설계 문서

---

## 전체 구조

이 프로젝트는 크롤러별 수집 로직과 공통 실행 파이프라인을 분리합니다.

```
index.ts
└── PIPELINES에서 실행 대상 선택
    └── runCrawlerPipeline()
        ├── crawler.run()     → 원본 데이터 수집
        ├── validate()        → 필수 필드 검증
        ├── translate()       → 선택적 번역
        └── save()            → JSON 저장 및 중복 제거
```

크롤러 클래스는 “데이터를 어떻게 수집할지”에 집중하고, 검증·번역·저장은 `runCrawlerPipeline`이 공통으로 처리합니다.

---

## BaseCrawler 설계 의도

`BaseCrawler`는 모든 크롤러가 공유하는 **브라우저 인프라 계층**입니다.
사이트별 파싱 로직과 공통 브라우저 제어 로직을 분리하기 위해 기반 클래스로 둡니다.

```
BaseCrawler (공통 인프라)
├── launch() / close()      → Playwright 브라우저 생명주기
├── navigate(url, selector) → 페이지 이동 및 로딩 감지
├── retry(fn, times)        → 일시적 실패 재시도
└── withTimeout(fn, ms)     → 필요 시 작업별 타임아웃 적용

CnnvdCrawler (CNNVD 수집 로직)
├── run()                   → CNNVD 원본 데이터 수집
├── extractList()           → 목록 페이지 파싱
├── extractDetail()         → 상세 페이지 파싱
├── navigateToDetail(i)     → 목록 항목 클릭 및 상세 대기
├── backToList()            → 목록 페이지 복귀
└── navigateToPage(n)       → 페이지네이션 이동
```

새 크롤러를 추가할 때 `BaseCrawler`를 상속하면 브라우저 실행, 종료, 이동, 재시도 로직을 다시 구현할 필요가 없습니다.

---

## 각 모듈 역할과 분리 이유

| 모듈 | 역할 | 분리 이유 |
|------|------|-----------|
| `index.ts` | 실행 대상 선택 및 파이프라인 시작 | CLI 인자에 따라 크롤러 실행 대상 결정 |
| `src/config/pipelineConfigs.ts` | 사이트별 파이프라인 설정 | 크롤러, 검증 필드, 저장 경로, 번역 여부를 한곳에서 관리 |
| `src/core/runCrawlerPipeline.ts` | 공통 실행 파이프라인 | 수집 후 검증·번역·저장 순서를 모든 대상에 동일하게 적용 |
| `src/core/BaseCrawler.ts` | Playwright 브라우저 공통 인프라 | 크롤러마다 브라우저 제어 코드를 재작성하지 않도록 분리 |
| `src/crawlers/CnnvdCrawler.ts` | CNNVD 전용 수집 및 파싱 | CNNVD 사이트 구조에 의존하는 로직 격리 |
| `src/crawlers/BooksCrawler.ts` | books.toscrape.com 전용 수집 및 파싱 | 예제/검증용 크롤러 로직 격리 |
| `src/config/selectors.ts` | CNNVD CSS 셀렉터 상수 | CNNVD 구조 변경 시 셀렉터 수정 범위 축소 |
| `src/config/booksSelectors.ts` | Books 크롤러 CSS 셀렉터 상수 | Books 사이트 셀렉터 수정 범위 축소 |
| `src/validate.ts` | 데이터 검증 | 파싱 로직과 검증 규칙 혼재 방지 |
| `src/translate.ts` | 번역 API 연동 | 번역 엔진 및 프롬프트 변경 범위 격리 |
| `src/saveToJson.ts` | JSON 저장 및 중복 처리 | 저장 경로와 중복 제거 전략을 파이프라인에서 주입 가능 |
| `src/server.ts` | AliExpress 확장프로그램 수신 서버 | 브라우저 확장프로그램에서 보낸 상품 데이터를 검증 후 저장 |
| `extension/` | AliExpress 상품 수집 확장프로그램 | CNNVD/Books 크롤러와 별도의 브라우저 확장 수집 경로 |

---

## 새 크롤러 추가 방법

새 크롤러는 `BaseCrawler`를 상속하고 `run()` 메서드에서 원본 데이터 배열을 반환하도록 구현합니다.
그 다음 `PIPELINES`에 실행 설정을 등록합니다.

```ts
// src/crawlers/NewSiteCrawler.ts
import BaseCrawler from "../core/BaseCrawler.js";

export interface NewSiteItem {
  title: string;
  url: string;
}

export default class NewSiteCrawler extends BaseCrawler {
  async run(): Promise<NewSiteItem[]> {
    await this.launch();

    try {
      await this.navigate("https://example.com", ".item");

      return await this.retry(() => this.extractList());
    } finally {
      await this.close();
    }
  }

  async extractList(): Promise<NewSiteItem[]> {
    return await this.page!.evaluate(() =>
      Array.from(document.querySelectorAll(".item")).map((el) => ({
        title: el.textContent?.trim() ?? "",
        url: el.querySelector("a")?.getAttribute("href") ?? "",
      })),
    );
  }
}
```

```ts
// src/config/pipelineConfigs.ts
import NewSiteCrawler from "../crawlers/NewSiteCrawler.js";

export const PIPELINES = {
  newsite: {
    createCrawler: () => new NewSiteCrawler(),
    requiredFields: [
      { field: "title", check: "string" as const },
      { field: "url", check: "string" as const },
    ],
    outputPath: "output/newsite_result.json",
    dedupKey: (item: Record<string, unknown>) => item.url as string,
    useTranslate: false,
  },
};
```

실행은 다음처럼 대상 이름을 넘깁니다.

```bash
npm start -- newsite
```

---

## retry / withTimeout 설계 이유

### retry(fn, times = 3)

크롤링은 네트워크 불안정, 렌더링 지연, 일시적 서버 오류로 실패할 수 있습니다.
단순 실패로 전체 수집을 중단하면 이미 수집 가능한 데이터까지 놓칠 수 있습니다.
`retry`는 일시적 오류를 흡수하고, 각 시도마다 로그를 남겨 디버깅을 돕습니다.

```
시도 1 실패 → 에러 로깅 → 시도 2
시도 2 실패 → 에러 로깅 → 시도 3
시도 3 실패 → 최종 에러 throw
```

### withTimeout(fn, ms = 10000)

Playwright의 `waitForSelector`나 페이지 평가 작업은 대상 사이트 상태에 따라 오래 대기할 수 있습니다.
`withTimeout`은 특정 작업에 별도 제한 시간이 필요할 때 사용할 수 있는 공통 유틸리티입니다.

현재 주요 크롤러는 `navigate()`와 `waitForSelector(..., { timeout })`의 Playwright 타임아웃을 주로 사용하고, `withTimeout`은 필요 시 추가로 적용할 수 있도록 `BaseCrawler`에 둡니다.

---

## 데이터 검증 레이어를 별도로 둔 이유

크롤러의 `run()`은 사이트에서 원본 데이터를 수집하는 책임만 가집니다.
수집 후 데이터 품질 검증은 `runCrawlerPipeline`에서 `validate()`로 공통 처리합니다.

```
수집 → [validate] → (translate) → save
         ↑
    이 레이어가 불량 데이터를 걸러냄
```

검증 레이어를 별도로 두면 다음 이점이 있습니다.

1. 불량 데이터가 번역 API에 도달하지 않아 **비용과 시간 낭비를 줄임**
2. 어떤 필드 때문에 항목이 실패했는지 **명확히 로깅**
3. 크롤러의 파싱 로직을 건드리지 않고 **검증 규칙만 독립적으로 수정 가능**
4. CNNVD, Books, AliExpress 수신 데이터처럼 서로 다른 데이터 구조에도 `requiredFields` 설정으로 대응 가능

---

## 셀렉터를 별도 파일로 분리한 이유

크롤링 대상 사이트는 프론트엔드 배포나 마크업 변경으로 CSS 셀렉터가 바뀔 수 있습니다.
셀렉터가 여러 함수에 하드코딩되어 있으면 변경 시 전체 크롤러를 검색해야 합니다.

사이트별 셀렉터를 설정 파일에 모아두면:

- 셀렉터 변경 범위가 설정 파일로 좁아짐
- 크롤러 코드가 “무엇을 파싱하는지”에 더 집중됨
- 테스트에서 셀렉터 의존성을 확인하기 쉬움

CNNVD 셀렉터는 `src/config/selectors.ts`, Books 셀렉터는 `src/config/booksSelectors.ts`에서 관리합니다.
