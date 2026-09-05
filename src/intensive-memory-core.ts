export interface IntensiveMemoryEntry {
  sourceText: string;
  draft: string;
  revealed: boolean;
  updatedAt: string;
}

export interface IntensiveMemoryFile {
  version: 1;
  videoId: string;
  sentences: Record<string, IntensiveMemoryEntry>;
}

const DEFAULT_MAXIMUM_ENTRIES = 5_000;
const MAXIMUM_SOURCE_LENGTH = 10_000;
const MAXIMUM_DRAFT_LENGTH = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function getIntensiveMemoryPath(transcriptPath: string): string {
  const withoutJson = transcriptPath.toLowerCase().endsWith(".json")
    ? transcriptPath.slice(0, -5)
    : transcriptPath;
  return `${withoutJson}.listenband-progress.json`;
}

export function createEmptyIntensiveMemory(videoId: string): IntensiveMemoryFile {
  return {
    version: 1,
    videoId,
    sentences: {}
  };
}

export function validateIntensiveMemory(
  value: unknown,
  videoId: string,
  maximumEntries = DEFAULT_MAXIMUM_ENTRIES
): IntensiveMemoryFile {
  if (!isRecord(value)) {
    throw new Error("单句默写记忆最外层不是 JSON 对象");
  }
  if (value.version !== 1 || value.videoId !== videoId) {
    throw new Error("单句默写记忆版本或视频 ID 不匹配");
  }
  if (!isRecord(value.sentences)) {
    throw new Error("单句默写记忆 sentences 字段格式不正确");
  }

  const rawEntries = Object.entries(value.sentences);
  if (rawEntries.length > maximumEntries) {
    throw new Error("单句默写记忆数量超过安全上限");
  }
  const sentences: Record<string, IntensiveMemoryEntry> = {};
  for (const [fingerprint, rawEntry] of rawEntries) {
    if (!/^[a-f0-9]{64}$/u.test(fingerprint) || !isRecord(rawEntry)) {
      throw new Error("单句默写记忆包含无效句子指纹或条目");
    }
    if (
      typeof rawEntry.sourceText !== "string" ||
      rawEntry.sourceText.length > MAXIMUM_SOURCE_LENGTH ||
      typeof rawEntry.draft !== "string" ||
      rawEntry.draft.length > MAXIMUM_DRAFT_LENGTH ||
      typeof rawEntry.revealed !== "boolean" ||
      !isValidTimestamp(rawEntry.updatedAt)
    ) {
      throw new Error("单句默写记忆包含格式不正确的条目");
    }
    sentences[fingerprint] = {
      sourceText: rawEntry.sourceText,
      draft: rawEntry.draft,
      revealed: rawEntry.revealed,
      updatedAt: rawEntry.updatedAt
    };
  }
  return { version: 1, videoId, sentences };
}

export function upsertIntensiveMemoryEntry(
  current: IntensiveMemoryFile,
  fingerprint: string,
  entry: IntensiveMemoryEntry,
  maximumEntries = DEFAULT_MAXIMUM_ENTRIES
): IntensiveMemoryFile {
  const sentences = {
    ...current.sentences,
    [fingerprint]: entry
  };
  const overflow = Object.keys(sentences).length - maximumEntries;
  if (overflow > 0) {
    const oldest = Object.entries(sentences)
      .sort((left, right) => Date.parse(left[1].updatedAt) - Date.parse(right[1].updatedAt))
      .slice(0, overflow);
    for (const [oldFingerprint] of oldest) {
      delete sentences[oldFingerprint];
    }
  }
  return { ...current, sentences };
}
