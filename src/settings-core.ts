import { DEFAULT_TRANSCRIPT_FOLDER, sanitizeTranscriptFolder } from "./import-core";
import type { DeepSeekModel, KimiModel, TranslationProvider } from "./translation-core";
import type { StudyProfile } from "./study-core";

export interface ListenBandSettings {
  transcriptFolder: string;
  ytDlpPath: string;
  autoImportPastedVideoLinks: boolean;
  translationProvider: TranslationProvider;
  translateWholeTranscript: boolean;
  deepSeekModel: DeepSeekModel;
  deepSeekSecretId: string;
  kimiModel: KimiModel;
  kimiSecretId: string;
  customBaseUrl: string;
  customModel: string;
  customSecretId: string;
  cacheTranslations: boolean;
  studyProfile: StudyProfile;
  dailyNewWordLimit: number;
}

export const DEFAULT_SETTINGS: ListenBandSettings = {
  transcriptFolder: DEFAULT_TRANSCRIPT_FOLDER,
  ytDlpPath: "",
  // 默认由用户点击左侧 ListenBand Logo 后开始导入，避免粘贴资料时误触发。
  autoImportPastedVideoLinks: false,
  translationProvider: "disabled",
  // 默认只处理用户当前选择的句子，避免新用户误触整篇翻译并产生额外费用。
  translateWholeTranscript: false,
  deepSeekModel: "deepseek-v4-flash",
  deepSeekSecretId: "",
  kimiModel: "kimi-k2.6",
  kimiSecretId: "",
  customBaseUrl: "",
  customModel: "",
  customSecretId: "",
  cacheTranslations: true,
  studyProfile: "ielts",
  dailyNewWordLimit: 10
};

/** 读取旧配置时只保留仍受支持的字段；旧 whisperModel 会在这里被移除。 */
export function sanitizeSettings(value: unknown): ListenBandSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_SETTINGS };
  }

  const data = value as Record<string, unknown>;
  const provider = data.translationProvider;
  const model = data.deepSeekModel;
  const kimiModel = data.kimiModel;

  return {
    transcriptFolder: sanitizeTranscriptFolder(data.transcriptFolder),
    ytDlpPath: typeof data.ytDlpPath === "string" ? data.ytDlpPath.trim() : "",
    autoImportPastedVideoLinks:
      typeof data.autoImportPastedVideoLinks === "boolean"
        ? data.autoImportPastedVideoLinks
        : DEFAULT_SETTINGS.autoImportPastedVideoLinks,
    translationProvider:
      provider === "deepseek" || provider === "kimi" ||
        provider === "openai-compatible" || provider === "disabled"
        ? provider
        : DEFAULT_SETTINGS.translationProvider,
    translateWholeTranscript:
      typeof data.translateWholeTranscript === "boolean"
        ? data.translateWholeTranscript
        : DEFAULT_SETTINGS.translateWholeTranscript,
    deepSeekModel:
      model === "deepseek-v4-flash" || model === "deepseek-v4-pro"
        ? model
        : DEFAULT_SETTINGS.deepSeekModel,
    deepSeekSecretId: typeof data.deepSeekSecretId === "string" ? data.deepSeekSecretId : "",
    kimiModel: kimiModel === "kimi-k2.6" ? kimiModel : DEFAULT_SETTINGS.kimiModel,
    kimiSecretId: typeof data.kimiSecretId === "string" ? data.kimiSecretId : "",
    customBaseUrl: typeof data.customBaseUrl === "string" ? data.customBaseUrl : "",
    customModel: typeof data.customModel === "string" ? data.customModel : "",
    customSecretId: typeof data.customSecretId === "string" ? data.customSecretId : "",
    cacheTranslations:
      typeof data.cacheTranslations === "boolean"
        ? data.cacheTranslations
        : DEFAULT_SETTINGS.cacheTranslations,
    // 1.3 起翻译与知识卡只提供雅思专项。读取旧配置时直接迁移，
    // 避免旧的 CET/TEM/TOEFL 选择继续影响新生成内容。
    studyProfile: "ielts",
    dailyNewWordLimit:
      typeof data.dailyNewWordLimit === "number" && Number.isFinite(data.dailyNewWordLimit)
        ? Math.min(50, Math.max(1, Math.round(data.dailyNewWordLimit)))
        : DEFAULT_SETTINGS.dailyNewWordLimit
  };
}
