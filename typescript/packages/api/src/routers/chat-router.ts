import { assertNever } from "@fgpt/precedent-iso";
import {
  ChatStore,
  FileReferenceStore,
  MLServiceClient,
  TextChunkStore,
} from "@fgpt/precedent-node";
import express from "express";
import { keyBy, uniqBy } from "lodash";
import { z } from "zod";

import { LOGGER } from "../logger";

const encoder = new TextEncoder();

export class ChatRouter {
  constructor(
    private readonly mlClient: MLServiceClient,
    private readonly textChunkStore: TextChunkStore,
    private readonly chatStore: ChatStore,
    private readonly fileReferenceStore: FileReferenceStore
  ) {}
  init() {
    const router = express.Router();

    router.get(
      "/list-project-chats/:projectId",
      async (req: express.Request, res: express.Response) => {
        const body = ZListProjectChatRequest.parse(req.params);
        const chats = await this.chatStore.listProjectChats(body.projectId);
        res.json({ chats });
      }
    );

    router.get(
      "/list-file-chats/:fileReferenceId",
      async (req: express.Request, res: express.Response) => {
        const body = ZListFileChatRequest.parse(req.params);
        const chats = await this.chatStore.listfileReferenceChats(
          body.fileReferenceId
        );
        res.json({ chats });
      }
    );

    router.post(
      "/create-chat",
      async (req: express.Request, res: express.Response) => {
        const body = ZCreateChatRequest.parse(req.body);

        const value = await (async () => {
          switch (body.location) {
            case "project":
              return {
                projectId: body.id,
              };
            case "file": {
              const file = await this.fileReferenceStore.get(body.id);
              return {
                projectId: file.projectId,
                fileReferenceId: file.id,
              };
            }
            default:
              assertNever(body.location);
          }
        })();

        const chat = await this.chatStore.insertChat({
          ...value,
          organizationId: req.user.organizationId,
          creatorId: req.user.id,
          name: body.name,
        });

        res.json({ chat });
      }
    );

    router.post(
      "/generate-title",
      async (req: express.Request, res: express.Response) => {
        const body = ZGenerateTitleRequest.parse(req.body);
        const { question, answer } = await this.chatStore.getChatEntry(
          body.chatEntryId
        );

        res.set("Content-Type", "text/event-stream");
        res.set("Cache-Control", "no-cache");
        res.set("Connection", "keep-alive");

        const buffer: string[] = [];
        await this.mlClient.generateTitleStreaming({
          question,
          answer: answer ?? "",
          onData: (resp) => {
            const encoded = encoder.encode(resp);
            res.write(encoded);
            buffer.push(resp);
          },
          onEnd: async () => {
            res.end();
            const title = buffer.join("");
            await this.chatStore.updateChat({
              chatId: body.chatId,
              name: title,
            });
          },
        });
      }
    );

    router.delete(
      "/delete-chat/:chatId",
      async (req: express.Request, res: express.Response) => {
        const body = ZDeleteChatRequest.parse(req.params);
        await this.chatStore.deleteChat(body.chatId);
        res.json({ status: "ok" });
      }
    );

    router.get(
      "/chat-entry/:chatId",
      async (req: express.Request, res: express.Response) => {
        const body = ZGetChatEntryRequest.parse(req.params);

        const chatEntries = await this.chatStore.listChatEntries(body.chatId);

        res.json({ chatEntries });
      }
    );

    router.put("/chat", async (req: express.Request, res: express.Response) => {
      const args = ZEditChatRequest.parse(req.body);
      const chat = await this.chatStore.updateChat({
        chatId: args.id,
        name: args.name,
      });
      res.json({ chat });
    });

    router.post(
      "/chat",
      async (req: express.Request, res: express.Response) => {
        const args = ZChatArguments.parse(req.body);

        const chat = await this.chatStore.getChat(args.chatId);
        const vector = await this.mlClient.getEmbedding(args.question);

        const metadata = chat.fileReferenceId
          ? // note foot gun re fileId
            { fileId: chat.fileReferenceId }
          : { projectId: args.projectId };

        const similarDocuments = await (async () => {
          const docs = await this.mlClient.getKSimilar({
            vector,
            metadata,
          });

          const uniqDocs = uniqBy(docs, (doc) => doc.id);
          return uniqDocs.map(({ id, score, metadata }) => ({
            id,
            score,
            metadata: ZVectorMetadata.parse(metadata),
          }));
        })();

        const [chunks, history, files] = await Promise.all([
          this.textChunkStore.getTextChunks(
            similarDocuments.map((doc) => doc.id)
          ),
          this.chatStore.listChatHistory(args.chatId),
          this.fileReferenceStore.getMany(
            similarDocuments.map((doc) => doc.metadata.fileId)
          ),
        ]);

        const byId = keyBy(chunks, (chunk) => chunk.id);
        const filesById = keyBy(files, (file) => file.id);

        const missingIds = similarDocuments
          .map((doc) => doc.id)
          .filter((id) => !byId[id]);
        if (missingIds.length) {
          LOGGER.warn({ missingIds }, "No document found for id");
        }

        const justText = chunks.map((chunk) => chunk.chunkText);

        res.set("Content-Type", "text/event-stream");
        res.set("Cache-Control", "no-cache");
        res.set("Connection", "keep-alive");

        const buffer: string[] = [];

        await this.mlClient.askQuestionStreaming({
          context: justText.join("\n"),
          history,
          question: args.question,
          onData: (resp) => {
            const encoded = encoder.encode(resp);
            res.write(encoded);
            buffer.push(resp);
          },
          onEnd: async () => {
            res.end();
            await this.chatStore.insertChatEntry({
              organizationId: req.user.organizationId,
              projectId: args.projectId,
              creatorId: req.user.id,
              chatId: args.chatId,
              question: args.question,
              answer: buffer.join(""),
              context: similarDocuments.map((doc) => ({
                fileId: doc.metadata.fileId,
                filename: filesById[doc.metadata.fileId]?.fileName ?? "",
                score: doc.score,
                text: byId[doc.id]?.chunkText ?? "",
              })),
            });
          },
        });
      }
    );

    router.get(
      "/context/:chatEntryId",
      async (req: express.Request, res: express.Response) => {
        const args = ZContextRequest.parse(req.params);
        const context = await this.chatStore.getContext(args.chatEntryId);
        res.json({ context });
      }
    );

    return router;
  }
}

const ZVectorMetadata = z.object({
  fileId: z.string(),
});

const ZEditChatRequest = z.object({
  id: z.string(),
  name: z.string(),
});

const ZChatArguments = z.object({
  projectId: z.string(),
  question: z.string(),
  chatId: z.string(),
});

const ZListProjectChatRequest = z.object({ projectId: z.string() });
const ZListFileChatRequest = z.object({ fileReferenceId: z.string() });

const ZGetChatEntryRequest = z.object({ chatId: z.string() });

const ZChatLocation = z.enum(["project", "file"]);

const ZGenerateTitleRequest = z.object({
  chatId: z.string(),
  chatEntryId: z.string(),
});

const ZCreateChatRequest = z.object({
  id: z.string(),
  location: ZChatLocation,
  name: z.string().optional(),
});

const ZDeleteChatRequest = z.object({
  chatId: z.string(),
});

const ZContextRequest = z.object({
  chatEntryId: z.string(),
});
