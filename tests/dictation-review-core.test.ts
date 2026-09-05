import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDictationReviewRequestBody,
  createDictationReviewCacheKey,
  parseDictationReview
} from "../src/dictation-review-core";

test("单句批改使用短输出并关闭 DeepSeek 与 Kimi 思考", () => {
  const deepSeek = buildDictationReviewRequestBody(
    "deepseek",
    "deepseek-v4-flash",
    "I have lived here for five years.",
    "I live here since five years."
  );
  assert.equal(deepSeek.max_tokens, 420);
  assert.deepEqual(deepSeek.thinking, { type: "disabled" });
  assert.match(deepSeek.messages[0]?.content ?? "", /IELTS/u);
  assert.match(deepSeek.messages[0]?.content ?? "", /只输出 JSON/u);
  assert.match(deepSeek.messages[1]?.content ?? "", /I live here since five years/u);

  const relay = buildDictationReviewRequestBody(
    "openai-compatible",
    "fast-model",
    "Original.",
    "Answer."
  );
  assert.equal("thinking" in relay, false);
});

test("解析简洁的 IELTS 默写批改结果", () => {
  const review = parseDictationReview(`\`\`\`json
  {
    "verdict": "revise",
    "score": 62,
    "summary": "时态和介词需要调整。",
    "corrections": [
      { "issue": "I live", "correction": "I have lived", "explanation": "持续到现在用现在完成时。" }
    ],
    "ieltsTip": "雅思听力注意 for 与 since 后接时间的区别。"
  }
  \`\`\``);
  assert.equal(review.verdict, "revise");
  assert.equal(review.score, 62);
  assert.equal(review.corrections[0]?.correction, "I have lived");
});

test("批改缓存键随原句或用户答案变化", () => {
  assert.equal(createDictationReviewCacheKey("Original", "Answer"), "Original\u0000Answer");
  assert.notEqual(
    createDictationReviewCacheKey("Original", "Answer"),
    createDictationReviewCacheKey("Original", "Changed")
  );
});

test("批改结果限制分数和条目数量", () => {
  assert.throws(() => parseDictationReview(JSON.stringify({
    verdict: "minor",
    score: 101,
    summary: "错误",
    corrections: [],
    ieltsTip: "提示"
  })), /批改结果/u);
  assert.throws(() => parseDictationReview(JSON.stringify({
    verdict: "minor",
    score: 80,
    summary: "错误",
    corrections: Array.from({ length: 4 }, () => ({
      issue: "a",
      correction: "b",
      explanation: "c"
    })),
    ieltsTip: "提示"
  })), /批改结果/u);
});
