import { extractAndFilterEis } from './eis.extract';
function mapToNormalizedTender(input) {
    return {
        externalId: input.externalId,
        title: input.title,
        customer: input.customer,
        inn: input.inn,
        price: input.price,
        published: input.published,
        deadline: input.deadline,
        source: input.source,
        sourceUrl: input.sourceUrl,
        description: input.description,
        keywords: [],
        regionCode: input.regionCode,
        status: 'new',
        notes: '',
    };
}
export class EisSourceAdapter {
    sourceName = 'EIS';
    async extract(context) {
        context.log?.('[eis.adapter] start extraction');
        const rows = await extractAndFilterEis({
            method: context.method,
            keywords: context.keywords,
            regionCodes: context.regionCodes,
            fromDate: context.fromDate,
            toDate: context.toDate,
            gosuslugiToken: context.gosuslugiToken,
            log: context.log,
            onTender: async (raw) => {
                if (!context.onTenderExtracted) {
                    return;
                }
                await context.onTenderExtracted(mapToNormalizedTender(raw));
            },
        });
        context.log?.(`[eis.adapter] extracted rows after filter: ${rows.length}`);
        return rows.map(mapToNormalizedTender);
    }
}
