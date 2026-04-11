import { Client, FileInfo } from 'basic-ftp';
import sax from 'sax';

interface EisRawTender {
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
}

type Direction = 'north' | 'north-east' | 'north-west' | 'west' | 'east';

const FTP_HOST = 'ftp.zakupki.gov.ru';
const FTP_ROOTS = ['/fcs_regions', '/out/published'];
const TARGET_REGION_FOLDERS = ['Moskva', 'Moskovskaja_obl'];
const DAYS_BACK = 3;
const MIN_PRICE = 200_000;
const MAX_TENDERS = 500;
const MAX_REMOTE_FILES = 350;

const TARGET_DIRECTIONS: Direction[] = ['north', 'north-east', 'north-west', 'west', 'east'];

const DIRECTION_HINTS: Record<Direction, string[]> = {
  north: ['сао', 'северный административный округ', 'север', 'химки', 'долгопрудный'],
  'north-east': [
    'свао',
    'северо-восточный административный округ',
    'северо-восток',
    'мытищи',
    'королев',
    'пушкино',
    'ивантеевка',
  ],
  'north-west': [
    'сзао',
    'северо-западный административный округ',
    'северо-запад',
    'красногорск',
    'истра',
    'нахабино',
  ],
  west: [
    'зао',
    'западный административный округ',
    'запад',
    'одинцово',
    'можайск',
    'голицыно',
    'звенигород',
  ],
  east: [
    'вао',
    'восточный административный округ',
    'восток',
    'балашиха',
    'реутов',
    'люберцы',
    'железнодорожный',
    'ногинск',
    'электросталь',
  ],
};

const SOFT_ROOF_INCLUDE = [
  'мягкая кровля',
  'битумная черепица',
  'гибкая черепица',
  'рубероид',
  'стеклоизол',
  'бикрост',
  'мембранная кровля',
  'пвх мембрана',
  'полимерная мембрана',
  'ондулин',
  'еврошифер',
  'мастичная кровля',
  'рулонная кровля',
];

const HARD_ROOF_EXCLUDE = [
  'металлочерепица',
  'профнастил',
  'профлист',
  'фальцевая кровля',
  'натуральная черепица',
  'керамическая черепица',
  'цементно-песчаная черепица',
  'классический шифер',
  'асбестоцементный шифер',
  'листовая кровля',
];

const NON_B2B_CUSTOMERS = [
  'гбу',
  'гбоу',
  'мку',
  'департамент',
  'министерство',
  'комитет',
  'школ',
  'больниц',
  'поликлиник',
  'администрация',
  'муниципальное бюджетное учреждение',
  'государственное бюджетное учреждение',
];

const LAW_223_HINTS = ['223-фз', '223 фз', '223fz', 'закупка отдельными видами юридических лиц'];
const LAW_44_HINTS = ['44-фз', '44 фз', 'контрактная система'];

const AREA_REGEX = /(\d{1,6}(?:[\s.,]\d{1,2})?)\s*(?:м2|м²|кв\.?\s*м|м\.?\s*кв\.?)/i;

interface TenderAccumulator {
  externalId: string;
  title: string;
  description: string;
  regionCode: string;
  customer: string;
  inn: string;
  priceRaw: string;
  publishedRaw: string;
  deadlineRaw: string;
  lawRaw: string;
  regionText: string;
}

