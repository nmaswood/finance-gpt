import { z } from "zod";

import { assertNever } from "../assert-never";
import { ZFileType } from "../file-type";
import { ZChunkStrategy } from "../text-chunker/text-chunker";
import { ExcelSource, ZExcelSource } from "./excel";
import { PromptSlug, ZPromptSlug } from "./prompt";

export const ZTaskType = z.enum([
  "ingest-file",
  "text-extraction",
  "text-chunk",
  "gen-embeddings",
  "llm-outputs",
  "extract-table",
  "analyze-table",
  "long-form",
  "thumbnail",
  "scan",
  "run-prompt",
  "hfm",
]);

export const ZTaskStatus = z.enum([
  "queued",
  "in-progress",
  "succeeded",
  "failed",
]);

export const ZIngestFileConfig = z.object({
  type: z.literal("ingest-file"),
  organizationId: z.string(),
  projectId: z.string(),
  fileReferenceId: z.string(),
  fileType: ZFileType,
});

export type IngestFileConfig = z.infer<typeof ZIngestFileConfig>;

export const ZTextExtractionConfig = z.object({
  type: z.literal("text-extraction"),
  organizationId: z.string(),
  projectId: z.string(),
  fileReferenceId: z.string(),
});

export type TextExtractionConfig = z.infer<typeof ZTextExtractionConfig>;

export const ZTextChunkConfig = z.object({
  type: z.literal("text-chunk"),
  organizationId: z.string(),
  projectId: z.string(),
  fileReferenceId: z.string(),
  processedFileId: z.string(),
  strategy: ZChunkStrategy,
});

export type TextChunkConfig = z.infer<typeof ZTextChunkConfig>;

export const ZGenEmbeddingsConfig = z.object({
  type: z.literal("gen-embeddings"),
  organizationId: z.string(),
  projectId: z.string(),
  fileReferenceId: z.string(),
  processedFileId: z.string(),
  textChunkGroupId: z.string(),
});

export type GenEmbeddingsConfig = z.infer<typeof ZGenEmbeddingsConfig>;

export const ZLLMOutputsConfig = z.object({
  type: z.literal("llm-outputs"),
  organizationId: z.string(),
  projectId: z.string(),
  fileReferenceId: z.string(),
  processedFileId: z.string(),
});

export const ZLongFormReportConfig = z.object({
  type: z.literal("long-form"),
  fileReferenceId: z.string(),
});

export type LongFormReportConfig = z.infer<typeof ZLongFormReportConfig>;

export const ZExtractTableConfig = z.object({
  type: z.literal("extract-table"),
  organizationId: z.string(),
  projectId: z.string(),
  fileReferenceId: z.string(),
});

export const ZAnalyzeTableModel = z.enum(["gpt", "claude"]);
export type AnalyzeTableModel = z.infer<typeof ZAnalyzeTableModel>;

export const ZTableTextAnalysis = z.object({
  type: z.literal("text"),
  model: ZAnalyzeTableModel,
});

export const ZTableAnalysis = z.discriminatedUnion("type", [
  ZTableTextAnalysis,
]);

export type TableAnalysis = z.infer<typeof ZTableAnalysis>;

export const ZAnalyzeTableConfig = z.object({
  type: z.literal("analyze-table"),
  organizationId: z.string(),
  projectId: z.string(),
  fileReferenceId: z.string(),
  source: ZExcelSource.nullable(),
  model: ZAnalyzeTableModel.optional().nullable(),
  analysis: ZTableAnalysis.optional().nullable(),
});

export interface AnalyzeTableConfig {
  type: "analyze-table";
  organizationId: string;
  projectId: string;
  fileReferenceId: string;
  source: ExcelSource | null;
  analysis: TableAnalysis;
}

export interface ThumbnailConfig {
  type: "thumbnail";
  fileReferenceId: string;
}

export const ZThumbnailConfig = z.object({
  type: z.literal("thumbnail"),
  fileReferenceId: z.string(),
});

export interface ScanConfig {
  type: "scan";
  fileReferenceId: string;
  processedFileId: string;
}

export const ZRunPromptConfig = z.object({
  type: z.literal("run-prompt"),
  fileReferenceId: z.string(),
  slug: ZPromptSlug,
});

export interface RunPromptConfig {
  type: "run-prompt";
  fileReferenceId: string;
  slug: PromptSlug;
}

export interface ScanConfig {
  type: "scan";
  fileReferenceId: string;
  processedFileId: string;
}
export const ZScanConfig = z.object({
  type: z.literal("scan"),
  fileReferenceId: z.string(),
  processedFileId: z.string(),
});

export interface HFMConfig {
  type: "hfm";
  fileReferenceId: string;
}

export const ZHFMConfig = z.object({
  type: z.literal("hfm"),
  fileReferenceId: z.string(),
});

export type TaskConfig =
  | IngestFileConfig
  | TextExtractionConfig
  | TextChunkConfig
  | GenEmbeddingsConfig
  | LLMOutputsConfig
  | ExtractTableConfig
  | LongFormReportConfig
  | AnalyzeTableConfig
  | ThumbnailConfig
  | ScanConfig
  | RunPromptConfig
  | HFMConfig;

function analysis(row: z.infer<typeof ZAnalyzeTableConfig>): TableAnalysis {
  if (row.analysis) {
    return row.analysis;
  }

  return row.model
    ? {
        type: "text",
        model: row.model,
      }
    : {
        type: "text",
        model: "gpt",
      };
}

export const ZTaskConfig = z
  .discriminatedUnion("type", [
    ZIngestFileConfig,
    ZTextExtractionConfig,
    ZTextChunkConfig,
    ZGenEmbeddingsConfig,
    ZLLMOutputsConfig,
    ZExtractTableConfig,
    ZLongFormReportConfig,
    ZAnalyzeTableConfig,
    ZThumbnailConfig,
    ZScanConfig,
    ZRunPromptConfig,
    ZHFMConfig,
  ])
  .transform((row): TaskConfig => {
    switch (row.type) {
      case "analyze-table": {
        return {
          ...row,
          source: row.source ?? null,
          analysis: analysis(row),
        };
      }
      case "ingest-file":
      case "text-extraction":
      case "text-chunk":
      case "gen-embeddings":
      case "llm-outputs":
      case "extract-table":
      case "long-form":
      case "thumbnail":
      case "scan":
      case "run-prompt":
      case "hfm":
        return row;
      default:
        assertNever(row);
    }
  });

export type ExtractTableConfig = z.infer<typeof ZExtractTableConfig>;

export type LLMOutputsConfig = z.infer<typeof ZLLMOutputsConfig>;

export type TaskType = z.infer<typeof ZTaskType>;
export type TaskStatus = z.infer<typeof ZTaskStatus>;
export type TaskOuput = Record<string, unknown>;
