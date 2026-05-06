import cron from 'node-cron';
import { parserEnv } from './config/env';
import { executeSync, parserLog } from './run';

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
