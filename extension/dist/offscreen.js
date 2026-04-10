(function() {
  "use strict";
  const SERVER_URL = "http://localhost:3500/product";
  chrome.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
      if (message.type !== "FORWARD_TO_SERVER") return false;
      (async () => {
        try {
          const res = await fetch(SERVER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message.payload)
          });
          if (!res.ok) {
            throw new Error(`서버 응답 ${res.status}: ${await res.text()}`);
          }
          const body = await res.json();
          console.log("[offscreen] 서버 전송 성공:", body);
          sendResponse({ type: "SCRAP_RESULT", success: true });
        } catch (error) {
          console.error("[offscreen] 서버 전송 실패:", error.message);
          sendResponse({
            type: "SCRAP_RESULT",
            success: false,
            error: error.message
          });
        }
      })();
      return true;
    }
  );
})();
