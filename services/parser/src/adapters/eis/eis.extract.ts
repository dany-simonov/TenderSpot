import { XMLParser } from 'fast-xml-parser';

interface EisRawTender {
  externalId: string;
  title: string;
  description: string;
  regionCode: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
});

function containsTargetKeyword(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function matchesRegion(regionCode: string, regionCodes: string[]): boolean {
  return regionCodes.includes(regionCode);
}

function filterByBusinessRules(rows: EisRawTender[], keywords: string[], regionCodes: string[]) {
  return rows.filter((row) => {
    const searchable = `${row.title} ${row.description}`;
    return containsTargetKeyword(searchable, keywords) && matchesRegion(row.regionCode, regionCodes);
  });
}

export async function fetchEisFromFtpDelta(_args: {
  keywords: string[];
  regionCodes: string[];
  fromDate?: string;
  toDate?: string;
}): Promise<EisRawTender[]> {
  // IMPORTANT: HTML scraping is prohibited for EIS. Only FTP XML delta is allowed.
  // TODO: Implement downloading XML delta archives from ftp.zakupki.gov.ru.
  // TODO: Parse XML records with fast-xml-parser (parser variable above).
  // parser.parse(xmlString);
  return [];
}

export async function fetchEisFromMachineReadableApi(_args: {
  keywords: string[];
  regionCodes: string[];
  fromDate?: string;
  toDate?: string;
  gosuslugiToken: string;
}): Promise<EisRawTender[]> {
  // IMPORTANT: HTML scraping is prohibited for EIS. Use official machine-readable API only.
  // TODO: Call API with Gosuslugi bearer token and map response to EisRawTender[].
  return [];
}

export async function extractAndFilterEis(args: {
  method: 'ftp' | 'api';
  keywords: string[];
  regionCodes: string[];
  fromDate?: string;
  toDate?: string;
  gosuslugiToken?: string;
}): Promise<EisRawTender[]> {
  const raw =
    args.method === 'ftp'
      ? await fetchEisFromFtpDelta(args)
      : await fetchEisFromMachineReadableApi({
          ...args,
          gosuslugiToken: args.gosuslugiToken || '',
        });

  return filterByBusinessRules(raw, args.keywords, args.regionCodes);
}
