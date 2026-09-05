import { App, normalizePath, TFile } from "obsidian";
import {
  createEmptyIntensiveMemory,
  getIntensiveMemoryPath,
  upsertIntensiveMemoryEntry,
  validateIntensiveMemory,
  type IntensiveMemoryEntry
} from "./intensive-memory-core";

export interface IntensiveMemoryLoadResult {
  path: string;
  sentences: Record<string, IntensiveMemoryEntry>;
  warning: string | null;
}

/** 将用户默写记录写在笔记库中，并串行化同一字幕文件的并发更新。 */
export class IntensiveMemoryStore {
  private readonly writeQueues = new Map<string, Promise<void>>();

  constructor(private readonly app: App) {}

  async load(transcriptPath: string, videoId: string): Promise<IntensiveMemoryLoadResult> {
    const path = normalizePath(getIntensiveMemoryPath(transcriptPath));
    const abstractFile = this.app.vault.getAbstractFileByPath(path);
    if (abstractFile === null) {
      return { path, sentences: {}, warning: null };
    }
    if (!(abstractFile instanceof TFile)) {
      return {
        path,
        sentences: {},
        warning: `单句默写记忆路径不是文件，已忽略：${path}`
      };
    }
    try {
      const parsed: unknown = JSON.parse(await this.app.vault.cachedRead(abstractFile));
      const memory = validateIntensiveMemory(parsed, videoId);
      return { path, sentences: memory.sentences, warning: null };
    } catch {
      return {
        path,
        sentences: {},
        warning: `单句默写记忆格式错误，已忽略：${path}`
      };
    }
  }

  async upsert(
    transcriptPath: string,
    videoId: string,
    fingerprint: string,
    entry: IntensiveMemoryEntry
  ): Promise<void> {
    const path = normalizePath(getIntensiveMemoryPath(transcriptPath));
    const previous = this.writeQueues.get(path) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(() => this.upsertNow(path, videoId, fingerprint, entry));
    this.writeQueues.set(path, current);
    try {
      await current;
    } finally {
      if (this.writeQueues.get(path) === current) {
        this.writeQueues.delete(path);
      }
    }
  }

  private async upsertNow(
    path: string,
    videoId: string,
    fingerprint: string,
    entry: IntensiveMemoryEntry
  ): Promise<void> {
    const abstractFile = this.app.vault.getAbstractFileByPath(path);
    if (abstractFile !== null && !(abstractFile instanceof TFile)) {
      throw new Error(`单句默写记忆路径不是文件：${path}`);
    }
    if (abstractFile instanceof TFile) {
      await this.app.vault.process(abstractFile, (raw) => {
        let memory = createEmptyIntensiveMemory(videoId);
        try {
          memory = validateIntensiveMemory(JSON.parse(raw) as unknown, videoId);
        } catch {
          // 损坏或过期的数据会在下一次有效输入时重建，避免阻断精听。
        }
        const updated = upsertIntensiveMemoryEntry(memory, fingerprint, entry);
        return `${JSON.stringify(updated, null, 2)}\n`;
      });
      return;
    }
    const memory = upsertIntensiveMemoryEntry(
      createEmptyIntensiveMemory(videoId),
      fingerprint,
      entry
    );
    await this.app.vault.create(path, `${JSON.stringify(memory, null, 2)}\n`);
  }
}
