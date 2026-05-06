import { appEnv } from '@/config/env';

export interface ParserStatus {
  canRun: boolean;
  isRunning: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface ParserRunResponse {
  ok: boolean;
  status: ParserStatus;
  result?: { extracted: number; loaded: number } | null;
  message?: string;
}

function getParserBaseUrl(): string {
  const base = appEnv.parserApiUrl;
  if (!base) {
    throw new Error('Parser API URL is not configured.');
  }
  return base.replace(/\/+$/, '');
}

function getParserHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (appEnv.parserSyncSecret) {
    headers.Authorization = `Bearer ${appEnv.parserSyncSecret}`;
  }
  return headers;
}

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchParserStatus(): Promise<ParserStatus> {
  const base = getParserBaseUrl();
  const response = await fetch(`${base}/api/parser/status`, {
    method: 'GET',
    headers: getParserHeaders(),
  });

  const payload = await parseJson<{ ok?: boolean; status?: ParserStatus; message?: string }>(
    response
  );

  if (!response.ok || !payload?.status) {
    throw new Error(payload?.message || 'Failed to fetch parser status.');
  }

  return payload.status;
}

export async function runParser(): Promise<ParserRunResponse> {
  const base = getParserBaseUrl();
  const response = await fetch(`${base}/api/parser/run`, {
    method: 'POST',
    headers: getParserHeaders(),
  });

  const payload = await parseJson<ParserRunResponse>(response);
  if (!response.ok || !payload) {
    throw new Error(payload?.message || 'Failed to run parser.');
  }

  if (!payload.ok) {
    throw new Error(payload.message || 'Parser run rejected.');
  }

  return payload;
}
