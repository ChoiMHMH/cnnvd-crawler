import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function translateText(text: string): Promise<string> {
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

    const block = message.content[0];
    return block.type === "text" ? block.text : text;
  } catch (error) {
    console.error("[translate] 번역 실패, 원문 반환:", (error as Error).message);
    return text;
  }
}

async function translateContents(
  sections: { type: string; text: string }[],
): Promise<{ type: string; text: string }[]> {
  if (!Array.isArray(sections) || sections.length === 0) return sections;

  return Promise.all(
    sections.map(async (section) => ({
      type: section.type,
      text: await translateText(section.text),
    })),
  );
}

/**
 * 수집된 데이터 배열 전체를 번역합니다.
 */
export async function translate(
  items: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const translated: Record<string, unknown>[] = [];

  for (const item of items) {
    const [title, subtitle, contents, table] = await Promise.all([
      translateText(item.detailTitle as string),
      translateText(item.detailSubtitle as string),
      translateContents(item.contents as { type: string; text: string }[]),
      translateText(item.table as string),
    ]);

    translated.push({ ...item, detailTitle: title, detailSubtitle: subtitle, contents, table });
  }

  return translated;
}
