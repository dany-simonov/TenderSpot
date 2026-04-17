import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { parserEnv } from '../config/env';
import {
  extractAndFilterEis,
  humanFetch,
  loadSession,
  saveSession,
} from '../adapters/eis/eis.extract';

const TARGET_KEYWORDS = [
  'кровля',
  'капитальный ремонт кровли',
  'текущий ремонт кровли',
  'ремонт крыши',
  'мягкая кровля',
  'ремонт мягкой кровли',
  'мембранная кровля',
  'рулонная кровля',
  'мастичная кровля',
  'устройство кровли',
  'кровельные работы',
  'замена кровли',
  'плоская кровля',
  'реконструкция кровли',
  'восстановление кровли',
];

const TARGET_REGIONS = ['77', '50', '69'];
const DISCOVERY_TOP_LIMIT = 100;
const SAMPLE_SIZE = 5;
const OUTPUT_FILE = 'debug_5_tenders.json';

type StageOneTender = Awaited<ReturnType<typeof extractAndFilterEis>>[number];

type DiscoveryCard = {
  externalId: string;
  sourceUrl: string;
  stage1: {
    title: string;
    customer: string;
    regionCode: string;
    relevanceScore: number;
    price: number;
    deadline: string;
    published: string;
    innFromList: string;
  };
  extracted: {
    customerInn: {
      primary: string;
      candidates: string[];
    };
    customerKpp: {
      primary: string;
      candidates: string[];
    };
    customerOgrn: {
      primary: string;
      candidates: string[];
    };
    customerFullName: {
      primary: string;
      candidates: string[];
    };
    postalAddress: {
      primary: string;
      candidates: string[];
    };
    legalAddress: {
      primary: string;
      candidates: string[];
    };
    deliveryPlace: {
      primary: string;
      candidates: string[];
    };
    geographyAndContactBlocks: string[];
  };
};

