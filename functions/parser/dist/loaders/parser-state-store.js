import { Client, Databases, ID, Query } from 'node-appwrite';
const SESSION_KEY = 'eis_human_session';
const LAST_ERROR_KEY = 'eis_human_last_error';
const LAST_RUN_KEY = 'parser_last_run';
export class ParserStateStore {
    databases;
    databaseId;
    collectionId;
    constructor(config) {
        const client = new Client()
            .setEndpoint(config.endpoint)
            .setProject(config.projectId)
            .setKey(config.apiKey);
        this.databases = new Databases(client);
        this.databaseId = config.databaseId;
        this.collectionId = config.collectionId;
    }
    async loadCookies() {
        const payload = await this.getPayloadByKey(SESSION_KEY);
        if (!payload || !Array.isArray(payload.cookies)) {
            return [];
        }
        return payload.cookies.filter((item) => typeof item === 'string');
    }
    async saveCookies(cookies) {
        await this.upsertByKey(SESSION_KEY, {
            cookies: Array.from(new Set(cookies)),
            updatedAt: new Date().toISOString(),
        });
    }
    async reportError(message) {
        await this.upsertByKey(LAST_ERROR_KEY, {
            message,
            updatedAt: new Date().toISOString(),
        });
    }
    async loadRunState() {
        const payload = await this.getPayloadByKey(LAST_RUN_KEY);
        if (!payload) {
            return null;
        }
        const state = {};
        if (typeof payload.startedAt === 'string') {
            state.startedAt = payload.startedAt;
        }
        if (typeof payload.finishedAt === 'string') {
            state.finishedAt = payload.finishedAt;
        }
        if (payload.status === 'running' || payload.status === 'success' || payload.status === 'failed') {
            state.status = payload.status;
        }
        if (typeof payload.error === 'string') {
            state.error = payload.error;
        }
        return state;
    }
    async saveRunState(state) {
        await this.upsertByKey(LAST_RUN_KEY, {
            ...state,
            updatedAt: new Date().toISOString(),
        });
    }
    async getPayloadByKey(key) {
        if (!this.collectionId) {
            return null;
        }
        try {
            const response = await this.databases.listDocuments(this.databaseId, this.collectionId, [
                Query.equal('key', key),
                Query.limit(1),
            ]);
            if (response.total === 0) {
                return null;
            }
            const raw = response.documents[0];
            if (typeof raw.payload !== 'string') {
                return null;
            }
            const parsed = JSON.parse(raw.payload);
            if (typeof parsed !== 'object' || parsed === null) {
                return null;
            }
            return parsed;
        }
        catch {
            return null;
        }
    }
    async upsertByKey(key, payload) {
        if (!this.collectionId) {
            return;
        }
        try {
            const existing = await this.databases.listDocuments(this.databaseId, this.collectionId, [
                Query.equal('key', key),
                Query.limit(1),
            ]);
            if (existing.total > 0) {
                await this.databases.updateDocument(this.databaseId, this.collectionId, existing.documents[0].$id, {
                    key,
                    payload: JSON.stringify(payload),
                });
                return;
            }
            await this.databases.createDocument(this.databaseId, this.collectionId, ID.unique(), {
                key,
                payload: JSON.stringify(payload),
            });
        }
        catch {
            // Intentionally swallow to avoid breaking parsing flow when state collection is unavailable.
        }
    }
}
