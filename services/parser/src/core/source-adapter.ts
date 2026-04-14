export type ExtractMethod = 'ftp' | 'api' | 'human';

export interface ExtractContext {
  keywords: string[];
  regionCodes: string[];
  fromDate?: string;
  toDate?: string;
  method: ExtractMethod;
  gosuslugiToken?: string;
  onTenderExtracted?: (tender: NormalizedTender) => Promise<void>;
  log?: (message: string) => void;
}

export interface NormalizedTender {
  externalId: string;
  title: string;
  customer: string;
  inn: string;
  price: number;
  published: string;
  deadline: string;
  source: 'ЕИС 44-ФЗ' | 'ЕИС 223-ФЗ';
  sourceUrl: string;
  description: string;
  keywords: string[];
  regionCode: string;
  status: 'new' | 'wip' | 'submitted' | 'rejected';
  notes: string;
}

export interface TenderSourceAdapter {
  sourceName: string;
  extract(context: ExtractContext): Promise<NormalizedTender[]>;
}