function normalizeText(value: string): string {
  return value.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function uniqueNonEmpty(values: string[]): string[] {
  const unique = new Set<string>();
  for (const value of values.map((item) => normalizeText(item)).filter(Boolean)) {
    unique.add(value);
  }
  return Array.from(unique);
}

function collectTextLines(html: string): string[] {
  const $ = load(html);
  const lines: string[] = [];

  $('tr, li, dt, dd, p, div, span, td, th').each((_i, el) => {
    const text = normalizeText($(el).text());
    if (text.length >= 4) {
      lines.push(text);
    }
  });

  const rootText = normalizeText($.root().text());
  if (rootText) {
    lines.push(...rootText.split(/(?<=\.)\s+|\s{2,}|\n+/g).map((line) => normalizeText(line)));
  }

  return uniqueNonEmpty(lines);
}

function findByRegex(lines: string[], patterns: RegExp[]): string[] {
  const found: string[] = [];

  for (const line of lines) {
    for (const pattern of patterns) {
      if (pattern.global) {
        const matches = line.match(pattern) ?? [];
        found.push(...matches);
      } else {
        const match = line.match(pattern);
        if (match?.[1]) {
          found.push(match[1]);
        } else if (match?.[0]) {
          found.push(match[0]);
        }
      }
    }
  }

  return uniqueNonEmpty(found);
}

function findLabelValues(lines: string[], labels: RegExp[], maxLen = 320): string[] {
  const found: string[] = [];

  for (const line of lines) {
    const normalized = normalizeText(line);
    if (!normalized || normalized.length > maxLen) {
      continue;
    }

    const hasLabel = labels.some((label) => label.test(normalized));
    if (!hasLabel) {
      continue;
    }

    const withColon = normalized.match(/^[^:]{2,80}:\s*(.+)$/);
    if (withColon?.[1]) {
      found.push(withColon[1]);
      continue;
    }

    found.push(normalized);
  }

  return uniqueNonEmpty(found);
}

function pickPrimary(candidates: string[]): string {
  return candidates[0] ?? '';
}

function parseCardData(html: string): Omit<DiscoveryCard, 'externalId' | 'sourceUrl' | 'stage1'>['extracted'] {
  const lines = collectTextLines(html);

  const innCandidates = uniqueNonEmpty([
    ...findByRegex(lines, [
      /(?:ИНН(?:\s+заказчика)?|Идентификационный\s+номер\s+налогоплательщика)\D{0,30}(\d{10}|\d{12})/iu,
      /\b\d{10}\b/g,
      /\b\d{12}\b/g,
    ]),
  ]);

  const kppCandidates = uniqueNonEmpty([
    ...findByRegex(lines, [
      /(?:КПП)\D{0,30}(\d{9})/iu,
      /\b\d{9}\b/g,
    ]),
  ]);

  const ogrnCandidates = uniqueNonEmpty([
    ...findByRegex(lines, [
      /(?:ОГРН|Основной\s+государственный\s+регистрационный\s+номер)\D{0,30}(\d{13}|\d{15})/iu,
      /\b\d{13}\b/g,
      /\b\d{15}\b/g,
    ]),
  ]);

  const customerNameCandidates = uniqueNonEmpty([
    ...findLabelValues(lines, [
      /полное\s+наименование\s+заказчика/iu,
      /наименование\s+заказчика/iu,
      /заказчик/iu,
      /организация/iu,
    ]),
  ]);

  const postalAddressCandidates = uniqueNonEmpty([
    ...findLabelValues(lines, [
      /почтов(ый|ого)\s+адрес/iu,
      /адрес\s+для\s+корреспонденции/iu,
    ]),
  ]);

  const legalAddressCandidates = uniqueNonEmpty([
    ...findLabelValues(lines, [
      /место\s+нахождения/iu,
      /юридическ(ий|ого)\s+адрес/iu,
    ]),
  ]);

  const deliveryPlaceCandidates = uniqueNonEmpty([
    ...findLabelValues(lines, [
      /место\s+поставки/iu,
      /место\s+выполнения\s+работ/iu,
      /адрес\s+объекта/iu,
      /место\s+оказания\s+услуг/iu,
      /объект\s+закупки/iu,
    ]),
  ]);

  const geographyAndContactBlocks = uniqueNonEmpty(
    lines.filter((line) =>
      /(адрес|телефон|e-mail|email|контакт|индекс|область|район|город|ул\.|улица|дом\b|корпус|строение)/iu.test(
        line
      )
    )
  ).slice(0, 40);

  return {
    customerInn: {
      primary: pickPrimary(innCandidates),
      candidates: innCandidates,
    },
    customerKpp: {
      primary: pickPrimary(kppCandidates),
      candidates: kppCandidates,
    },
    customerOgrn: {
      primary: pickPrimary(ogrnCandidates),
      candidates: ogrnCandidates,
    },
    customerFullName: {
      primary: pickPrimary(customerNameCandidates),
      candidates: customerNameCandidates,
    },
    postalAddress: {
      primary: pickPrimary(postalAddressCandidates),
      candidates: postalAddressCandidates,
    },
    legalAddress: {
      primary: pickPrimary(legalAddressCandidates),
      candidates: legalAddressCandidates,
    },
    deliveryPlace: {
      primary: pickPrimary(deliveryPlaceCandidates),
      candidates: deliveryPlaceCandidates,
    },
    geographyAndContactBlocks,
  };
}

function toCardRecord(tender: StageOneTender, html: string): DiscoveryCard {
  return {
    externalId: tender.externalId,
    sourceUrl: tender.sourceUrl,
    stage1: {
      title: tender.title,
      customer: tender.customer,
      regionCode: tender.regionCode,
      relevanceScore: tender.relevanceScore,
      price: tender.price,
      deadline: tender.deadline,
      published: tender.published,
      innFromList: tender.inn,
    },
    extracted: parseCardData(html),
  };
}

async function run(): Promise<void> {
  const log = (message: string) => {
    console.log(`[debug-discovery] ${message}`);
  };

  log('stage-1 extraction started');
  const rows = await extractAndFilterEis({
    method: parserEnv.EIS_EXTRACT_METHOD,
    keywords: TARGET_KEYWORDS,
    regionCodes: TARGET_REGIONS,
    gosuslugiToken: parserEnv.EIS_GOSUSLUGI_TOKEN,
    log,
  });

  const top100 = [...rows]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, DISCOVERY_TOP_LIMIT);

  const sample = top100.slice(0, SAMPLE_SIZE);

  log(`stage-1 done: total=${rows.length}, top100=${top100.length}, sample=${sample.length}`);

  const session = await loadSession();
  const cards: DiscoveryCard[] = [];

  try {
    for (let index = 0; index < sample.length; index += 1) {
      const tender = sample[index];
      log(`fetch card ${index + 1}/${sample.length}: ${tender.sourceUrl}`);
      const html = await humanFetch(session, tender.sourceUrl);
      cards.push(toCardRecord(tender, html));
    }
  } finally {
    await saveSession(session);
  }

  const debugData = {
    generatedAt: new Date().toISOString(),
    method: parserEnv.EIS_EXTRACT_METHOD,
    stage1: {
      totalCollected: rows.length,
      topLimit: DISCOVERY_TOP_LIMIT,
      sampleSize: SAMPLE_SIZE,
      keywords: TARGET_KEYWORDS,
      regionCodes: TARGET_REGIONS,
    },
    cards,
  };

  const outPath = path.resolve(process.cwd(), OUTPUT_FILE);
  await writeFile(outPath, `${JSON.stringify(debugData, null, 2)}\n`, 'utf-8');
  console.log(JSON.stringify(debugData, null, 2));
  log(`saved debug json: ${outPath}`);
}

run().catch((error) => {
  console.error(
    `[debug-discovery] failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
