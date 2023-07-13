import {
  assertNever,
  FileProgress,
  ProgressForExcelTasks,
} from "@fgpt/precedent-iso";

import { TaskStore } from "./task-store";

export interface ExcelProgressStore {
  getProgress(
    processedFileId: string,
  ): Promise<FileProgress<ProgressForExcelTasks>>;
}

export class PSqlExcelProgressStore implements ExcelProgressStore {
  constructor(private readonly taskStore: TaskStore) {}
  async getProgress(
    fileReferenceId: string,
  ): Promise<FileProgress<ProgressForExcelTasks>> {
    const tasks = await this.taskStore.getByFileReferenceId(fileReferenceId);

    const forTask: ProgressForExcelTasks = {
      analyzeTableGPT: { type: "task_does_not_exist" },
      analyzeTableClaude: { type: "task_does_not_exist" },
    };

    for (const task of tasks) {
      switch (task.config.type) {
        case "analyze-table": {
          switch (task.config.model) {
            case "gpt":
            case undefined:
            case null: {
              forTask.analyzeTableGPT = { type: task.status };
              break;
            }
            case "claude": {
              forTask.analyzeTableClaude = { type: task.status };
              break;
            }
            default:
              assertNever(task.config.model);
          }
          break;
        }
        case "gen-embeddings":
        case "llm-outputs":
        case "extract-table":
        case "long-form":
        case "ingest-file":
        case "text-extraction":
        case "text-chunk":
          break;
        default:
          assertNever(task.config);
      }
    }

    return {
      forTask,
      // just hard code for now
      type: "pending",
    };
  }
}
