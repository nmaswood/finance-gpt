import {
  assertNever,
  FileProgress,
  ProgressForPdfTasks,
  ProgressTaskStatus,
} from "@fgpt/precedent-iso";

import { TaskStore } from "../task-store";
import { statusForFile } from "./status-for-file";

interface ProgressOptions {
  longFormReport: boolean;
}
export interface ProcessedFileProgressService {
  getProgress(
    options: ProgressOptions,
    processedFileId: string,
  ): Promise<FileProgress<ProgressForPdfTasks>>;
}

export class ProcessedFileProgressServiceImpl
  implements ProcessedFileProgressService
{
  constructor(private readonly taskStore: TaskStore) {}
  async getProgress(
    options: ProgressOptions,
    fileReferenceId: string,
  ): Promise<FileProgress<ProgressForPdfTasks>> {
    const tasks = await this.taskStore.getByFileReferenceId(fileReferenceId);

    const forTask: ProgressForPdfTasks = {
      embeddingChunk: "task_does_not_exist",
      reportChunk: "task_does_not_exist",
      report: "task_does_not_exist",
      upsertEmbeddings: "task_does_not_exist",
      extractTable: "task_does_not_exist",
      analyzeTable: "task_does_not_exist",
      thumbnail: "task_does_not_exist",
      ...(options.longFormReport
        ? {
            longFormReport: "task_does_not_exist",
            longFormReportChunk: "task_does_not_exist",
          }
        : undefined),
    };

    for (const task of tasks) {
      switch (task.config.type) {
        case "text-chunk": {
          switch (task.config.strategy) {
            case "greedy_v0": {
              forTask.embeddingChunk = task.status;
              break;
            }
            case "greedy_15k": {
              forTask.reportChunk = task.status;
              break;
            }
            case "greedy_125k": {
              forTask.longFormReportChunk = task.status;
              break;
            }
            default:
              assertNever(task.config.strategy);
          }
          break;
        }

        case "gen-embeddings": {
          forTask.upsertEmbeddings = task.status;
          break;
        }
        case "llm-outputs": {
          forTask.report = task.status;
          break;
        }
        case "extract-table": {
          forTask.extractTable = task.status;
          break;
        }
        case "analyze-table": {
          forTask.analyzeTable = task.status;
          break;
        }
        case "long-form":
          forTask.longFormReport = task.status;
          break;

        case "thumbnail": {
          forTask.thumbnail = task.status;
          break;
        }
        case "ingest-file":
        case "text-extraction":
          break;

        default:
          assertNever(task.config);
      }
    }
    const statuses: ProgressTaskStatus[] = Object.values(forTask);

    return {
      status: statusForFile(statuses),
      forTask,
    };
  }
}
