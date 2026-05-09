import { Client, Databases, Query } from 'node-appwrite';
import { parserEnv } from '../config/env';

const PAGE_LIMIT = 100;

async function clearTendersCollection(): Promise<void> {
  const client = new Client()
    .setEndpoint(parserEnv.APPWRITE_ENDPOINT)
    .setProject(parserEnv.APPWRITE_PROJECT_ID)
    .setKey(parserEnv.PARSER_APPWRITE_API_KEY);

  const databases = new Databases(client);
  const databaseId = parserEnv.APPWRITE_DATABASE_ID;
  const collectionId = parserEnv.APPWRITE_TENDERS_COLLECTION_ID;

  let deleted = 0;

  // Always read the first page while deleting, until collection is empty.
  while (true) {
    const page = await databases.listDocuments(databaseId, collectionId, [
      Query.limit(PAGE_LIMIT),
      Query.orderAsc('$id'),
    ]);

    if (page.documents.length === 0) {
      break;
    }

    for (const doc of page.documents) {
      await databases.deleteDocument(databaseId, collectionId, doc.$id);
      deleted += 1;

      if (deleted % 10 === 0) {
        console.log(`[clear-db] Удалено ${deleted}...`);
      }
    }
  }

  console.log(`[clear-db] База успешно очищена. Удалено ${deleted} тендеров.`);
}

clearTendersCollection().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[clear-db] Ошибка очистки базы: ${message}`);
  process.exitCode = 1;
});
