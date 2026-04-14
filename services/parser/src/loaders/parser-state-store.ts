import { Client, Databases, ID, Query } from 'node-appwrite';

interface ParserStateStoreConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
  databaseId: string;
  collectionId?: string;
}

const SESSION_KEY = 'eis_human_session';
const LAST_ERROR_KEY = 'eis_human_last_error';

export class ParserStateStore {
  private readonly databases: Databases;
  private readonly databaseId: string;
  private readonly collectionId?: string;

  constructor(config: ParserStateStoreConfig) {
    const client = new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId)
      .setKey(config.apiKey);

    this.databases = new Databases(client);
    this.databaseId = config.databaseId;
    this.collectionId = config.collectionId;
  }

  public async loadCookies(): Promise<string[]> {
    const payload = await this.getPayloadByKey(SESSION_KEY);
    if (!payload || !Array.isArray(payload.cookies)) {
      return [];
    }
    return payload.cookies.filter((item: unknown) => typeof item === 'string');
  }

  public async saveCookies(cookies: string[]): Promise<void> {
    await this.upsertByKey(SESSION_KEY, {
      cookies: Array.from(new Set(cookies)),
      updatedAt: new Date().toISOString(),
    });
  }

  public async reportError(message: string): Promise<void> {
    await this.upsertByKey(LAST_ERROR_KEY, {
      message,
      updatedAt: new Date().toISOString(),
    });
  }

  private async getPayloadByKey(key: string): Promise<Record<string, unknown> | null> {
    if (!this.collectionId) {
      return null;
    }

    try {
      const response = await this.databases.listDocuments(this.databaseId, this.collectionId, [
        Query.equal('key', key),
        Query.limit(1),
      ]);

      if (response.total === 0) {
        return null;
      }

      const raw = response.documents[0] as unknown as { payload?: unknown };
      if (typeof raw.payload !== 'string') {
        return null;
      }

      const parsed = JSON.parse(raw.payload) as unknown;
      if (typeof parsed !== 'object' || parsed === null) {
        return null;
      }

      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private async upsertByKey(key: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.collectionId) {
      return;
    }

    try {
      const existing = await this.databases.listDocuments(this.databaseId, this.collectionId, [
        Query.equal('key', key),
        Query.limit(1),
      ]);

      if (existing.total > 0) {
        await this.databases.updateDocument(
          this.databaseId,
          this.collectionId,
          existing.documents[0].$id,
          {
            key,
            payload: JSON.stringify(payload),
          }
        );
        return;
      }

      await this.databases.createDocument(this.databaseId, this.collectionId, ID.unique(), {
        key,
        payload: JSON.stringify(payload),
      });
    } catch {
      // Intentionally swallow to avoid breaking parsing flow when state collection is unavailable.
    }
  }
}
