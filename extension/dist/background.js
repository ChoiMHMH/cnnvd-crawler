(function() {
  "use strict";
  let offscreenReady = false;
  async function ensureOffscreen() {
    if (offscreenReady) return;
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
    });
    if (contexts.length > 0) {
      offscreenReady = true;
      return;
    }
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
      justification: "로컬 서버로 상품 데이터 전송"
    });
    offscreenReady = true;
  }
  chrome.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
      if (message.type !== "SCRAP_PRODUCT") return false;
      (async () => {
        try {
          await ensureOffscreen();
          const result = await chrome.runtime.sendMessage({
            type: "FORWARD_TO_SERVER",
            payload: message.payload
          });
          sendResponse(result);
        } catch (error) {
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
