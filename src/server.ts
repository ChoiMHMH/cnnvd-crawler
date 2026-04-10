import express from "express";
import { validate } from "./validate.js";
import { save } from "./saveToJson.js";
import { ALIEXPRESS_PIPELINE } from "./config/pipelineConfigs.js";

const PORT = 3500;

const app = express();
app.use(express.json({ limit: "5mb" }));

/**
 * POST /product
 * 확장프로그램에서 전송한 AliExpress 상품 데이터를 수신하여
 * validate → save 파이프라인을 실행한다.
 */
app.post("/product", async (req, res) => {
  const product = req.body;

  console.log(`[server] 상품 수신: ${product.productId} — ${product.title}`);

  const validated = validate([product], {
    requiredFields: ALIEXPRESS_PIPELINE.requiredFields,
  });

  if (validated.length === 0) {
    res.status(400).json({ success: false, error: "검증 실패 — 필수 필드 누락" });
    return;
  }

  try {
    await save(validated, ALIEXPRESS_PIPELINE.outputPath, {
      dedupKey: ALIEXPRESS_PIPELINE.dedupKey,
    });

    res.json({
      success: true,
      productId: product.productId,
      message: "저장 완료",
    });
  } catch (error) {
    console.error("[server] 저장 오류:", (error as Error).message);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /health
 * 서버 상태 확인용.
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`[server] 수신 서버 시작 — http://localhost:${PORT}`);
  console.log(`[server] POST /product — 상품 데이터 수신`);
  console.log(`[server] GET /health — 상태 확인`);
});
