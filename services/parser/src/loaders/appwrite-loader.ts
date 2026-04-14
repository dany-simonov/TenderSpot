import { AppwriteException, Client, Databases, ID, Query } from 'node-appwrite';
import { NormalizedTender } from '../core/source-adapter';

interface AppwriteLoaderConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
  databaseId: string;
  collectionId: string;
}

export class AppwriteTenderLoader {
  private readonly databases: Databases;
  private readonly databaseId: string;
  private readonly collectionId: string;

  constructor(config: AppwriteLoaderConfig) {
    const client = new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId)
      .setKey(config.apiKey);

    this.databases = new Databases(client);
    this.databaseId = config.databaseId;
    this.collectionId = config.collectionId;
  }

  public async cleanExpiredTenders(log?: (message: string) => void): Promise<number> {
    const PAGE_LIMIT = 100;
    let deleted = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoffIso = today.toISOString();

    while (true) {
      const page = await this.databases.listDocuments(this.databaseId, this.collectionId, [
        Query.lessThan('deadline', cutoffIso),
        Query.limit(PAGE_LIMIT),
        Query.orderAsc('$id'),
      ]);

      if (page.documents.length === 0) {
        break;
      }

      for (const doc of page.documents) {
        await this.databases.deleteDocument(this.databaseId, this.collectionId, doc.$id);
        deleted += 1;
      }
    }

    log?.(`[auto-clean] Удалено ${deleted} просроченных тендеров из БД.`);
    return deleted;
  }

  public async upsertMany(tenders: NormalizedTender[]): Promise<void> {
    for (const tender of tenders) {
      await this.upsertOne(tender);
    }
  }

  public async upsertOne(tender: NormalizedTender): Promise<void> {
    const documentId = String(tender.externalId).trim();
    if (!documentId) {
      throw new Error('Cannot upsert tender without externalId');
    }

    const payload = {
      id: tender.externalId,
      title: tender.title,
      customer: tender.customer,
      inn: tender.inn,
      price: tender.price,
      published: tender.published,
      deadline: tender.deadline,
      source: tender.source,
      url: tender.sourceUrl,
      description: tender.description,
      keywords: tender.keywords,
      regionCode: tender.regionCode,
    };

    const createPayload = {
      ...payload,
      status: tender.status,
      notes: tender.notes,
    };

    try {
      await this.databases.createDocument(
        this.databaseId,
        this.collectionId,
        ID.custom(documentId),
        createPayload
      );
    } catch (error) {
      const code =
        error instanceof AppwriteException
          ? error.code
          : typeof (error as { code?: unknown })?.code === 'number'
            ? ((error as { code: number }).code as number)
            : undefined;

      if (code !== 409) {
        throw error;
      }

      await this.databases.updateDocument(
        this.databaseId,
        this.collectionId,
        documentId,
        createPayload
      );
    }
  }
}
