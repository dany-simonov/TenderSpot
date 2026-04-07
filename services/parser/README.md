# TenderSpot Parser Service

Modular ETL service that ingests tenders from external sources and upserts data into Appwrite.

## Constraints for EIS

- HTML scraping is intentionally prohibited.
- Supported extract strategies:
  - Official FTP XML delta archives (`ftp.zakupki.gov.ru`)
  - Official machine-readable API (with Gosuslugi token)

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

## Scaling to New Sources

To add ROOF.ru, КомТендер, etc:

1. Create a new adapter implementing `TenderSourceAdapter`
2. Register it in `src/index.ts`
3. Keep load phase unchanged (Appwrite loader is shared)
