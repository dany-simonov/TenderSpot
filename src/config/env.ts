const requiredEnv = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT,
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID,
  tendersCollectionId:
    import.meta.env.VITE_APPWRITE_TENDERS_COLLECTION_ID ||
    import.meta.env.VITE_APPWRITE_COLLECTION_ID,
  inviteTokensCollectionId: import.meta.env.VITE_APPWRITE_INVITE_TOKENS_COLLECTION_ID,
};

const missing = Object.entries(requiredEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  // Keep startup resilient for local development; app surfaces this in login/data layers.
  console.warn(`Missing Appwrite environment variables: ${missing.join(', ')}`);
}

export const appEnv = requiredEnv;

export function assertAppwriteEnv(): void {
  if (missing.length > 0) {
    throw new Error(
      `Не настроено окружение Appwrite. Проверьте .env (отсутствует: ${missing.join(', ')}).`
    );
  }
}
