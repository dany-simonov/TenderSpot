# TenderSpot Parser Service

Modular ETL service that ingests tenders from external sources and upserts data into Appwrite.

## Constraints for EIS

- HTML scraping is intentionally prohibited.
- Supported extract strategies:
  - Official FTP XML delta archives (`ftp.zakupki.gov.ru`)
  - Official machine-readable API (with Gosuslugi token)
   - Human-like web session mode (`EIS_EXTRACT_METHOD=human`) for cases where FTP/API is unavailable

## Architecture

- `src/core/source-adapter.ts` - strategy contracts (`TenderSourceAdapter`)
- `src/adapters/eis` - EIS source adapter and extract skeleton
- `src/loaders/appwrite-loader.ts` - Appwrite upsert logic
- `src/core/etl-runner.ts` - generic orchestrator for all adapters
- `src/index.ts` - scheduler/entrypoint

## Run

1. Create `.env` from `.env.example`
2. Install deps:
   - `npm install`
3. One-time run:
   - `npm run run`
4. Schedule mode (cron):
   - `npm run schedule`

## Human-Like Session Mode

This mode simulates a real user session on EIS search pages:

- starts from homepage
- uses browser-like request headers
- keeps and reuses cookies between runs
- adds random delays between actions
- intended for low-frequency runs (default: every 48h)

### Required env

- `EIS_EXTRACT_METHOD=human`
- `APPWRITE_PARSER_STATE_COLLECTION_ID=<collection-id>` (optional but recommended)

### Optional env

- `EIS_HUMAN_SESSION_MIN_SECONDS=1200`
- `EIS_HUMAN_SESSION_MAX_SECONDS=2400`
- `EIS_HUMAN_MIN_STEP_DELAY_MS=2500`
- `EIS_HUMAN_MAX_STEP_DELAY_MS=15000`
- `PARSER_CRON=17 3 */2 * *`

### Appwrite state collection schema

If `APPWRITE_PARSER_STATE_COLLECTION_ID` is provided, create a collection with attributes:

- `key` (string, required)
- `payload` (string, required)

The parser stores:

- `eis_human_session` (cookies)
- `eis_human_last_error` (last runtime error)

## Scaling to New Sources

To add ROOF.ru, КомТендер, etc:

1. Create a new adapter implementing `TenderSourceAdapter`
2. Register it in `src/index.ts`
3. Keep load phase unchanged (Appwrite loader is shared)
