import { extractAndFilterEis } from './eis.extract';
import {
  ExtractContext,
  NormalizedTender,
  TenderSourceAdapter,
} from '../../core/source-adapter';

function mapToNormalizedTender(input: {
  externalId: string;
  title: string;
  description: string;
  regionCode: string;
  customer: string;
  inn: string;
  price: number;
  published: string;
  deadline: string;
  source: 'ЕИС 223-ФЗ';
  sourceUrl: string;
  relevanceScore: number;
}): NormalizedTender {
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

export class EisSourceAdapter implements TenderSourceAdapter {
  public readonly sourceName = 'EIS';

  public async extract(context: ExtractContext): Promise<NormalizedTender[]> {
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
