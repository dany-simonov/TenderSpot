import cron from 'node-cron';
import { parserEnv } from './config/env';
import { runEtlPipeline } from './core/etl-runner';
import { EisSourceAdapter } from './adapters/eis/eis.adapter';
import { AppwriteTenderLoader } from './loaders/appwrite-loader';

const targetKeywords = [
  'кровля',
  'ПВХ мембрана',
  'наплавляемая кровля',
  'рулонная кровля',
  'мастичная кровля',
  'кровля склада',
  'кровля ангара',
  'ремонт крыши',
  'капитальный ремонт кровли',
  'плоская кровля',
  'гидроизоляция кровли',
  'мягкая кровля',
  'ремонт мягкой кровли',
  'устройство мягкой кровли',
  'мембранная кровля',
  'замена кровли',
  'кровельные работы',
  'устройство кровли',
  'монтаж мягкой кровли',
];
const targetRegionCodes = ['77', '50', '69'];

function parserLog(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[parser][${timestamp}] ${message}`);
}

async function executeSync(): Promise<void> {
  parserLog('run started');

  const loader = new AppwriteTenderLoader({
    endpoint: parserEnv.APPWRITE_ENDPOINT,
    projectId: parserEnv.APPWRITE_PROJECT_ID,
    apiKey: parserEnv.PARSER_APPWRITE_API_KEY,
    databaseId: parserEnv.APPWRITE_DATABASE_ID,
    collectionId: parserEnv.APPWRITE_TENDERS_COLLECTION_ID,
  });

  const result = await runEtlPipeline({
    adapters: [new EisSourceAdapter()],
    context: {
      method: parserEnv.EIS_EXTRACT_METHOD,
      gosuslugiToken: parserEnv.EIS_GOSUSLUGI_TOKEN,
      keywords: targetKeywords,
      regionCodes: targetRegionCodes,
      log: parserLog,
    },
    loader,
  });

  parserLog(
    `ETL completed. Extracted: ${result.extracted}, loaded: ${result.loaded}`
  );
}

const runOnce = process.argv.includes('--once');

if (runOnce) {
  executeSync().catch((error) => {
    parserLog(`ETL failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
} else {
  parserLog(`Scheduler started with cron: ${parserEnv.PARSER_CRON}`);
  cron.schedule(parserEnv.PARSER_CRON, () => {
    executeSync().catch((error) => {
      parserLog(`Scheduled ETL failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  });
}
