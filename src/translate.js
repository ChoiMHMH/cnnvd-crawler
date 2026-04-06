import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Claude API를 사용하여 중국어 텍스트를 한국어로 번역합니다.
 * 번역 실패 시 크롤링 중단을 막기 위해 원문을 반환합니다.
 * @param {string} text - 번역할 중국어 텍스트
 * @returns {Promise<string>} 한국어 번역 결과 또는 원문
 */
async function translateText(text) {
  if (!text || text.trim() === "") return text;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `다음 중국어 텍스트를 한국어로 번역해주세요. 번역 결과만 출력하고, 설명이나 부가적인 내용은 포함하지 마세요.\n\n${text}`,
        },
      ],
    });

    return message.content[0]?.text ?? text;
  } catch (error) {
    console.error("[translate] 번역 실패, 원문 반환:", error.message);
    return text;
  }
}

/**
 * 수집된 데이터 배열 전체를 번역합니다.
 * 각 항목의 detailTitle, detailSubtitle, contents, table을 번역합니다.
 * @param {Array<Object>} items - 번역할 데이터 배열
 * @returns {Promise<Array<Object>>} 번역된 데이터 배열
 */
export async function translate(items) {
  const translated = [];

  for (const item of items) {
    const [title, subtitle, contents, table] = await Promise.all([
      translateText(item.detailTitle),
      translateText(item.detailSubtitle),
      translateText(item.contents),
      translateText(item.table),
    ]);

    translated.push({ ...item, detailTitle: title, detailSubtitle: subtitle, contents, table });
  }

  return translated;
}
