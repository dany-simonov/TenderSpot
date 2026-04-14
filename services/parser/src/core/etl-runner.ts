import { AppwriteTenderLoader } from '../loaders/appwrite-loader';
import { ExtractContext, TenderSourceAdapter } from './source-adapter';

const MAX_TENDERS_TO_LOAD = 500;

function getRelevanceScore(item: unknown): number {
  if (typeof item !== 'object' || item === null) {
    return 0;
  }
  const candidate = item as { relevanceScore?: unknown };
  return typeof candidate.relevanceScore === 'number' ? candidate.relevanceScore : 0;
}

export async function runEtlPipeline(args: {
  adapters: TenderSourceAdapter[];
  context: ExtractContext;
  loader: AppwriteTenderLoader;
}): Promise<{ extracted: number; loaded: number }> {
  const allTenders = [];
  const streamedIds = new Set<string>();

  const log = (message: string) => {
    args.context.log?.(message);
  };

  const streamingContext: ExtractContext = {
    ...args.context,
    onTenderExtracted: async (tender) => {
      if (streamedIds.has(tender.externalId)) {
        return;
      }

      await args.loader.upsertOne(tender);
      streamedIds.add(tender.externalId);
      log(
        `[etl] streamed upsert ${streamedIds.size}: ${tender.externalId} | ${tender.title.slice(0, 90)}`
      );
    },
  };

  log('[etl] pipeline started');

  for (const adapter of args.adapters) {
    log(`[etl] extracting with adapter ${adapter.sourceName}`);
    const tenders = await adapter.extract(streamingContext);
    allTenders.push(...tenders);
    log(`[etl] adapter ${adapter.sourceName} extracted ${tenders.length}`);
  }

  const unique = new Map<string, (typeof allTenders)[number]>();
  for (const item of allTenders) {
    const existing = unique.get(item.externalId);
    if (!existing || getRelevanceScore(item) >= getRelevanceScore(existing)) {
      unique.set(item.externalId, item);
    }
  }

  const deduped = Array.from(unique.values())
    .sort((a, b) => getRelevanceScore(b) - getRelevanceScore(a))
    .slice(0, MAX_TENDERS_TO_LOAD);

  for (const tender of deduped) {
    if (streamedIds.has(tender.externalId)) {
      continue;
    }

    await args.loader.upsertOne(tender);
    streamedIds.add(tender.externalId);
  }

  await args.loader.cleanExpiredTenders(log);

  log(
    `[etl] pipeline finished: extracted=${allTenders.length}, deduped=${deduped.length}, loaded=${streamedIds.size}`
  );

  return {
    extracted: allTenders.length,
    loaded: streamedIds.size,
  };
}
