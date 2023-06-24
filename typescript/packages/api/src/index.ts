import * as dotenv from "dotenv";

dotenv.config();
import "express-async-errors"; // eslint-disable-line

import cors from "cors";
import express from "express";
import { expressjwt } from "express-jwt";

import { expressJwtSecret } from "jwks-rsa";

import { LOGGER } from "./logger";
import { errorLogger } from "./middleware/error-logger";
import { errorResponder } from "./middleware/error-responder";
import { invalidPathHandler } from "./middleware/invalid-path-handler";
import { SETTINGS } from "./settings";
import { dataBasePool } from "./sql";

import {
  GoogleCloudStorageService,
  MLServiceClientImpl,
  PsqlFileReferenceStore,
  PSqlProjectStore,
  PSqlTaskStore,
  PsqlTextChunkStore,
  PsqlUserOrgService,
  PsqlLoadedFileStore,
  PsqlChatStore,
  PsqlQuestionStore,
  ReportServiceImpl,
  PsqlMiscOutputStore,
  PubsubMessageBusService,
  PsqlExcelAssetStore,
} from "@fgpt/precedent-node";
import { UserInformationMiddleware } from "./middleware/user-information-middleware";
import { UserOrgRouter } from "./routers/user-org-router";
import { ProjectRouter } from "./routers/project-router";
import { FileRouter } from "./routers/file-router";
import { ChatRouter } from "./routers/chat-router";
import { TextGroupRouter } from "./routers/text-group-router";
import { LLMOutputRouter } from "./routers/llm-output.router";
import { DebugRouter } from "./routers/debug-router";

LOGGER.info("Server starting ...");

const jwtCheck = expressjwt({
  secret: expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: SETTINGS.auth.jwksUri,
  }) as any,

  issuer: SETTINGS.auth.issuer,
  audience: SETTINGS.auth.audience,
  algorithms: ["RS256"],
});

async function start() {
  const app = express();
  app.enable("trust proxy");

  app.use(
    express.json({
      verify: function (req, _, buf) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).rawBody = buf;
      },
    })
  );

  const pool = await dataBasePool(SETTINGS.sql.uri);

  const userOrgService = new PsqlUserOrgService(pool);

  const userMiddleware = new UserInformationMiddleware(userOrgService);

  const addUser = userMiddleware.addUser();
  const projectStore = new PSqlProjectStore(pool);

  const fileReferenceStore = new PsqlFileReferenceStore(pool);
  const loadedFileStore = new PsqlLoadedFileStore(pool);
  const objectStoreService = new GoogleCloudStorageService(
    SETTINGS.urlSigningServiceAccountPath
  );
  const excelAssetStore = new PsqlExcelAssetStore(pool);

  const messageBusService = new PubsubMessageBusService(
    SETTINGS.pubsub.projectId,
    SETTINGS.pubsub.topic,
    SETTINGS.pubsub.emulatorHost
  );

  const taskStore = new PSqlTaskStore(pool, messageBusService);

  const textChunkStore = new PsqlTextChunkStore(pool);

  const mlService = new MLServiceClientImpl(SETTINGS.mlServiceUri);

  const chatStore = new PsqlChatStore(pool);

  const questionStore = new PsqlQuestionStore(pool);
  const metricsStore = new PsqlMiscOutputStore(pool);
  const reportService = new ReportServiceImpl(questionStore, metricsStore);

  app.use(cors({ origin: "*" }));

  app.use("/api/v1/user-org", jwtCheck, addUser, new UserOrgRouter().init());

  app.use(
    "/api/v1/projects",
    jwtCheck,
    addUser,
    new ProjectRouter(projectStore, taskStore).init()
  );

  app.use(
    "/api/v1/files",
    jwtCheck,
    addUser,
    new FileRouter(
      fileReferenceStore,
      objectStoreService,
      SETTINGS.assetBucket,
      taskStore,
      loadedFileStore
    ).init()
  );

  app.use(
    "/api/v1/chat",
    jwtCheck,
    addUser,
    new ChatRouter(
      mlService,
      textChunkStore,
      chatStore,
      fileReferenceStore
    ).init()
  );

  app.use(
    "/api/v1/text",
    jwtCheck,
    addUser,
    new TextGroupRouter(textChunkStore).init()
  );

  app.use(
    "/api/v1/output",
    jwtCheck,
    addUser,
    new LLMOutputRouter(
      questionStore,
      mlService,
      textChunkStore,
      reportService,
      excelAssetStore,
      objectStoreService
    ).init()
  );

  if (SETTINGS.debug.includeRouter) {
    app.use(
      "/api/v1/debug",
      new DebugRouter(taskStore, fileReferenceStore).init()
    );
  }

  app.use("/ping", (_, res) => {
    res.json({ ping: "pong" });
  });

  app.use(errorLogger);
  app.use(errorResponder);
  app.use(invalidPathHandler);

  app.listen(SETTINGS.port, SETTINGS.host);
}

start();
