import type { ScrapMessage, ScrapResponse } from "./types.js";

/**
 * Background service worker.
 * content script에서 받은 상품 데이터를 offscreen document로 중계한다.
 */

let offscreenReady = false;

async function ensureOffscreen(): Promise<void> {
  if (offscreenReady) return;

  // 이미 존재하는지 확인
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (contexts.length > 0) {
    offscreenReady = true;
    return;
  }

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
    justification: "로컬 서버로 상품 데이터 전송",
  });

  offscreenReady = true;
}

chrome.runtime.onMessage.addListener(
  (message: ScrapMessage, _sender, sendResponse: (resp: ScrapResponse) => void) => {
    if (message.type !== "SCRAP_PRODUCT") return false;

    (async () => {
      try {
        await ensureOffscreen();

        // offscreen으로 메시지 전달
        const result: ScrapResponse = await chrome.runtime.sendMessage({
          type: "FORWARD_TO_SERVER",
          payload: message.payload,
        });

        sendResponse(result);
      } catch (error) {
        sendResponse({
          type: "SCRAP_RESULT",
          success: false,
          error: (error as Error).message,
        });
      }
    })();

    // 비동기 응답을 위해 true 반환
    return true;
  },
);
