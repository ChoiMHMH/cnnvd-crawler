import type { AliExpressProduct, ScrapResponse } from "./types.js";

/**
 * Offscreen document.
 * background에서 받은 상품 데이터를 로컬 수신 서버로 POST 전송한다.
 */

const SERVER_URL = "http://localhost:3500/product";

chrome.runtime.onMessage.addListener(
  (message: { type: string; payload: AliExpressProduct }, _sender, sendResponse: (resp: ScrapResponse) => void) => {
    if (message.type !== "FORWARD_TO_SERVER") return false;

    (async () => {
      try {
        const res = await fetch(SERVER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message.payload),
        });

        if (!res.ok) {
          throw new Error(`서버 응답 ${res.status}: ${await res.text()}`);
        }

        const body = await res.json();
        console.log("[offscreen] 서버 전송 성공:", body);

        sendResponse({ type: "SCRAP_RESULT", success: true });
      } catch (error) {
        console.error("[offscreen] 서버 전송 실패:", (error as Error).message);
        sendResponse({
          type: "SCRAP_RESULT",
          success: false,
          error: (error as Error).message,
        });
      }
    })();

    return true;
  },
);
