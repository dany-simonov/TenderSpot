import { parserEnv } from './config/env';
import { runEtlPipeline } from './core/etl-runner';
import { EisSourceAdapter } from './adapters/eis/eis.adapter';
import { AppwriteTenderLoader } from './loaders/appwrite-loader';

const targetKeywords = [
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
const targetRegionCodes = ['77', '50', '69'];

export function parserLog(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[parser] ${timestamp} ${message}`);
}

async function runParser(log: (message: string) => void): Promise<{ extracted: number; loaded: number }> {
  log('run started');

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
      log,
    },
    loader,
  });

  log(`ETL completed. Extracted: ${result.extracted}, loaded: ${result.loaded}`);

  return result;
}

export async function executeSync(): Promise<{ extracted: number; loaded: number }> {
  return runParser(parserLog);
}

// 1. Declare the main handler
const main = async ({ req, res, log, error }: any) => {
    try {
        log("Execution started...");
        const data = await runParser(log); // Call logic inside the handler
        log("Execution successful.");

        return res.json({ success: true, data });
    } catch (err: any) {
        error(`Critical failure: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};

// 2. EXPORT IT explicitly. Do NOT execute main() at the top level!
(main as { executeSync?: typeof executeSync; parserLog?: typeof parserLog }).executeSync = executeSync;
(main as { executeSync?: typeof executeSync; parserLog?: typeof parserLog }).parserLog = parserLog;
export default main;
