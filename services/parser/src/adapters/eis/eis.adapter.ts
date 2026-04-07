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
}): NormalizedTender {
  return {
    externalId: input.externalId,
    title: input.title,
    customer: '',
    inn: '',
    price: 0,
    published: new Date().toISOString(),
    deadline: new Date().toISOString(),
    source: 'ЕИС 44-ФЗ',
    sourceUrl: `https://zakupki.gov.ru/epz/order/notice/ea20/view/common-info.html?regNumber=${input.externalId}`,
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
    const rows = await extractAndFilterEis({
      method: context.method,
      keywords: context.keywords,
      regionCodes: context.regionCodes,
      fromDate: context.fromDate,
      toDate: context.toDate,
      gosuslugiToken: context.gosuslugiToken,
    });

    return rows.map(mapToNormalizedTender);
  }
}
