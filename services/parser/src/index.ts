import cron from 'node-cron';
import { parserEnv } from './config/env';
import { runEtlPipeline } from './core/etl-runner';
import { EisSourceAdapter } from './adapters/eis/eis.adapter';
import { AppwriteTenderLoader } from './loaders/appwrite-loader';

const targetKeywords = ['кровля', 'ПВХ мембрана', 'склад', 'ангар'];
const targetRegionCodes = ['77', '50'];

async function executeSync(): Promise<void> {
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
    },
    loader,
  });

  console.log(
    `[parser] ETL completed. Extracted: ${result.extracted}, loaded: ${result.loaded}`
  );
}

const runOnce = process.argv.includes('--once');

if (runOnce) {
  executeSync().catch((error) => {
    console.error('[parser] ETL failed:', error);
    process.exitCode = 1;
  });
} else {
  console.log(`[parser] Scheduler started with cron: ${parserEnv.PARSER_CRON}`);
  cron.schedule(parserEnv.PARSER_CRON, () => {
    executeSync().catch((error) => {
      console.error('[parser] Scheduled ETL failed:', error);
    });
  });
}
