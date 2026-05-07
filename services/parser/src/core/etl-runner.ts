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

  for (const adapter of args.adapters) {
    const tenders = await adapter.extract(args.context);
    allTenders.push(...tenders);
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

  if (deduped.length > 0) {
    await args.loader.upsertMany(deduped);
  }

  return {
    extracted: allTenders.length,
    loaded: deduped.length,
  };
}
