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

// Function to use Appwrite's log context
function parserLog(appwriteLog: (message: string) => void, message: string): void {
  const timestamp = new Date().toISOString();
  appwriteLog(`[parser][${timestamp}] ${message}`);
}

async function executeSync(appwriteLog: (message: string) => void): Promise<{ extracted: number; loaded: number } | null> {
  parserLog(appwriteLog, 'run started');

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
      log: (message: string) => parserLog(appwriteLog, message), // Pass Appwrite's log to pipeline
    },
    loader,
  });

  parserLog(appwriteLog, `ETL completed. Extracted: ${result.extracted}, loaded: ${result.loaded}`);

  return result ?? null;
}

// Appwrite REQUIRES a default export with this specific signature
export default async ({ req, res, log, error }: any) => {
    try {
        log("Starting tender parser...");

        // Await your parser logic here
        const result = await executeSync(log);

        log("Parsing successfully completed.");
        // Appwrite REQUIRES returning a response
        return res.json({ success: true, data: result });
    } catch (err: any) {
        error(`Parser crashed: ${err.message}`);
        if (err.stack) error(err.stack);

        return res.json({ success: false, error: err.message }, 500);
    }
};
