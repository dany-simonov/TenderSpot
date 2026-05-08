const MAX_TENDERS_TO_LOAD = 500;
function getRelevanceScore(item) {
    if (typeof item !== 'object' || item === null) {
        return 0;
    }
    const candidate = item;
    return typeof candidate.relevanceScore === 'number' ? candidate.relevanceScore : 0;
}
export async function runEtlPipeline(args) {
    const allTenders = [];
    const streamedIds = new Set();
    const log = (message) => {
        args.context.log?.(message);
    };
    const streamingContext = {
        ...args.context,
        onTenderExtracted: async (tender) => {
            if (streamedIds.has(tender.externalId)) {
                return;
            }
            await args.loader.upsertOne(tender);
            streamedIds.add(tender.externalId);
            log(`[etl] streamed upsert ${streamedIds.size}: ${tender.externalId} | ${tender.title.slice(0, 90)}`);
        },
    };
    log('[etl] pipeline started');
    for (const adapter of args.adapters) {
        log(`[etl] extracting with adapter ${adapter.sourceName}`);
        const tenders = await adapter.extract(streamingContext);
        allTenders.push(...tenders);
        log(`[etl] adapter ${adapter.sourceName} extracted ${tenders.length}`);
    }
    const unique = new Map();
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
    log(`[etl] pipeline finished: extracted=${allTenders.length}, deduped=${deduped.length}, loaded=${streamedIds.size}`);
    return {
        extracted: allTenders.length,
        loaded: streamedIds.size,
    };
}
