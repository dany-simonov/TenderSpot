import { Client, Databases } from 'node-appwrite';
import { parserEnv } from '../config/env';

async function ensureIsViewedAttribute(): Promise<void> {
  const client = new Client()
    .setEndpoint(parserEnv.APPWRITE_ENDPOINT)
    .setProject(parserEnv.APPWRITE_PROJECT_ID)
    .setKey(parserEnv.PARSER_APPWRITE_API_KEY);

  const databases = new Databases(client);

  try {
    await databases.createBooleanAttribute(
      parserEnv.APPWRITE_DATABASE_ID,
      parserEnv.APPWRITE_TENDERS_COLLECTION_ID,
      'isViewed',
      false,
      false
    );

    console.log('[ensure-isViewed] Атрибут isViewed успешно создан.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (/already exists|attribute.*exists|409/i.test(message)) {
      console.log('[ensure-isViewed] Атрибут isViewed уже существует.');
      return;
    }

    throw error;
  }
}

ensureIsViewedAttribute().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ensure-isViewed] Ошибка: ${message}`);
  process.exitCode = 1;
});