function emptyAccumulator(): TenderAccumulator {
  return {
    externalId: '',
    title: '',
    description: '',
    regionCode: '',
    customer: '',
    inn: '',
    priceRaw: '',
    publishedRaw: '',
    deadlineRaw: '',
    lawRaw: '',
    regionText: '',
  };
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function containsAny(text: string, keywords: string[]): boolean {
  const value = normalize(text);
  return keywords.some((keyword) => value.includes(normalize(keyword)));
}

function parseMoney(raw: string): number {
  if (!raw) {
    return 0;
  }
  const compact = raw.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(compact);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(raw: string, fallback?: Date): string {
  const text = raw?.trim();
  if (!text) {
    return fallback ? fallback.toISOString() : new Date().toISOString();
  }

  const iso = new Date(text);
  if (!Number.isNaN(iso.getTime())) {
    return iso.toISOString();
  }

  const dmY = text.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (dmY) {
    const candidate = new Date(`${dmY[3]}-${dmY[2]}-${dmY[1]}T00:00:00.000Z`);
    if (!Number.isNaN(candidate.getTime())) {
      return candidate.toISOString();
    }
  }

  return fallback ? fallback.toISOString() : new Date().toISOString();
}

function extractAreaTag(text: string): string {
  const match = text.match(AREA_REGEX);
  if (!match) {
    return '';
  }
  const area = match[1].replace(',', '.').replace(/\s/g, '');
  return ` Вытянуто алгоритмами из данных: ${area} м²`;
}

function isRecentDate(isoDate: string, fromDate?: string, toDate?: string): boolean {
  const value = new Date(isoDate).getTime();
  if (Number.isNaN(value)) {
    return false;
  }

  const since = fromDate
    ? new Date(fromDate).getTime()
    : Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000;
  const until = toDate ? new Date(toDate).getTime() : Date.now();
  return value >= since && value <= until;
}

function matchesDirection(regionText: string): boolean {
  const value = normalize(regionText);
  return TARGET_DIRECTIONS.some((direction) =>
    DIRECTION_HINTS[direction].some((hint) => value.includes(normalize(hint)))
  );
}

function hasAllowedGeography(entry: TenderAccumulator): boolean {
  const geography = `${entry.regionCode} ${entry.regionText} ${entry.title} ${entry.description}`;
  return matchesDirection(geography);
}

function isTargetCustomer(entry: TenderAccumulator): boolean {
  const scope = `${entry.customer} ${entry.description} ${entry.title} ${entry.lawRaw}`;
  return !containsAny(scope, NON_B2B_CUSTOMERS);
}

function isLaw223(entry: TenderAccumulator): boolean {
  const scope = `${entry.lawRaw} ${entry.title} ${entry.description}`;
  return containsAny(scope, LAW_223_HINTS) && !containsAny(scope, LAW_44_HINTS);
}

function hasSoftRoofScope(entry: TenderAccumulator): boolean {
  const text = `${entry.title} ${entry.description}`;
  return containsAny(text, SOFT_ROOF_INCLUDE) && !containsAny(text, HARD_ROOF_EXCLUDE);
}

function calculateRelevance(entry: TenderAccumulator, price: number, areaTag: string): number {
  const text = `${entry.title} ${entry.description}`;
  const includeHits = SOFT_ROOF_INCLUDE.filter((k) => containsAny(text, [k])).length;
  const directionBonus = hasAllowedGeography(entry) ? 10 : 0;
  const areaBonus = areaTag ? 6 : 0;
  const priceBonus = Math.min(12, Math.floor(price / 500_000));
  return includeHits * 8 + directionBonus + areaBonus + priceBonus;
}

function finalizeTender(entry: TenderAccumulator, fileDate?: Date): EisRawTender | null {
  if (!entry.externalId || !entry.title) {
    return null;
  }
  if (!isLaw223(entry) || !isTargetCustomer(entry) || !hasSoftRoofScope(entry)) {
    return null;
  }
  if (!hasAllowedGeography(entry)) {
    return null;
  }

  const price = parseMoney(entry.priceRaw);
  if (price < MIN_PRICE) {
    return null;
  }

  const published = parseDate(entry.publishedRaw, fileDate);
  if (!isRecentDate(published)) {
    return null;
  }

  const deadline = parseDate(entry.deadlineRaw, fileDate);
  const areaTag = extractAreaTag(`${entry.title} ${entry.description}`);
  const normalizedDescription = `${entry.description.trim()}${areaTag}`.trim();

  return {
    externalId: entry.externalId.trim(),
    title: entry.title.trim(),
    description: normalizedDescription,
    regionCode: entry.regionCode.trim() || '77',
    customer: entry.customer.trim(),
    inn: entry.inn.trim(),
    price,
    published,
    deadline,
    source: 'ЕИС 223-ФЗ',
    sourceUrl: `https://zakupki.gov.ru/epz/order/notice/ea20/view/common-info.html?regNumber=${entry.externalId.trim()}`,
    relevanceScore: calculateRelevance(entry, price, areaTag),
  };
}

function isDirectory(item: FileInfo): boolean {
  return item.isDirectory === true;
}

function isXmlFile(item: FileInfo): boolean {
  return item.isFile === true && item.name.toLowerCase().endsWith('.xml');
}

async function listRecentXmlFiles(client: Client, rootDir: string, since: Date): Promise<string[]> {
  const queue = [rootDir];
  const result: string[] = [];

  while (queue.length > 0 && result.length < MAX_REMOTE_FILES) {
    const current = queue.shift() as string;
    let items: FileInfo[] = [];

    try {
      items = await client.list(current);
    } catch {
      continue;
    }

    for (const item of items) {
      const fullPath = `${current}/${item.name}`;
      if (isDirectory(item)) {
        queue.push(fullPath);
        continue;
      }

      if (!isXmlFile(item)) {
        continue;
      }

      const modifiedAt = item.modifiedAt ?? since;
      if (modifiedAt.getTime() >= since.getTime()) {
        result.push(fullPath);
      }

      if (result.length >= MAX_REMOTE_FILES) {
        break;
      }
    }
  }

  return result;
}

function assignField(acc: TenderAccumulator, path: string, value: string): void {
  const p = normalize(path);

  if (!acc.externalId && /(regnumber|purchasenumber|notificationnumber|externalid|id)$/.test(p)) {
    acc.externalId = value;
  }
  if (!acc.title && /(purchaseobjectinfo|name|subject|title)$/.test(p)) {
    acc.title = value;
  }
  if (!acc.description && /(description|lotname|purchaseobject)$/.test(p)) {
    acc.description = value;
  }
  if (!acc.customer && /(customername|customerfullname|orgname|fullName)$/.test(p)) {
    acc.customer = value;
  }
  if (!acc.inn && /(^|\.)inn$/.test(p)) {
    acc.inn = value;
  }
  if (!acc.priceRaw && /(maxprice|nmck|price|sum)$/.test(p)) {
    acc.priceRaw = value;
  }
  if (!acc.publishedRaw && /(publishdate|docpublishdate|publicationdate|createdate)$/.test(p)) {
    acc.publishedRaw = value;
  }
  if (!acc.deadlineRaw && /(applicationdeadline|collectingenddate|enddate|closedate)$/.test(p)) {
    acc.deadlineRaw = value;
  }
  if (!acc.lawRaw && /(law|fz|purchasecode|regulation)$/.test(p)) {
    acc.lawRaw = value;
  }
  if (!acc.regionCode && /(regioncode|region|okato|subjectcode)$/.test(p)) {
    acc.regionCode = value;
  }
  if (/(region|city|district|address)$/.test(p)) {
    acc.regionText = `${acc.regionText} ${value}`.trim();
  }
}

async function streamParseXmlFile(client: Client, remotePath: string, cutoff: Date): Promise<EisRawTender[]> {
  const rows: EisRawTender[] = [];
  const tagStack: string[] = [];
  let current = emptyAccumulator();
  let textBuffer = '';

  const parser = sax.createStream(true, {
    lowercase: true,
    trim: true,
  });

  parser.on('opentag', (node: { name: string }) => {
    tagStack.push(node.name.toLowerCase());
    textBuffer = '';
  });

  parser.on('text', (chunk: string) => {
    textBuffer += chunk;
  });

  parser.on('cdata', (chunk: string) => {
    textBuffer += chunk;
  });

  parser.on('closetag', (tagName: string) => {
    const value = textBuffer.trim();
    if (value) {
      assignField(current, `${tagStack.join('.')}.${tagName}`, value);
    }

    const normalizedTag = tagName.toLowerCase();
    if (
      normalizedTag === 'purchasenotice' ||
      normalizedTag === 'notification' ||
      normalizedTag === 'purchase'
    ) {
      const finalized = finalizeTender(current, cutoff);
      if (finalized) {
        rows.push(finalized);
      }
      current = emptyAccumulator();
    }

    tagStack.pop();
    textBuffer = '';
  });

  await client.downloadTo(parser, remotePath);
  return rows;
}

export async function fetchEisFromFtpDelta(args: {
  keywords: string[];
  regionCodes: string[];
  fromDate?: string;
  toDate?: string;
}): Promise<EisRawTender[]> {
  const since = args.fromDate
    ? new Date(args.fromDate)
    : new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000);

  const client = new Client(30_000);
  client.ftp.verbose = false;

  try {
    await client.access({
      host: FTP_HOST,
      secure: false,
      user: 'anonymous',
      password: 'anonymous@example.com',
    });

    const candidates: string[] = [];
    for (const root of FTP_ROOTS) {
      for (const regionFolder of TARGET_REGION_FOLDERS) {
        const folder = `${root}/${regionFolder}`;
        const files = await listRecentXmlFiles(client, folder, since);
        candidates.push(...files);
      }
    }

    const rawRows: EisRawTender[] = [];
    for (const filePath of candidates) {
      if (rawRows.length >= MAX_TENDERS) {
        break;
      }

      try {
        const parsed = await streamParseXmlFile(client, filePath, since);
        rawRows.push(...parsed);
      } catch {
        continue;
      }
    }

    const byId = new Map(rawRows.map((row) => [row.externalId, row]));
    return Array.from(byId.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, MAX_TENDERS);
  } finally {
    client.close();
  }
}

export async function fetchEisFromMachineReadableApi(_args: {
  keywords: string[];
  regionCodes: string[];
  fromDate?: string;
  toDate?: string;
  gosuslugiToken: string;
}): Promise<EisRawTender[]> {
  // IMPORTANT: HTML scraping is prohibited for EIS. Use official machine-readable API only.
  // TODO: Call official machine-readable EIS API with Gosuslugi token.
  // Keep exactly the same quality filters as in FTP mode before returning rows.
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
  const rawRows =
    args.method === 'ftp'
      ? await fetchEisFromFtpDelta(args)
      : await fetchEisFromMachineReadableApi({
          ...args,
          gosuslugiToken: args.gosuslugiToken || '',
        });

  const keywords = args.keywords.map((k) => normalize(k));
  const regions = new Set(args.regionCodes.map((code) => code.trim()));

  return rawRows
    .filter((row) => {
      const searchable = normalize(`${row.title} ${row.description}`);
      const keywordHit = keywords.some((keyword) => searchable.includes(keyword));
      const regionHit = regions.size === 0 || regions.has(row.regionCode);
      return keywordHit || regionHit;
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, MAX_TENDERS);
}
