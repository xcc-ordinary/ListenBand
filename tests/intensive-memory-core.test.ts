import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyIntensiveMemory,
  getIntensiveMemoryPath,
  upsertIntensiveMemoryEntry,
  validateIntensiveMemory
} from "../src/intensive-memory-core";

const fingerprint = "a".repeat(64);

test("单句精听记忆使用可随笔记库同步的独立文件", () => {
  assert.equal(
    getIntensiveMemoryPath("Study/Transcripts/demo.json"),
    "Study/Transcripts/demo.listenband-progress.json"
  );
});

test("默写草稿按视频和句子指纹持久化并可在重启后恢复", () => {
  const empty = createEmptyIntensiveMemory("video-1");
  const saved = upsertIntensiveMemoryEntry(empty, fingerprint, {
    sourceText: "Practice makes progress.",
    draft: "Practice makes progres",
    revealed: true,
    updatedAt: "2026-09-05T00:00:00.000Z"
  });

  const restored = validateIntensiveMemory(JSON.parse(JSON.stringify(saved)), "video-1");
  assert.deepEqual(restored.sentences[fingerprint], saved.sentences[fingerprint]);
  assert.throws(() => validateIntensiveMemory(saved, "another-video"), /视频 ID/u);
});

test("句子指纹变化不会错误套用旧默写且记忆数量受到限制", () => {
  let memory = createEmptyIntensiveMemory("video-1");
  for (let index = 0; index < 5; index += 1) {
    memory = upsertIntensiveMemoryEntry(memory, index.toString(16).padStart(64, "0"), {
      sourceText: `Sentence ${index}`,
      draft: `Draft ${index}`,
      revealed: false,
      updatedAt: new Date(index * 1_000).toISOString()
    }, 3);
  }

  assert.equal(Object.keys(memory.sentences).length, 3);
  assert.equal(memory.sentences[fingerprint], undefined);
  assert.equal(memory.sentences["0".repeat(63) + "4"]?.draft, "Draft 4");
});

test("异常和超长默写数据会被拒绝", () => {
  const invalid = createEmptyIntensiveMemory("video-1") as unknown as Record<string, unknown>;
  invalid.sentences = {
    [fingerprint]: {
      sourceText: "Sentence",
      draft: "x".repeat(20_001),
      revealed: false,
      updatedAt: "2026-09-05T00:00:00.000Z"
    }
  };
  assert.throws(() => validateIntensiveMemory(invalid, "video-1"), /默写记忆/u);
});
