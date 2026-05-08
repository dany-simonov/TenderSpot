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
export function parserLog(message) {
    const timestamp = new Date().toISOString();
    console.log(`[parser][${timestamp}] ${message}`);
}
export async function executeSync() {
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
    parserLog(`ETL completed. Extracted: ${result.extracted}, loaded: ${result.loaded}`);
    return result ?? null;
}
