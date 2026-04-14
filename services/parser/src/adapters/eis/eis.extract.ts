import { parserEnv } from '../../config/env';
import { ParserStateStore } from '../../loaders/parser-state-store';
import { load } from 'cheerio';

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

type HumanSession = {
  cookieJar: Map<string, string>;
};

const DAYS_BACK = 120;
const MIN_PRICE = 200_000;
const MAX_TENDERS = 500;
const SEARCH_PAGES_PER_KEYWORD = 15;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
const EIS_HOME_URL = 'https://zakupki.gov.ru/';
const EIS_RESULTS_URL = 'https://zakupki.gov.ru/epz/order/extendedsearch/results.html';

const SOFT_ROOF_INCLUDE = [
  'кровля',
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
  'мбоу',
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

const MOSCOW_AGGLOMERATION = [
  'москва',
  'зеленоград',
  'троицк',
  'химки',
  'балашиха',
  'подольск',
  'мытищи',
  'королев',
  'люберцы',
  'красногорск',
  'электросталь',
  'одинцово',
  'домодедово',
  'щелково',
  'серпухов',
  'раменское',
  'долгопрудный',
  'реутов',
  'пушкино',
  'жуковский',
  'тверь',
];

const MOSCOW_MARKERS = [
  'москв',
  'московск',
  ...MOSCOW_AGGLOMERATION,
];

const REGIONAL_BLACKLIST_WORDS = [
  'сахалин',
  'якутск',
  'курган',
  'свердловск',
  'екатеринбург',
  'красноярск',
  'донецк',
  'новосибирск',
  'саратов',
  'петербург',
  'спб',
  'хабаровск',
  'архангельск',
  'магадан',
  'уфа',
  'башкортостан',
  'казань',
  'татарстан',
  'омск',
  'нижний новгород',
  'челябинск',
  'норильск',
  'калининград',
  'ленинградская',
  'псков',
  'рязань',
  'ярославль',
  'луганск',
  'тюмень',
  'краснодар',
  'чукотка',
  'белгород',
  'салехард',
  'магнитогорск',
  'владивосток',
  'мурманск',
  'камчатка',
  'чебоксары',
  'волгоград',
  'воронеж',
  'самара',
  'ростов-на-дону',
  'иркутск',
];

const AREA_REGEX = /(\d{1,6}(?:[\s.,]\d{1,2})?)\s*(?:м2|м²|кв\.?\s*м|м\.?\s*кв\.?)/i;

interface TenderAccumulator {
  externalId: string;
  sourceUrlRaw: string;
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

const stateStore = new ParserStateStore({
  endpoint: parserEnv.APPWRITE_ENDPOINT,
  projectId: parserEnv.APPWRITE_PROJECT_ID,
  apiKey: parserEnv.PARSER_APPWRITE_API_KEY,
  databaseId: parserEnv.APPWRITE_DATABASE_ID,
  collectionId: parserEnv.APPWRITE_PARSER_STATE_COLLECTION_ID,
});

function emptyAccumulator(): TenderAccumulator {
  return {
    externalId: '',
    sourceUrlRaw: '',
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

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html: string): string {
  return normalize(htmlToText(html));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function humanPause(): Promise<void> {
  const min = parserEnv.EIS_HUMAN_MIN_STEP_DELAY_MS;
  const max = parserEnv.EIS_HUMAN_MAX_STEP_DELAY_MS;
  await sleep(randomInt(min, max));
}

function parseSetCookie(raw: string): { name: string; value: string } | null {
  const head = raw.split(';')[0]?.trim();
  if (!head || !head.includes('=')) {
    return null;
  }
  const [name, ...rest] = head.split('=');
  return {
    name: name.trim(),
    value: rest.join('=').trim(),
  };
}

function serializeCookieJar(jar: Map<string, string>): string {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function extractSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof withGetSetCookie.getSetCookie === 'function') {
    return withGetSetCookie.getSetCookie();
  }

  const combined = headers.get('set-cookie');
  if (!combined) {
    return [];
  }

  return combined
    .split(/,(?=[^;]+=[^;]+)/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeCookies(session: HumanSession, setCookies: string[]): void {
  for (const raw of setCookies) {
    const cookie = parseSetCookie(raw);
    if (!cookie) {
      continue;
    }
    session.cookieJar.set(cookie.name, cookie.value);
  }
}

function parsePersistedCookies(rows: string[]): Map<string, string> {
  const jar = new Map<string, string>();
  for (const row of rows) {
    const parsed = parseSetCookie(row);
    if (parsed) {
      jar.set(parsed.name, parsed.value);
    }
  }
  return jar;
}

async function loadSession(): Promise<HumanSession> {
  const persisted = await stateStore.loadCookies();
  return {
    cookieJar: parsePersistedCookies(persisted),
  };
}

async function saveSession(session: HumanSession): Promise<void> {
  const serialized = Array.from(session.cookieJar.entries()).map(
    ([name, value]) => `${name}=${value}`
  );
  await stateStore.saveCookies(serialized);
}

async function humanFetch(
  session: HumanSession,
  url: string,
  referer?: string
): Promise<string> {
  await humanPause();

  const headers = new Headers({
    'User-Agent': USER_AGENT,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Connection: 'keep-alive',
    Referer: referer ?? EIS_HOME_URL,
  });

  const cookieHeader = serializeCookieJar(session.cookieJar);
  if (cookieHeader) {
    headers.set('Cookie', cookieHeader);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  mergeCookies(session, extractSetCookies(response.headers));

  if (!response.ok) {
    throw new Error(`[human] HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

function parseDateFromText(input: string): string {
  const match = input.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) {
    return new Date().toISOString();
  }

  const iso = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z`);
  return Number.isNaN(iso.getTime()) ? new Date().toISOString() : iso.toISOString();
}

function extractDateNearLabel(block: string, labelPattern: RegExp): string {
  const $ = load(block);

  const directValue = $('.data-block__title')
    .filter((_i, el) => normalizeWhitespace($(el).text()).toLowerCase() === 'окончание подачи заявок')
    .first()
    .next('.data-block__value')
    .text()
    .trim();

  if (directValue) {
    const dateMatch = normalizeWhitespace(directValue).match(/\d{2}\.\d{2}\.\d{4}/);
    if (dateMatch?.[0]) {
      return parseDateFromText(dateMatch[0]);
    }
  }

  const nodes = $('div, span, p, dt, dd, td, th, li');

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes.eq(i);
    const text = normalizeWhitespace(node.text());
    if (!labelPattern.test(text)) {
      continue;
    }

    const siblingCandidates = [
      node.next().text(),
      node.nextAll('div, span, p, dd, td, li').first().text(),
      node.parent().text(),
      node.parent().next().text(),
    ];

    for (const candidate of siblingCandidates) {
      const dateMatch = normalizeWhitespace(candidate).match(/\d{2}\.\d{2}\.\d{4}/);
      if (dateMatch?.[0]) {
        return parseDateFromText(dateMatch[0]);
      }
    }
  }

  const plain = normalizeWhitespace($.root().text());
  const contextual = plain.match(
    new RegExp(`${labelPattern.source}[^\\d]{0,50}(\\d{2}\\.\\d{2}\\.\\d{4})`, 'iu')
  );
  if (contextual?.[1]) {
    return parseDateFromText(contextual[1]);
  }

  return '';
}

function extractDeadlineFromBlock(block: string): string {
  return extractDateNearLabel(block, /окончание\s+подачи\s+заяв(ок|ки)/i);
}

function normalizeCyrillic(value: string): string {
  return normalize(value).replace(/ё/g, 'е');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function findPriceLikeText(candidates: string[]): string {
  let fallback = '';
  for (const candidate of candidates.map((c) => normalizeWhitespace(c)).filter(Boolean)) {
    if (!fallback && /\d/.test(candidate)) {
      fallback = candidate;
    }

    if (cleanAndParsePrice(candidate) > 0) {
      return candidate;
    }
  }

  return fallback;
}

function extractRawPriceFragment(input: string): string {
  const $ = load(input);
  const formScope = $('.registry-entry__form').first();
  const scope = formScope.length ? formScope : $('body');

  const byPriceBlockClass = scope
    .find('.price-block__value')
    .map((_i, el) => $(el).text())
    .get();
  const byPriceBlockResult = findPriceLikeText(byPriceBlockClass);
  if (byPriceBlockResult) {
    return byPriceBlockResult;
  }

  const byLabelAndNext: string[] = [];
  scope.find('div, span, p, dt, dd').each((_i, el) => {
    const label = normalizeWhitespace($(el).text());
    if (!/(начальная|нмцк)/i.test(label)) {
      return;
    }

    const nextValue = normalizeWhitespace($(el).nextAll('div, span, p, dd').first().text());
    if (nextValue) {
      byLabelAndNext.push(nextValue);
    }

    const parentValues = $(el)
      .parent()
      .find('div, span, p, dd')
      .map((_j, node) => normalizeWhitespace($(node).text()))
      .get()
      .filter((value) => /\d/.test(value));
    byLabelAndNext.push(...parentValues);
  });
  const byLabelResult = findPriceLikeText(byLabelAndNext);
  if (byLabelResult) {
    return byLabelResult;
  }

  const byRubAny = scope
    .find('div, span, p, strong, b')
    .map((_i, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter((value) => /(₽|руб)/i.test(value) && /\d/.test(value));
  const byRubResult = findPriceLikeText(byRubAny);
  if (byRubResult) {
    return byRubResult;
  }

  const blockText = normalizeWhitespace(scope.text());
  const ultimateMatchFromText = blockText.match(
    /([\d\s\u00A0&nbsp;]{3,},\d{2})\s*(?:₽|руб|Российский рубль)/i
  );
  if (ultimateMatchFromText?.[0]) {
    return ultimateMatchFromText[0];
  }

  const blockTextWithEntities = normalizeWhitespace(input.replace(/<[^>]+>/g, ' '));
  const ultimateMatchFromRaw = blockTextWithEntities.match(
    /([\d\s\u00A0&nbsp;]{3,},\d{2})\s*(?:₽|руб|Российский рубль)/i
  );
  if (ultimateMatchFromRaw?.[0]) {
    return ultimateMatchFromRaw[0];
  }

  const fullText = htmlToText(input);
  const fallbackRegex = [
    /(?:НМЦК|Начальная\s+цена\s*договора|Начальная\s+цена|Цена)[:\s]*([\d\s\u00A0.,]+\s*(?:₽|руб\.?|рублей|российский\s+рубль)?)/i,
    /([\d\s\u00A0.,]+\s*(?:₽|руб\.?|рублей|российский\s+рубль))/i,
  ];
  const fallbackCandidates = fallbackRegex
    .map((pattern) => fullText.match(pattern)?.[1] ?? '')
    .filter(Boolean);

  return findPriceLikeText(fallbackCandidates);
}

function cleanAndParsePrice(raw: string): number {
  if (!raw) {
    return 0;
  }

  const normalized = raw
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, '')
    .replace(/российскийрубль|российскийруб\.?|рублей|рубля|руб\.?|₽/gi, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '');

  if (!normalized) {
    return 0;
  }

  const dotCount = (normalized.match(/\./g) ?? []).length;
  const canonical =
    dotCount <= 1
      ? normalized
      : `${normalized.slice(0, normalized.lastIndexOf('.')).replace(/\./g, '')}.${normalized
          .slice(normalized.lastIndexOf('.') + 1)
          .replace(/\./g, '')}`;

  const parsed = Number(canonical);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRegNumberFromHref(href: string): string {
  const direct = href.match(/regNumber=(\d{8,})/i);
  if (direct) {
    return direct[1];
  }

  const fallback = href.match(/(\d{8,})/);
  return fallback ? fallback[1] : '';
}

function toAbsoluteEisUrl(href: string): string {
  const value = href.trim();
  if (!value) {
    return '';
  }

  try {
    return new URL(value, EIS_HOME_URL).toString();
  } catch {
    return '';
  }
}

function extractBlocks(html: string): string[] {
  const $ = load(html);
  const cardSet = new Set<string>();

  $('.search-registry-entry-block').each((_i, el) => {
    const card = $.html(el);
    if (card?.trim()) {
      cardSet.add(card);
    }
  });

  $('.row.registry-entry__form').each((_i, el) => {
    const row = $(el);
    const container = row.closest('.search-registry-entry-block');
    const card = container.length ? $.html(container) : $.html(row);
    if (card?.trim()) {
      cardSet.add(card);
    }
  });

  if (cardSet.size > 0) {
    return Array.from(cardSet);
  }

  const fallback = html.match(/<article[\s\S]*?<\/article>/gi);
  return fallback ?? [];
}

function buildTenderFromBlock(block: string): {
  tender: EisRawTender | null;
  rejectReason?: string;
} {
  const $ = load(block);
  const hrefCandidates = $('a[href]')
    .map((_i, el) => String($(el).attr('href') || '').trim())
    .get()
    .filter(Boolean);

  const preferredHref =
    hrefCandidates.find((href) => /notice223\/common-info\.html/i.test(href)) ||
    hrefCandidates.find((href) => /regNumber=\d{8,}/i.test(href)) ||
    hrefCandidates[0] ||
    '';

  const externalId =
    parseRegNumberFromHref(preferredHref) ||
    hrefCandidates.map((href) => parseRegNumberFromHref(href)).find(Boolean) ||
    block.match(/\b\d{11,19}\b/)?.[0] ||
    '';
  const sourceUrlRaw = toAbsoluteEisUrl(preferredHref);

  if (!externalId) {
    return {
      tender: null,
      rejectReason: 'missing-external-id',
    };
  }

  const titleRaw =
    block.match(/registry-entry__header-mid__title[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ??
    block.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ??
    '';
  const bodyPreview = stripTags(block);
  const fallbackTitle = bodyPreview
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  const title = stripTags(titleRaw) || fallbackTitle;
  if (!title) {
    return {
      tender: null,
      rejectReason: 'missing-title',
    };
  }

  const rawPriceFromHtml = extractRawPriceFragment(block);
  const body = bodyPreview;
  const price = cleanAndParsePrice(rawPriceFromHtml || body);
  const published = parseDateFromText(body);
  const deadline = extractDeadlineFromBlock(block);

  const customer = extractCustomerFromBlock(block);

  const inn = body.match(/\b\d{10}\b/)?.[0] ?? '';
  const lawRaw = body;
  const regionText = body;
  const description = `${body} ${extractAreaTag(`${title} ${body}`)}`.trim();

  const candidate: TenderAccumulator = {
    externalId,
    sourceUrlRaw,
    title,
    description,
    regionCode: body.includes('московск') ? '50' : '77',
    customer,
    inn,
    priceRaw: String(price),
    publishedRaw: published,
    deadlineRaw: deadline,
    lawRaw,
    regionText,
  };

  const finalized = finalizeTender(candidate, undefined);

  return finalized;
}

function extractCustomerFromBlock(block: string): string {
  const candidates = [
    /(?:Заказчик|Организация)[\s\S]{0,120}?(?:<[^>]+>){0,3}([\s\S]{3,220}?)(?:<\/|НМЦК|Цена|Регион|Субъект|ИНН)/i,
    /registry-entry__body-value[^>]*>([\s\S]{3,220}?)<\/div>/i,
    /(?:Наименование\s*заказчика|Заказчик)[\s\S]{0,120}?(?:<[^>]+>){0,3}([\s\S]{3,220}?)(?:<\/|ИНН|КПП|ОГРН)/i,
  ];

  for (const pattern of candidates) {
    const match = block.match(pattern)?.[1];
    const value = stripTags(match ?? '');
    if (value) {
      return value;
    }
  }

  return '';
}

function buildSearchUrl(keyword: string, page: number, regionCodes: string[]): string {
  const params = new URLSearchParams();
  params.set('searchString', keyword);
  params.set('morphology', 'on');
  params.set('recordsPerPage', '_10');
  params.set('pageNumber', String(page));
  params.set('sortDirection', 'false');
  params.set('fz223', 'on');

  for (const region of regionCodes.map((code) => code.trim()).filter(Boolean)) {
    params.append('regions', region);
  }

  return `${EIS_RESULTS_URL}?${params.toString()}`;
}

async function browseResultsHumanLike(args: {
  keywords: string[];
  regionCodes: string[];
  fromDate?: string;
  toDate?: string;
  log?: (message: string) => void;
  onTender?: (tender: EisRawTender) => Promise<void>;
}): Promise<EisRawTender[]> {
  const session = await loadSession();
  const collected: EisRawTender[] = [];
  const emittedIds = new Set<string>();

  const stats = {
    scannedBlocks: 0,
    parsedBlocks: 0,
    rejectedByReason: {} as Record<string, number>,
  };

  const log = (message: string) => {
    args.log?.(message);
  };

  const sessionStart = Date.now();
  const minDuration = parserEnv.EIS_HUMAN_SESSION_MIN_SECONDS * 1000;
  const maxDuration = parserEnv.EIS_HUMAN_SESSION_MAX_SECONDS * 1000;
  const targetDuration = randomInt(minDuration, maxDuration);

  log(
    `[human] session started; target duration ${Math.round(targetDuration / 1000)} sec, keywords=${args.keywords.join(', ')}`
  );

  try {
    log('[human] open homepage');
    await humanFetch(session, EIS_HOME_URL);

    for (const keyword of args.keywords) {
      const perKeywordStats = {
        scannedBlocks: 0,
        parsedBlocks: 0,
        matched: 0,
        rejectedByReason: {} as Record<string, number>,
      };
      let stopAfterKeyword = false;

      log(`[human] keyword pass: ${keyword}`);
      for (let page = 1; page <= SEARCH_PAGES_PER_KEYWORD; page += 1) {
        const url = buildSearchUrl(keyword, page, args.regionCodes);
        log(`[human] fetch page ${page}: ${url}`);
        const html = await humanFetch(session, url, EIS_HOME_URL);
        const blocks = extractBlocks(html);
        stats.scannedBlocks += blocks.length;
        perKeywordStats.scannedBlocks += blocks.length;
        log(`[human] found blocks on page ${page}: ${blocks.length}`);

        for (const block of blocks) {
          const parsed = buildTenderFromBlock(block);
          stats.parsedBlocks += 1;
          perKeywordStats.parsedBlocks += 1;

          if (parsed.rejectReason) {
            stats.rejectedByReason[parsed.rejectReason] =
              (stats.rejectedByReason[parsed.rejectReason] ?? 0) + 1;
            perKeywordStats.rejectedByReason[parsed.rejectReason] =
              (perKeywordStats.rejectedByReason[parsed.rejectReason] ?? 0) + 1;
          }

          const tender = parsed.tender;
          if (!tender) {
            continue;
          }

          if (!tender.deadline) {
            log(`[human] deadline not found: ${tender.externalId}`);
          }

          collected.push(tender);
          perKeywordStats.matched += 1;

          if (!emittedIds.has(tender.externalId)) {
            emittedIds.add(tender.externalId);
            if (args.onTender) {
              await args.onTender(tender);
            }
          }

          log(
            `[human] matched #${collected.length}: ${tender.externalId} | price=${Math.round(tender.price)} | region=${tender.regionCode}`
          );

          if (collected.length >= MAX_TENDERS) {
            log('[human] stop by MAX_TENDERS limit');
            stopAfterKeyword = true;
            break;
          }
        }

        if (collected.length >= MAX_TENDERS) {
          stopAfterKeyword = true;
          break;
        }

        if (Date.now() - sessionStart >= targetDuration) {
          log('[human] stop by target session duration');
          stopAfterKeyword = true;
          break;
        }
      }

      log(
        `[human] keyword summary: keyword="${keyword}", scannedBlocks=${perKeywordStats.scannedBlocks}, parsedBlocks=${perKeywordStats.parsedBlocks}, matched=${perKeywordStats.matched}, rejected=${JSON.stringify(perKeywordStats.rejectedByReason)}`
      );

      if (stopAfterKeyword || collected.length >= MAX_TENDERS || Date.now() - sessionStart >= targetDuration) {
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await stateStore.reportError(message);
    log(`[human] error: ${message}`);
    throw error;
  } finally {
    await saveSession(session);
    log('[human] session cookies saved');
  }

  const unique = new Map(collected.map((item) => [item.externalId, item]));
  const deduped = Array.from(unique.values())
    .filter((row) => isRecentDate(row.published, args.fromDate, args.toDate))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, MAX_TENDERS);

  log(
    `[human] done: scannedBlocks=${stats.scannedBlocks}, parsedBlocks=${stats.parsedBlocks}, matched=${collected.length}, deduped=${deduped.length}`
  );
  log(`[human] rejected stats: ${JSON.stringify(stats.rejectedByReason)}`);

  return deduped;
}

function containsAny(text: string, keywords: string[]): boolean {
  const value = normalize(text);
  return keywords.some((keyword) => value.includes(normalize(keyword)));
}

function parseMoney(raw: string): number {
  return cleanAndParsePrice(raw);
}

function parseDate(raw: string, fallback?: Date): string {
  const text = raw?.trim();
  if (!text) {
    return '';
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

function isExpiredDate(isoDate: string): boolean {
  if (!isoDate) {
    return false;
  }

  const deadline = new Date(isoDate);
  if (Number.isNaN(deadline.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return deadline.getTime() < today.getTime();
}

function isTargetCustomer(entry: TenderAccumulator): boolean {
  const scope = `${entry.customer} ${entry.description} ${entry.title} ${entry.lawRaw}`;
  return !containsAny(scope, NON_B2B_CUSTOMERS);
}

function hasSoftRoofScope(entry: TenderAccumulator): boolean {
  const text = `${entry.title} ${entry.description}`;
  return !containsAny(text, HARD_ROOF_EXCLUDE);
}

function calculateRegionalScore(entry: TenderAccumulator): number {
  let relevanceScore = 0;
  const title = normalizeCyrillic(entry.title);
  const customer = normalizeCyrillic(entry.customer);
  const description = normalizeCyrillic(entry.description);
  const scope = `${title} ${customer} ${description}`;

  const moscowHit = MOSCOW_MARKERS.some(
    (marker) => scope.includes(normalizeCyrillic(marker))
  );
  if (moscowHit) {
    relevanceScore += 50;
  }

  if (scope.includes('тверь') || scope.includes('тверская область')) {
    relevanceScore += 50;
  }

  const cityRegex = /г\.\s*([А-Яа-яЁё-]+)/giu;
  const cityMatches = Array.from(`${entry.title} ${entry.customer} ${entry.description}`.matchAll(cityRegex));
  const hasForeignCityByGeoRegex = cityMatches.some((match) => {
    const city = normalizeCyrillic(match[1] ?? '');
    if (!city) {
      return false;
    }

    return !MOSCOW_AGGLOMERATION.some((allowed) => {
      const candidate = normalizeCyrillic(allowed);
      return city.includes(candidate) || candidate.includes(city);
    });
  });

  if (hasForeignCityByGeoRegex) {
    relevanceScore -= 1000;
  }

  const blacklistHit = REGIONAL_BLACKLIST_WORDS.some((word) => {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(normalizeCyrillic(word))}([^\\p{L}\\p{N}_]|$)`, 'iu');
    return pattern.test(scope);
  });

  if (blacklistHit) {
    relevanceScore -= 1000;
  }

  return relevanceScore;
}

function calculateRelevance(entry: TenderAccumulator, price: number, areaTag: string): number {
  const regionalScore = calculateRegionalScore(entry);
  const text = `${entry.title} ${entry.description}`;
  const includeHits = SOFT_ROOF_INCLUDE.filter((k) => containsAny(text, [k])).length;
  const directionBonus = 0;
  const areaBonus = areaTag ? 6 : 0;
  const priceBonus = Math.min(12, Math.floor(price / 500_000));
  return regionalScore + includeHits * 8 + directionBonus + areaBonus + priceBonus;
}

function getRejectReason(entry: TenderAccumulator, fileDate?: Date): string | null {
  if (!entry.externalId || !entry.title) {
    return 'missing-core-fields';
  }

  const regionalScore = calculateRegionalScore(entry);
  if (regionalScore < 0) {
    return 'regional-garbage';
  }

  if (!isTargetCustomer(entry)) {
    return 'non-b2b-customer';
  }
  if (!hasSoftRoofScope(entry)) {
    return 'hard-roof-excluded';
  }

  const price = parseMoney(entry.priceRaw);
  if (price < MIN_PRICE) {
    return 'price-below-threshold';
  }

  if (entry.deadlineRaw) {
    const deadline = parseDate(entry.deadlineRaw, fileDate);
    if (isExpiredDate(deadline)) {
      return 'expired';
    }
  }

  const published = parseDate(entry.publishedRaw, fileDate);
  if (!isRecentDate(published)) {
    return 'published-out-of-range';
  }

  return null;
}

function finalizeTender(entry: TenderAccumulator, fileDate?: Date): {
  tender: EisRawTender | null;
  rejectReason?: string;
} {
  const rejectReason = getRejectReason(entry, fileDate);
  if (rejectReason) {
    return {
      tender: null,
      rejectReason,
    };
  }

  const price = parseMoney(entry.priceRaw);
  const published = parseDate(entry.publishedRaw, fileDate);
  const deadline = entry.deadlineRaw ? parseDate(entry.deadlineRaw, fileDate) : '';
  const areaTag = extractAreaTag(`${entry.title} ${entry.description}`);
  const normalizedDescription = `${entry.description.trim()}${areaTag}`.trim();

  return {
    tender: {
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
      sourceUrl: entry.sourceUrlRaw.trim(),
      relevanceScore: calculateRelevance(entry, price, areaTag),
    },
  };
}

export async function fetchEisFromFtpDelta(args: {
  keywords: string[];
  regionCodes: string[];
  fromDate?: string;
  toDate?: string;
  log?: (message: string) => void;
  onTender?: (tender: EisRawTender) => Promise<void>;
}): Promise<EisRawTender[]> {
  return browseResultsHumanLike(args);
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
  method: 'ftp' | 'api' | 'human';
  keywords: string[];
  regionCodes: string[];
  fromDate?: string;
  toDate?: string;
  gosuslugiToken?: string;
  log?: (message: string) => void;
  onTender?: (tender: EisRawTender) => Promise<void>;
}): Promise<EisRawTender[]> {
  let rawRows: EisRawTender[] = [];

  if (args.method === 'api') {
    rawRows = await fetchEisFromMachineReadableApi({
      ...args,
      gosuslugiToken: args.gosuslugiToken || '',
    });
  } else {
    rawRows = await fetchEisFromFtpDelta(args);
  }

  const keywords = args.keywords.map((k) => normalize(k));
  const regions = new Set(args.regionCodes.map((code) => code.trim()));

  const result = rawRows
    .filter((row) => {
      const searchable = normalize(`${row.title} ${row.description}`);
      const keywordHit = keywords.some((keyword) => searchable.includes(keyword));
      const regionHit = regions.size === 0 || regions.has(row.regionCode);
      return keywordHit || regionHit;
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, MAX_TENDERS);

  args.log?.(
    `[eis.extract] post-filter result: input=${rawRows.length}, output=${result.length}, mode=${args.method}`
  );

  return result;
}
