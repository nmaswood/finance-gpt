import { PromptSlug } from "./prompt";

export interface Question {
  id: string;
  question: string;
}

export type MiscValue =
  | {
      type: "terms";
      value: Term[];
      order: number | undefined;
    }
  | {
      type: "long_form";
      raw: string;
      html: string | undefined;
    }
  | {
      type: "output";
      slug: PromptSlug;
      raw: string;
      html: string | undefined;
    };

export interface MiscValueRow {
  id: string;
  chunk:
    | {
        textChunkId: string;
        textChunkGroupId: string;
      }
    | undefined;

  value: MiscValue;
}

export interface Term {
  termValue: string;
  termName: string;
}

export interface Report {
  terms: Term[];
  longForm: LongForm[];
  outputs: PromptOutput[];
}

export interface PromptOutput {
  slug: PromptSlug;
  raw: string;
  html: string | undefined;
}

export interface LongForm {
  raw: string;
  html: string | undefined;
}
