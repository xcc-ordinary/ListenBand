import type {
  TranslationProvider,
  TranslationRequestBody
} from "./translation-core";

export type DictationReviewVerdict = "correct" | "minor" | "revise";

export interface DictationReviewCorrection {
  issue: string;
  correction: string;
  explanation: string;
}

export interface DictationReview {
  verdict: DictationReviewVerdict;
  score: number;
  summary: string;
  corrections: DictationReviewCorrection[];
  ieltsTip: string;
}

const DICTATION_REVIEW_SYSTEM_PROMPT = [
  "你是一名严格、简洁的 IELTS 英语教师，负责批改单句精听默写。",
  "对照标准原文，优先检查漏词、错词、拼写、词形、时态、介词和语序。",
  "只指出用户答案中真实存在且影响听辨或语言准确度的问题，不扩展赏析，不重复原文，不写长篇解释。",
  "score 为 0 到 100 的整数；verdict 只能是 correct、minor 或 revise。",
  "corrections 最多 3 项，每项包含 issue、correction、explanation；ieltsTip 只给一条最有价值的雅思听力建议。",
  "只输出 JSON，不要 Markdown。格式：",
  '{"verdict":"minor","score":85,"summary":"一句中文总结","corrections":[{"issue":"用户写法","correction":"正确写法","explanation":"简短中文原因"}],"ieltsTip":"一条中文建议"}'
].join("");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isShortText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.trim().length <= maximum;
}

export function createDictationReviewCacheKey(original: string, draft: string): string {
  return `${original}\u0000${draft}`;
}

export function buildDictationReviewRequestBody(
  provider: Exclude<TranslationProvider, "disabled">,
  model: string,
  original: string,
  draft: string
): TranslationRequestBody {
  const body: TranslationRequestBody = {
    model,
    messages: [
      { role: "system", content: DICTATION_REVIEW_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({ standardTranscript: original, learnerDictation: draft })
      }
    ],
    stream: false,
    max_tokens: 420
  };
  if (provider === "deepseek" || provider === "kimi") {
    body.thinking = { type: "disabled" };
  }
  return body;
}

export function parseDictationReview(content: string): DictationReview {
  const normalized = content.trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized) as unknown;
  } catch {
    throw new Error("AI 批改结果不是有效 JSON，请重新批改。");
  }
  if (!isRecord(parsed)) {
    throw new Error("AI 批改结果格式不正确，请重新批改。");
  }
  const verdict = parsed.verdict;
  const corrections = parsed.corrections;
  if (
    (verdict !== "correct" && verdict !== "minor" && verdict !== "revise") ||
    typeof parsed.score !== "number" ||
    !Number.isInteger(parsed.score) ||
    parsed.score < 0 ||
    parsed.score > 100 ||
    !isShortText(parsed.summary, 240) ||
    !Array.isArray(corrections) ||
    corrections.length > 3 ||
    !corrections.every((item) =>
      isRecord(item) &&
      isShortText(item.issue, 160) &&
      isShortText(item.correction, 160) &&
      isShortText(item.explanation, 280)
    ) ||
    !isShortText(parsed.ieltsTip, 320)
  ) {
    throw new Error("AI 批改结果包含无效字段，请重新批改。");
  }
  return {
    verdict,
    score: parsed.score,
    summary: parsed.summary.trim(),
    corrections: corrections.map((item) => ({
      issue: (item as Record<string, string>).issue.trim(),
      correction: (item as Record<string, string>).correction.trim(),
      explanation: (item as Record<string, string>).explanation.trim()
    })),
    ieltsTip: parsed.ieltsTip.trim()
  };
}
