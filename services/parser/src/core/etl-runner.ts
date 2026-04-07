import { AppwriteTenderLoader } from '../loaders/appwrite-loader';
import { ExtractContext, TenderSourceAdapter } from './source-adapter';

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

  const unique = new Map(allTenders.map((item) => [item.externalId, item]));
  const deduped = Array.from(unique.values());

  if (deduped.length > 0) {
    await args.loader.upsertMany(deduped);
  }

  return {
    extracted: allTenders.length,
    loaded: deduped.length,
  };
}
