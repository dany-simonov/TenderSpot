import { Models, Query } from 'appwrite';
import { appEnv, assertAppwriteEnv } from '@/config/env';
import { appwriteDatabases } from '@/lib/appwrite';
import { Tender, TenderStatus } from '@/types/tender';

function parseTenderDocument(document: Models.Document): Tender {
  return {
    documentId: document.$id,
    id: String(document.externalId || document.regNumber || document.$id),
    title: String(document.title || ''),
    customer: String(document.customer || ''),
    inn: String(document.inn || ''),
    price: Number(document.price || 0),
    published: String(document.published || '').slice(0, 10),
    deadline: String(document.deadline || '').slice(0, 10),
    source: (document.source || 'ЕИС 44-ФЗ') as Tender['source'],
    url: String(document.url || ''),
    description: String(document.description || ''),
    keywords: Array.isArray(document.keywords) ? document.keywords.map(String) : [],
    status: (document.status || 'new') as TenderStatus,
    notes: String(document.notes || ''),
  };
}

export async function fetchTenders(): Promise<Tender[]> {
  assertAppwriteEnv();

  const response = await appwriteDatabases.listDocuments(
    appEnv.databaseId!,
    appEnv.tendersCollectionId!,
    [Query.limit(500), Query.orderDesc('$updatedAt')]
  );

  return response.documents.map(parseTenderDocument);
}

export async function updateTenderStatus(params: {
  documentId: string;
  status: TenderStatus;
}): Promise<void> {
  assertAppwriteEnv();

  await appwriteDatabases.updateDocument(
    appEnv.databaseId!,
    appEnv.tendersCollectionId!,
    params.documentId,
    { status: params.status }
  );
}

export async function updateTenderNotes(params: {
  documentId: string;
  notes: string;
}): Promise<void> {
  assertAppwriteEnv();

  await appwriteDatabases.updateDocument(
    appEnv.databaseId!,
    appEnv.tendersCollectionId!,
    params.documentId,
    { notes: params.notes }
  );
}

export function getTenderRealtimeChannel(): string {
  return `databases.${appEnv.databaseId}.collections.${appEnv.tendersCollectionId}.documents`;
}
