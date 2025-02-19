import { sql } from "slonik";
import { afterEach, beforeEach, expect, test } from "vitest";

import { dataBasePool } from "../data-base-pool";
import { PsqlFileReferenceStore } from "../file-reference-store";
import { PsqlProcessedFileStore } from "../processed-file-store";
import { PSqlProjectStore } from "../project-store";
import { ShaHash } from "../sha-hash";
import { PsqlUserOrgService } from "../user-org/user-org-service";
import { TEST_SETTINGS } from "./test-settings";

async function setup() {
  const pool = await dataBasePool(TEST_SETTINGS.sqlUri);

  const userOrgService = new PsqlUserOrgService(pool);
  const projectService = new PSqlProjectStore(pool);
  const fileReferenceStore = new PsqlFileReferenceStore(pool);

  const processedFileStore = new PsqlProcessedFileStore(pool);

  const user = await userOrgService.upsert({
    sub: {
      provider: "google",
      value: "abc",
    },
    email: "nasr@test.com",
  });

  const project = await projectService.create({
    name: "test-project",
    creatorUserId: user.id,
    organizationId: user.organizationId,
  });

  const fileReference = await fileReferenceStore.insert({
    fileName: "test-file-name.pdf",
    organizationId: project.organizationId,
    projectId: project.id,
    bucketName: "test-bucket",
    contentType: "application/pdf",
    path: "my-path/foo",
    sha256: "hi",
    fileSize: 100,
  });

  return {
    pool,
    user,
    project,
    fileReference,
    fileReferenceStore,
    processedFileStore,
  };
}

beforeEach(async () => {
  const pool = await dataBasePool(TEST_SETTINGS.sqlUri);

  await pool.query(
    sql.unsafe`TRUNCATE TABLE app_user, organization, project, file_reference, processed_file CASCADE`,
  );
});

afterEach(async () => {
  const pool = await dataBasePool(TEST_SETTINGS.sqlUri);

  await pool.query(
    sql.unsafe`TRUNCATE TABLE app_user, organization, project, file_reference CASCADE`,
  );
});

test("upsert", async () => {
  const { fileReference, processedFileStore } = await setup();

  const res = await processedFileStore.upsert({
    organizationId: fileReference.organizationId,
    projectId: fileReference.projectId,
    fileReferenceId: fileReference.id,
    text: "hi",
    hash: ShaHash.forData("hi"),
    gpt4TokenLength: 1000,
    claude100kLength: 1000,
    textWithPages: [
      {
        page: 0,
        text: "hi",
      },
    ],
    numPages: 1,
  });

  expect(res.id).toBeDefined();
});

test("getText", async () => {
  const { fileReference, processedFileStore } = await setup();

  const res = await processedFileStore.upsert({
    organizationId: fileReference.organizationId,
    projectId: fileReference.projectId,
    fileReferenceId: fileReference.id,
    text: "hi",
    hash: ShaHash.forData("hi"),
    gpt4TokenLength: 1000,
    claude100kLength: 1000,
    textWithPages: [
      {
        page: 0,
        text: "hi",
      },
    ],
    numPages: 1,
  });

  expect(res.id).toBeDefined();

  expect(await processedFileStore.getSourceText(res.id)).toEqual({
    pages: [
      {
        page: 0,
        text: "hi",
      },
    ],
    type: "has_pages",
  });

  expect(await processedFileStore.getText(res.id)).toEqual("hi");
});

test("getByFileReferenceId", async () => {
  const { fileReference, processedFileStore } = await setup();

  const res = await processedFileStore.upsert({
    organizationId: fileReference.organizationId,
    projectId: fileReference.projectId,
    fileReferenceId: fileReference.id,
    text: "hi",
    hash: ShaHash.forData("hi"),
    gpt4TokenLength: 1000,
    claude100kLength: 1000,
    textWithPages: [
      {
        page: 0,
        text: "hi",
      },
    ],
    numPages: 1,
  });

  const same = await processedFileStore.getByFileReferenceId(fileReference.id);

  expect(res).toEqual(same);
});
