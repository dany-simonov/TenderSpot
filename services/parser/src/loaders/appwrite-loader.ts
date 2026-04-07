import { Client, Databases, ID, Query } from 'node-appwrite';
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

  public async upsertMany(tenders: NormalizedTender[]): Promise<void> {
    for (const tender of tenders) {
      await this.upsertOne(tender);
    }
  }

  private async upsertOne(tender: NormalizedTender): Promise<void> {
    const existing = await this.databases.listDocuments(this.databaseId, this.collectionId, [
      Query.equal('externalId', tender.externalId),
      Query.limit(1),
    ]);

    const payload = {
      externalId: tender.externalId,
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
      status: tender.status,
      notes: tender.notes,
    };

    if (existing.total > 0) {
      await this.databases.updateDocument(
        this.databaseId,
        this.collectionId,
        existing.documents[0].$id,
        payload
      );
      return;
    }

    await this.databases.createDocument(this.databaseId, this.collectionId, ID.unique(), payload);
  }
}
