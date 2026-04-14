# 재사용 가능한 데이터 수집 파이프라인 리팩토링

 기존 단일 스크립트 기반 CNNVD 크롤러를 TypeScript + Playwright 기반 파이프라인으로 리팩토링한 프로젝트입니다.  
 공통 브라우저 인프라, 검증/저장 파이프라인, 확장프로그램 기반 PoC를 연결해 **새 수집 소스를 붙일 수 있는 구조**를 검증했습니다.
 
<img width="1536" height="859" alt="크롤러 bofore-after 1" src="https://github.com/user-attachments/assets/49530dfb-ed48-4d86-975a-9b1907d1d02c" />


## 한눈에 보기

- **BaseCrawler 수정 0줄**로 `BooksCrawler` 추가
- **하드코딩 셀렉터 9 → 0**
- **테스트 0 → 64**
- **확장프로그램 PoC에서도 validate/save 재사용률 100%**
- **전 파일 TypeScript 전환 + `tsc --noEmit` 통과**

## 무엇을 바꿨는가

### Before
- 브라우저 제어, 파싱, 검증, 저장이 단일 스크립트에 섞여 있음
- 새 사이트 추가 시 재사용 가능한 계층이 거의 없음
- 테스트 작성이 어려운 구조

### After
- 브라우저 제어는 `BaseCrawler`
- 수집 후 처리는 `runCrawlerPipeline`
- `validate → translate → save` 단계 분리
- 사이트별 차이는 크롤러/셀렉터/config에 격리
- 테스트 가능한 구조로 전환

## 핵심 설계

### 1. BaseCrawler
공통 브라우저 생명주기, 재시도, 타임아웃을 담당합니다.

### 2. runCrawlerPipeline
수집 결과를 바로 저장하지 않고, 공통 파이프라인에서 처리합니다.
<img width="1536" height="469" alt="공통 파이프라인 1" src="https://github.com/user-attachments/assets/5b629929-f944-4744-8dd1-adadd6bf516d" />


```text
crawler.run()
  → validate()
  → translate()   // optional
  → save()
```

### 3. 설정 기반 확장
사이트별 차이는 crawler + selectors + pipelineConfig 로 분리했습니다.


## 실제 이커머스 환경에서의 판단
이 프로젝트는 실서비스 이커머스 운영 완성본이 아니라, 구조와 접근 전략을 검증한 PoC입니다.
- books.toscrape.com은 실서비스 증명이 아니라 구조 확장성 검증용 통제 사이트
- 1688 , Alibaba는 headless 접근에서 차단, CAPTCHA 확인
- 무리한 우회보다 API 우선, 보완 수집 분리 전략이 현실적이라고 판단
- AliExpress 상세 페이지는 Chrome Extension 기반 PoC로 보완 수집 흐름 검증

## 검증 결과
- TypeScript build 통과
- 루트 타입 체크 통과
- 확장프로그램 타입 체크 통과
- Vitest 7개 파일 / 64개 테스트 전부 통과
> parser test는 기존에 jsdom 환경에서 Node 전용 fs/path import와 충돌해 suite 로딩 문제가 있었고, fixture를 Vite ?raw import로 전환해 해결했습니다.

### 실행
```
npm install
cd extension && npm install
npm run start:cnnvd
npm test
```

### 자세한 기록
- docs/ 설계 문서
- 블로그 포스팅 링크 예정
