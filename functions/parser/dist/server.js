import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { parserEnv } from './config/env';
import { ParserStateStore } from './loaders/parser-state-store';
import { executeSync, parserLog } from './run';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const PORT = Number(process.env.PARSER_HTTP_PORT ?? 8787);
const CORS_ORIGIN = process.env.PARSER_CORS_ORIGIN ?? '*';
const stateStore = new ParserStateStore({
    endpoint: parserEnv.APPWRITE_ENDPOINT,
    projectId: parserEnv.APPWRITE_PROJECT_ID,
    apiKey: parserEnv.PARSER_APPWRITE_API_KEY,
    databaseId: parserEnv.APPWRITE_DATABASE_ID,
    collectionId: parserEnv.APPWRITE_PARSER_STATE_COLLECTION_ID,
});
let isRunning = false;
function sendJson(res, status, payload) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': CORS_ORIGIN,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(JSON.stringify(payload));
}
function isAuthorized(req) {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) {
        return false;
    }
    const token = header.slice('Bearer '.length).trim();
    return token === parserEnv.PARSER_SYNC_SECRET;
}
async function buildRunStatus() {
    const runState = await stateStore.loadRunState();
    const lastRunAt = runState?.startedAt ? new Date(runState.startedAt) : null;
    const nextRunAt = lastRunAt ? new Date(lastRunAt.getTime() + COOLDOWN_MS) : null;
    const now = Date.now();
    const canRun = !isRunning &&
        (!nextRunAt || Number.isNaN(nextRunAt.getTime()) || nextRunAt.getTime() <= now);
    return {
        canRun,
        isRunning,
        lastRunAt: lastRunAt && !Number.isNaN(lastRunAt.getTime()) ? lastRunAt.toISOString() : null,
        nextRunAt: nextRunAt && !Number.isNaN(nextRunAt.getTime()) ? nextRunAt.toISOString() : null,
    };
}
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': CORS_ORIGIN,
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        res.end();
        return;
    }
    if (req.method === 'GET' && url.pathname === '/api/parser/status') {
        const status = await buildRunStatus();
        sendJson(res, 200, { ok: true, status });
        return;
    }
    if (req.method === 'POST' && url.pathname === '/api/parser/run') {
        if (!isAuthorized(req)) {
            sendJson(res, 401, { ok: false, message: 'Unauthorized' });
            return;
        }
        const status = await buildRunStatus();
        if (!status.canRun) {
            sendJson(res, 429, {
                ok: false,
                message: status.isRunning
                    ? 'Parser already running'
                    : 'Parser cooldown not finished',
                status,
            });
            return;
        }
        const runId = randomUUID();
        const startedAt = new Date().toISOString();
        isRunning = true;
        await stateStore.saveRunState({ status: 'running', startedAt });
        parserLog(`API run started: ${runId}`);
        try {
            const result = await executeSync();
            const finishedAt = new Date().toISOString();
            await stateStore.saveRunState({
                status: 'success',
                startedAt,
                finishedAt,
            });
            parserLog(`API run completed: ${runId}`);
            sendJson(res, 200, {
                ok: true,
                status: await buildRunStatus(),
                result,
            });
        }
        catch (error) {
            const finishedAt = new Date().toISOString();
            const message = error instanceof Error ? error.message : String(error);
            await stateStore.saveRunState({
                status: 'failed',
                startedAt,
                finishedAt,
                error: message,
            });
            parserLog(`API run failed: ${runId} (${message})`);
            sendJson(res, 500, {
                ok: false,
                message,
                status: await buildRunStatus(),
            });
        }
        finally {
            isRunning = false;
        }
        return;
    }
    sendJson(res, 404, { ok: false, message: 'Not found' });
});
server.listen(PORT, () => {
    parserLog(`Parser API listening on port ${PORT}`);
});
