import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../../../.env'),
];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const schema = z.object({
  APPWRITE_ENDPOINT: z.string().url(),
  APPWRITE_PROJECT_ID: z.string().min(1),
  APPWRITE_DATABASE_ID: z.string().min(1),
  APPWRITE_TENDERS_COLLECTION_ID: z.string().min(1),
  PARSER_APPWRITE_API_KEY: z.string().min(1),
  PARSER_SYNC_SECRET: z.string().min(1),
  EIS_EXTRACT_METHOD: z.enum(['ftp', 'api']).default('ftp'),
  EIS_GOSUSLUGI_TOKEN: z.string().optional(),
  PARSER_CRON: z.string().default('*/30 * * * *'),
});

const normalizedEnv = {
  ...process.env,
  APPWRITE_ENDPOINT: process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID:
    process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID,
  APPWRITE_DATABASE_ID:
    process.env.APPWRITE_DATABASE_ID ?? process.env.VITE_APPWRITE_DATABASE_ID,
  APPWRITE_TENDERS_COLLECTION_ID:
    process.env.APPWRITE_TENDERS_COLLECTION_ID ??
    process.env.VITE_APPWRITE_TENDERS_COLLECTION_ID ??
    process.env.VITE_APPWRITE_COLLECTION_ID,
};

export const parserEnv = schema.parse(normalizedEnv);
