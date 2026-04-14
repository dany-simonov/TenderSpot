import 'dotenv/config';
import { Client, Databases, Query } from 'node-appwrite';
import { parserEnv } from '../config/env';

const PAGE_LIMIT = 100;

async function deleteExpiredTenders(): Promise<void> {
  const client = new Client()
    .setEndpoint(parserEnv.APPWRITE_ENDPOINT)
    .setProject(parserEnv.APPWRITE_PROJECT_ID)
    .setKey(parserEnv.PARSER_APPWRITE_API_KEY);

  const databases = new Databases(client);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoffIso = today.toISOString();

  let deleted = 0;

  while (true) {
    const page = await databases.listDocuments(
      parserEnv.APPWRITE_DATABASE_ID,
      parserEnv.APPWRITE_TENDERS_COLLECTION_ID,
      [Query.lessThan('deadline', cutoffIso), Query.limit(PAGE_LIMIT), Query.orderAsc('$id')]
    );

    if (page.documents.length === 0) {
      break;
    }

    for (const doc of page.documents) {
      await databases.deleteDocument(
        parserEnv.APPWRITE_DATABASE_ID,
        parserEnv.APPWRITE_TENDERS_COLLECTION_ID,
        doc.$id
      );
      deleted += 1;

      if (deleted % 20 === 0) {
        console.log(`[delete-expired] deleted ${deleted}`);
      }
    }
  }

  console.log(`[delete-expired] done, deleted ${deleted}, cutoff=${cutoffIso}`);
}

deleteExpiredTenders().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[delete-expired] failed: ${message}`);
  process.exitCode = 1;
});
