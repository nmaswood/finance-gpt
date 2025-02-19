import { FileStatus } from "./file";
import { TaskStatus } from "./task";

export type ProgressTaskStatus = "task_does_not_exist" | TaskStatus;

export interface FileProgress<
  T extends ProgressForPdfTasks | ProgressForExcelTasks,
> {
  status: FileStatus;
  forTask: T;
}

export interface ProgressForPdfTasks {
  embeddingChunk: ProgressTaskStatus;
  report: ProgressTaskStatus;

  upsertEmbeddings: ProgressTaskStatus;
  extractTable: ProgressTaskStatus;
  thumbnail: ProgressTaskStatus;

  longFormReportChunk?: ProgressTaskStatus;
  longFormReport?: ProgressTaskStatus;

  scan: ProgressTaskStatus;
}

export interface ProgressForExcelTasks {
  analyzeTableClaude: ProgressTaskStatus;
}
