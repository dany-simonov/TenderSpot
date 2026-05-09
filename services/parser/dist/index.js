"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/run.ts
var run_exports = {};
__export(run_exports, {
  default: () => run_default
});
module.exports = __toCommonJS(run_exports);

// src/config/env.ts
var import_dotenv = __toESM(require("dotenv"), 1);
var import_node_fs = require("node:fs");
var import_node_path = __toESM(require("node:path"), 1);
var import_zod = require("zod");
var envCandidates = [
  import_node_path.default.resolve(process.cwd(), ".env"),
  import_node_path.default.resolve(__dirname, "../../../../.env")
];
for (const envPath of envCandidates) {
  if ((0, import_node_fs.existsSync)(envPath)) {
    import_dotenv.default.config({ path: envPath, override: false });
  }
}
var schema = import_zod.z.object({
  APPWRITE_ENDPOINT: import_zod.z.string().url(),
  APPWRITE_PROJECT_ID: import_zod.z.string().min(1),
  APPWRITE_DATABASE_ID: import_zod.z.string().min(1),
  APPWRITE_TENDERS_COLLECTION_ID: import_zod.z.string().min(1),
  APPWRITE_PARSER_STATE_COLLECTION_ID: import_zod.z.string().optional(),
  PARSER_APPWRITE_API_KEY: import_zod.z.string().min(1),
  PARSER_SYNC_SECRET: import_zod.z.string().min(1),
  EIS_EXTRACT_METHOD: import_zod.z.enum(["ftp", "api", "human"]).default("human"),
  EIS_GOSUSLUGI_TOKEN: import_zod.z.string().optional(),
  EIS_HUMAN_SESSION_MIN_SECONDS: import_zod.z.coerce.number().int().positive().default(1200),
  EIS_HUMAN_SESSION_MAX_SECONDS: import_zod.z.coerce.number().int().positive().default(3600),
  EIS_HUMAN_MIN_STEP_DELAY_MS: import_zod.z.coerce.number().int().positive().default(2500),
  EIS_HUMAN_MAX_STEP_DELAY_MS: import_zod.z.coerce.number().int().positive().default(15e3),
  PARSER_CRON: import_zod.z.string().default("17 3 */2 * *")
});
var normalizedEnv = {
  ...process.env,
  APPWRITE_ENDPOINT: process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID: process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID,
  APPWRITE_DATABASE_ID: process.env.APPWRITE_DATABASE_ID ?? process.env.VITE_APPWRITE_DATABASE_ID,
  APPWRITE_TENDERS_COLLECTION_ID: process.env.APPWRITE_TENDERS_COLLECTION_ID ?? process.env.VITE_APPWRITE_TENDERS_COLLECTION_ID ?? process.env.VITE_APPWRITE_COLLECTION_ID,
  APPWRITE_PARSER_STATE_COLLECTION_ID: process.env.APPWRITE_PARSER_STATE_COLLECTION_ID ?? process.env.VITE_APPWRITE_PARSER_STATE_COLLECTION_ID
};
var parserEnv = schema.parse(normalizedEnv);

// src/core/etl-runner.ts
var MAX_TENDERS_TO_LOAD = 500;
function getRelevanceScore(item) {
  if (typeof item !== "object" || item === null) {
    return 0;
  }
  const candidate = item;
  return typeof candidate.relevanceScore === "number" ? candidate.relevanceScore : 0;
}
async function runEtlPipeline(args) {
  const allTenders = [];
  const streamedIds = /* @__PURE__ */ new Set();
  const log = (message) => {
    args.context.log?.(message);
  };
  const streamingContext = {
    ...args.context,
    onTenderExtracted: async (tender) => {
      if (streamedIds.has(tender.externalId)) {
        return;
      }
      await args.loader.upsertOne(tender);
      streamedIds.add(tender.externalId);
      log(
        `[etl] streamed upsert ${streamedIds.size}: ${tender.externalId} | ${tender.title.slice(0, 90)}`
      );
    }
  };
  log("[etl] pipeline started");
  for (const adapter of args.adapters) {
    log(`[etl] extracting with adapter ${adapter.sourceName}`);
    const tenders = await adapter.extract(streamingContext);
    allTenders.push(...tenders);
    log(`[etl] adapter ${adapter.sourceName} extracted ${tenders.length}`);
  }
  const unique = /* @__PURE__ */ new Map();
  for (const item of allTenders) {
    const existing = unique.get(item.externalId);
    if (!existing || getRelevanceScore(item) >= getRelevanceScore(existing)) {
      unique.set(item.externalId, item);
    }
  }
  const deduped = Array.from(unique.values()).sort((a, b) => getRelevanceScore(b) - getRelevanceScore(a)).slice(0, MAX_TENDERS_TO_LOAD);
  for (const tender of deduped) {
    if (streamedIds.has(tender.externalId)) {
      continue;
    }
    await args.loader.upsertOne(tender);
    streamedIds.add(tender.externalId);
  }
  await args.loader.cleanExpiredTenders(log);
  log(
    `[etl] pipeline finished: extracted=${allTenders.length}, deduped=${deduped.length}, loaded=${streamedIds.size}`
  );
  return {
    extracted: allTenders.length,
    loaded: streamedIds.size
  };
}

// src/loaders/parser-state-store.ts
var import_node_appwrite = require("node-appwrite");
var SESSION_KEY = "eis_human_session";
var LAST_ERROR_KEY = "eis_human_last_error";
var LAST_RUN_KEY = "parser_last_run";
var ParserStateStore = class {
  databases;
  databaseId;
  collectionId;
  constructor(config) {
    const client = new import_node_appwrite.Client().setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey);
    this.databases = new import_node_appwrite.Databases(client);
    this.databaseId = config.databaseId;
    this.collectionId = config.collectionId;
  }
  async loadCookies() {
    const payload = await this.getPayloadByKey(SESSION_KEY);
    if (!payload || !Array.isArray(payload.cookies)) {
      return [];
    }
    return payload.cookies.filter((item) => typeof item === "string");
  }
  async saveCookies(cookies) {
    await this.upsertByKey(SESSION_KEY, {
      cookies: Array.from(new Set(cookies)),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  async reportError(message) {
    await this.upsertByKey(LAST_ERROR_KEY, {
      message,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  async loadRunState() {
    const payload = await this.getPayloadByKey(LAST_RUN_KEY);
    if (!payload) {
      return null;
    }
    const state = {};
    if (typeof payload.startedAt === "string") {
      state.startedAt = payload.startedAt;
    }
    if (typeof payload.finishedAt === "string") {
      state.finishedAt = payload.finishedAt;
    }
    if (payload.status === "running" || payload.status === "success" || payload.status === "failed") {
      state.status = payload.status;
    }
    if (typeof payload.error === "string") {
      state.error = payload.error;
    }
    return state;
  }
  async saveRunState(state) {
    await this.upsertByKey(LAST_RUN_KEY, {
      ...state,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  async getPayloadByKey(key) {
    if (!this.collectionId) {
      return null;
    }
    try {
      const response = await this.databases.listDocuments(this.databaseId, this.collectionId, [
        import_node_appwrite.Query.equal("key", key),
        import_node_appwrite.Query.limit(1)
      ]);
      if (response.total === 0) {
        return null;
      }
      const raw = response.documents[0];
      if (typeof raw.payload !== "string") {
        return null;
      }
      const parsed = JSON.parse(raw.payload);
      if (typeof parsed !== "object" || parsed === null) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
  async upsertByKey(key, payload) {
    if (!this.collectionId) {
      return;
    }
    try {
      const existing = await this.databases.listDocuments(this.databaseId, this.collectionId, [
        import_node_appwrite.Query.equal("key", key),
        import_node_appwrite.Query.limit(1)
      ]);
      if (existing.total > 0) {
        await this.databases.updateDocument(
          this.databaseId,
          this.collectionId,
          existing.documents[0].$id,
          {
            key,
            payload: JSON.stringify(payload)
          }
        );
        return;
      }
      await this.databases.createDocument(this.databaseId, this.collectionId, import_node_appwrite.ID.unique(), {
        key,
        payload: JSON.stringify(payload)
      });
    } catch {
    }
  }
};

// src/adapters/eis/eis.extract.ts
var import_cheerio = require("cheerio");
var DAYS_BACK = 120;
var MIN_PRICE = 5e5;
var MAX_TENDERS = 500;
var MAX_STAGE1_CANDIDATES = 400;
var MAX_STAGE2_OUTPUT = 100;
var SEARCH_PAGES_PER_KEYWORD = 20;
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
var EIS_HOME_URL = "https://zakupki.gov.ru/";
var EIS_RESULTS_URL = "https://zakupki.gov.ru/epz/order/extendedsearch/results.html";
var SOFT_ROOF_INCLUDE = [
  "\u043A\u0440\u043E\u0432\u043B\u044F",
  "\u043C\u044F\u0433\u043A\u0430\u044F \u043A\u0440\u043E\u0432\u043B\u044F",
  "\u0431\u0438\u0442\u0443\u043C\u043D\u0430\u044F \u0447\u0435\u0440\u0435\u043F\u0438\u0446\u0430",
  "\u0433\u0438\u0431\u043A\u0430\u044F \u0447\u0435\u0440\u0435\u043F\u0438\u0446\u0430",
  "\u0440\u0443\u0431\u0435\u0440\u043E\u0438\u0434",
  "\u0441\u0442\u0435\u043A\u043B\u043E\u0438\u0437\u043E\u043B",
  "\u0431\u0438\u043A\u0440\u043E\u0441\u0442",
  "\u043C\u0435\u043C\u0431\u0440\u0430\u043D\u043D\u0430\u044F \u043A\u0440\u043E\u0432\u043B\u044F",
  "\u043F\u0432\u0445 \u043C\u0435\u043C\u0431\u0440\u0430\u043D\u0430",
  "\u043F\u043E\u043B\u0438\u043C\u0435\u0440\u043D\u0430\u044F \u043C\u0435\u043C\u0431\u0440\u0430\u043D\u0430",
  "\u043E\u043D\u0434\u0443\u043B\u0438\u043D",
  "\u0435\u0432\u0440\u043E\u0448\u0438\u0444\u0435\u0440",
  "\u043C\u0430\u0441\u0442\u0438\u0447\u043D\u0430\u044F \u043A\u0440\u043E\u0432\u043B\u044F",
  "\u0440\u0443\u043B\u043E\u043D\u043D\u0430\u044F \u043A\u0440\u043E\u0432\u043B\u044F"
];
var HARD_ROOF_EXCLUDE = [
  "\u043C\u0435\u0442\u0430\u043B\u043B\u043E\u0447\u0435\u0440\u0435\u043F\u0438\u0446\u0430",
  "\u043F\u0440\u043E\u0444\u043D\u0430\u0441\u0442\u0438\u043B",
  "\u043F\u0440\u043E\u0444\u043B\u0438\u0441\u0442",
  "\u0444\u0430\u043B\u044C\u0446\u0435\u0432\u0430\u044F \u043A\u0440\u043E\u0432\u043B\u044F",
  "\u043D\u0430\u0442\u0443\u0440\u0430\u043B\u044C\u043D\u0430\u044F \u0447\u0435\u0440\u0435\u043F\u0438\u0446\u0430",
  "\u043A\u0435\u0440\u0430\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0447\u0435\u0440\u0435\u043F\u0438\u0446\u0430",
  "\u0446\u0435\u043C\u0435\u043D\u0442\u043D\u043E-\u043F\u0435\u0441\u0447\u0430\u043D\u0430\u044F \u0447\u0435\u0440\u0435\u043F\u0438\u0446\u0430",
  "\u043A\u043B\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0448\u0438\u0444\u0435\u0440",
  "\u0430\u0441\u0431\u0435\u0441\u0442\u043E\u0446\u0435\u043C\u0435\u043D\u0442\u043D\u044B\u0439 \u0448\u0438\u0444\u0435\u0440",
  "\u043B\u0438\u0441\u0442\u043E\u0432\u0430\u044F \u043A\u0440\u043E\u0432\u043B\u044F"
];
var NON_B2B_CUSTOMERS = [
  "\u043C\u0431\u043E\u0443",
  "\u0433\u0431\u0443",
  "\u0433\u0431\u043E\u0443",
  "\u043C\u043A\u0443",
  "\u0434\u0435\u043F\u0430\u0440\u0442\u0430\u043C\u0435\u043D\u0442",
  "\u043C\u0438\u043D\u0438\u0441\u0442\u0435\u0440\u0441\u0442\u0432\u043E",
  "\u043A\u043E\u043C\u0438\u0442\u0435\u0442",
  "\u0448\u043A\u043E\u043B",
  "\u0431\u043E\u043B\u044C\u043D\u0438\u0446",
  "\u043F\u043E\u043B\u0438\u043A\u043B\u0438\u043D\u0438\u043A",
  "\u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F",
  "\u043C\u0443\u043D\u0438\u0446\u0438\u043F\u0430\u043B\u044C\u043D\u043E\u0435 \u0431\u044E\u0434\u0436\u0435\u0442\u043D\u043E\u0435 \u0443\u0447\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435",
  "\u0433\u043E\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0435 \u0431\u044E\u0434\u0436\u0435\u0442\u043D\u043E\u0435 \u0443\u0447\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435",
  "\u0442\u0441\u0436",
  "\u0442\u0441\u043D",
  "\u0436\u0441\u043A",
  "\u0436\u0438\u043B\u0438\u0449\u043D\u044B\u0439 \u043A\u043E\u043E\u043F\u0435\u0440\u0430\u0442\u0438\u0432",
  "\u0443\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0449\u0430\u044F \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u044F \u0436\u0438\u043B",
  "\u0444\u043E\u043D\u0434 \u043A\u0430\u043F\u0438\u0442\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0440\u0435\u043C\u043E\u043D\u0442\u0430",
  "\u0440\u0435\u0433\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440",
  "\u0434\u0435\u0442\u0441\u043A\u0438\u0439 \u0441\u0430\u0434",
  "\u0434\u0435\u0442\u0441\u043A\u0438\u0439 \u0434\u043E\u043C",
  "\u0434\u043E\u043C \u043A\u0443\u043B\u044C\u0442\u0443\u0440\u044B",
  "\u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0430",
  "\u043C\u0443\u0437\u0435\u0439",
  "\u0442\u0435\u0430\u0442\u0440",
  "\u0444\u0438\u043B\u0430\u0440\u043C\u043E\u043D\u0438\u044F",
  "\u0446\u0435\u043D\u0442\u0440 \u0441\u043E\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0433\u043E",
  "\u0443\u0447\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435 \u0441\u043E\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0433\u043E",
  "\u0434\u043E\u043C \u0441\u043E\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0433\u043E",
  "\u0441\u043E\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u044F",
  "\u043F\u0441\u0438\u0445\u043E\u043D\u0435\u0432\u0440\u043E\u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0439",
  "\u043D\u0430\u0440\u043A\u043E\u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0439",
  "\u0434\u043E\u043C \u043F\u0440\u0435\u0441\u0442\u0430\u0440\u0435\u043B\u044B\u0445",
  "\u0440\u0435\u0430\u0431\u0438\u043B\u0438\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0446\u0435\u043D\u0442\u0440",
  "\u0441\u0430\u043D\u0430\u0442\u043E\u0440\u0438\u0439",
  "\u0434\u0432\u043E\u0440\u0435\u0446 \u0441\u043F\u043E\u0440\u0442\u0430",
  "\u043B\u0435\u0434\u043E\u0432\u044B\u0439 \u0434\u0432\u043E\u0440\u0435\u0446",
  "\u0435\u043F\u0430\u0440\u0445\u0438\u044F",
  "\u043C\u043E\u043D\u0430\u0441\u0442\u044B\u0440\u044C",
  "\u043F\u0440\u0438\u0445\u043E\u0434",
  "\u0432\u043E\u0439\u0441\u043A\u043E\u0432\u0430\u044F \u0447\u0430\u0441\u0442\u044C",
  "\u0444\u0441\u0431",
  "\u043C\u0432\u0434",
  "\u043C\u0438\u043D\u043E\u0431\u043E\u0440\u043E\u043D\u044B",
  "\u0443\u0444\u0441\u0438\u043D",
  "\u0438\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u043A\u043E\u043B\u043E\u043D\u0438\u044F",
  "\u0442\u0435\u0445\u043D\u0438\u043A\u0443\u043C",
  "\u043A\u043E\u043B\u043B\u0435\u0434\u0436",
  "\u043B\u0438\u0446\u0435\u0439",
  "\u0443\u043D\u0438\u0432\u0435\u0440\u0441\u0438\u0442\u0435\u0442",
  "\u0430\u043A\u0430\u0434\u0435\u043C\u0438\u044F",
  "\u043E\u0431\u0449\u0435\u0436\u0438\u0442\u0438\u0435"
];
var MOSCOW_AGGLOMERATION = [
  "\u043C\u043E\u0441\u043A\u0432\u0430",
  "\u0437\u0435\u043B\u0435\u043D\u043E\u0433\u0440\u0430\u0434",
  "\u0442\u0440\u043E\u0438\u0446\u043A",
  "\u0445\u0438\u043C\u043A\u0438",
  "\u0431\u0430\u043B\u0430\u0448\u0438\u0445\u0430",
  "\u043F\u043E\u0434\u043E\u043B\u044C\u0441\u043A",
  "\u043C\u044B\u0442\u0438\u0449\u0438",
  "\u043A\u043E\u0440\u043E\u043B\u0435\u0432",
  "\u043B\u044E\u0431\u0435\u0440\u0446\u044B",
  "\u043A\u0440\u0430\u0441\u043D\u043E\u0433\u043E\u0440\u0441\u043A",
  "\u044D\u043B\u0435\u043A\u0442\u0440\u043E\u0441\u0442\u0430\u043B\u044C",
  "\u043E\u0434\u0438\u043D\u0446\u043E\u0432\u043E",
  "\u0434\u043E\u043C\u043E\u0434\u0435\u0434\u043E\u0432\u043E",
  "\u0449\u0435\u043B\u043A\u043E\u0432\u043E",
  "\u0441\u0435\u0440\u043F\u0443\u0445\u043E\u0432",
  "\u0440\u0430\u043C\u0435\u043D\u0441\u043A\u043E\u0435",
  "\u0434\u043E\u043B\u0433\u043E\u043F\u0440\u0443\u0434\u043D\u044B\u0439",
  "\u0440\u0435\u0443\u0442\u043E\u0432",
  "\u043F\u0443\u0448\u043A\u0438\u043D\u043E",
  "\u0436\u0443\u043A\u043E\u0432\u0441\u043A\u0438\u0439",
  "\u0442\u0432\u0435\u0440\u044C"
];
var MOSCOW_MARKERS = [
  "\u043C\u043E\u0441\u043A\u0432",
  "\u043C\u043E\u0441\u043A\u043E\u0432\u0441\u043A",
  ...MOSCOW_AGGLOMERATION
];
var POSITIVE_REGION_MARKERS = [
  "\u043C\u043E\u0441\u043A\u043E\u0432\u0441\u043A\u0430\u044F \u043E\u0431\u043B",
  "\u043C\u043E,",
  ", \u043C\u043E ",
  "\u043F\u043E\u0434\u043C\u043E\u0441\u043A\u043E\u0432\u044C\u0435",
  "\u0442\u0432\u0435\u0440\u0441\u043A\u0430\u044F \u043E\u0431\u043B",
  "\u0442\u0432\u0435\u0440\u0441\u043A\u043E\u0439 \u043E\u0431\u043B",
  "\u0433. \u0442\u0432\u0435\u0440\u044C",
  "\u0433.\u0442\u0432\u0435\u0440\u044C",
  "\u043D\u043E\u0432\u043E\u043C\u043E\u0441\u043A\u043E\u0432\u0441\u043A\u0438\u0439",
  "\u0442\u0440\u043E\u0438\u0446\u043A\u0438\u0439",
  "\u043D\u043E\u0432\u0430\u044F \u043C\u043E\u0441\u043A\u0432\u0430",
  "\u043B\u044E\u0431\u0435\u0440\u0435\u0446\u043A\u0438\u0439",
  "\u043C\u044B\u0442\u0438\u0449\u0438\u043D\u0441\u043A\u0438\u0439",
  "\u043A\u0440\u0430\u0441\u043D\u043E\u0433\u043E\u0440\u0441\u043A\u0438\u0439",
  "\u043E\u0434\u0438\u043D\u0446\u043E\u0432\u0441\u043A\u0438\u0439",
  "\u043B\u0435\u043D\u0438\u043D\u0441\u043A\u0438\u0439",
  "\u0449\u0435\u043B\u043A\u043E\u0432\u0441\u043A\u0438\u0439",
  "\u0449\u0451\u043B\u043A\u043E\u0432\u0441\u043A\u0438\u0439",
  "\u0434\u043C\u0438\u0442\u0440\u043E\u0432\u0441\u043A\u0438\u0439",
  "\u0441\u043E\u043B\u043D\u0435\u0447\u043D\u043E\u0433\u043E\u0440\u0441\u043A\u0438\u0439",
  "\u0438\u0441\u0442\u0440\u0438\u043D\u0441\u043A\u0438\u0439",
  "\u043A\u043E\u043B\u043E\u043C\u043D\u0430",
  "\u0441\u0435\u0440\u043F\u0443\u0445\u043E\u0432",
  "\u043D\u043E\u0433\u0438\u043D\u0441\u043A",
  "\u0444\u0440\u044F\u0437\u0435\u0432\u043E",
  "\u0437\u0435\u043B\u0435\u043D\u043E\u0433\u0440\u0430\u0434"
];
var TARGET_INN_PREFIXES = ["77", "50", "69"];
var STAGE2_INN_WHITELIST_PREFIXES = ["77", "97", "99", "50", "90", "69"];
var NON_TARGET_INN_PREFIXES_HARD = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
  "60",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
  "68",
  "70",
  "71",
  "72",
  "73",
  "74",
  "75",
  "76",
  "79",
  "83",
  "86",
  "87",
  "89",
  "91",
  "92",
  "93",
  "94",
  "95",
  "96",
  "97",
  "98",
  "99"
];
var CITY_REGEX = /(?:г|город)[.\s]+([а-яё][а-яё\s-]{2,})/gi;
var AREA_REGEX = /(\d{1,6}(?:[\s.,]\d{1,2})?)\s*(?:м2|м²|кв\.?\s*м|м\.?\s*кв\.?)/i;
var stateStore = new ParserStateStore({
  endpoint: parserEnv.APPWRITE_ENDPOINT,
  projectId: parserEnv.APPWRITE_PROJECT_ID,
  apiKey: parserEnv.PARSER_APPWRITE_API_KEY,
  databaseId: parserEnv.APPWRITE_DATABASE_ID,
  collectionId: parserEnv.APPWRITE_PARSER_STATE_COLLECTION_ID
});
function normalize(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}
function htmlToText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;|&#xA0;/gi, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}
function stripTags(html) {
  return normalize(htmlToText(html));
}
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
async function humanPause() {
  const min = parserEnv.EIS_HUMAN_MIN_STEP_DELAY_MS;
  const max = parserEnv.EIS_HUMAN_MAX_STEP_DELAY_MS;
  await sleep(randomInt(min, max));
}
function parseSetCookie(raw) {
  const head = raw.split(";")[0]?.trim();
  if (!head || !head.includes("=")) {
    return null;
  }
  const [name, ...rest] = head.split("=");
  return {
    name: name.trim(),
    value: rest.join("=").trim()
  };
}
function serializeCookieJar(jar) {
  return Array.from(jar.entries()).map(([name, value]) => `${name}=${value}`).join("; ");
}
function extractSetCookies(headers) {
  const withGetSetCookie = headers;
  if (typeof withGetSetCookie.getSetCookie === "function") {
    return withGetSetCookie.getSetCookie();
  }
  const combined = headers.get("set-cookie");
  if (!combined) {
    return [];
  }
  return combined.split(/,(?=[^;]+=[^;]+)/g).map((item) => item.trim()).filter(Boolean);
}
function mergeCookies(session, setCookies) {
  for (const raw of setCookies) {
    const cookie = parseSetCookie(raw);
    if (!cookie) {
      continue;
    }
    session.cookieJar.set(cookie.name, cookie.value);
  }
}
function parsePersistedCookies(rows) {
  const jar = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const parsed = parseSetCookie(row);
    if (parsed) {
      jar.set(parsed.name, parsed.value);
    }
  }
  return jar;
}
async function loadSession() {
  const persisted = await stateStore.loadCookies();
  return {
    cookieJar: parsePersistedCookies(persisted)
  };
}
async function saveSession(session) {
  const serialized = Array.from(session.cookieJar.entries()).map(
    ([name, value]) => `${name}=${value}`
  );
  await stateStore.saveCookies(serialized);
}
async function humanFetch(session, url, referer) {
  await humanPause();
  const headers = new Headers({
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Connection: "keep-alive",
    Referer: referer ?? EIS_HOME_URL
  });
  const cookieHeader = serializeCookieJar(session.cookieJar);
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }
  const response = await fetch(url, {
    method: "GET",
    headers
  });
  mergeCookies(session, extractSetCookies(response.headers));
  if (!response.ok) {
    throw new Error(`[human] HTTP ${response.status} for ${url}`);
  }
  return response.text();
}
function parseDateFromText(input) {
  const match = input.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  const parsed = parseRuDate(`${match[1]}.${match[2]}.${match[3]}`);
  return parsed ? parsed.toISOString() : (/* @__PURE__ */ new Date()).toISOString();
}
function extractDeadlineFromBlock(block) {
  const $ = (0, import_cheerio.load)(block);
  const fullText = normalizeWhitespace($.root().text());
  const deadlineMatch = fullText.match(/Окончание\s+подачи\s+заяв(?:ок|ки)[\s\S]*?(\d{2}\.\d{2}\.\d{4})/i);
  if (!deadlineMatch?.[1]) {
    return "";
  }
  return parseDateFromText(deadlineMatch[1]);
}
function normalizeCyrillic(value) {
  return normalize(value).replace(/ё/g, "\u0435");
}
function normalizeWhitespace(value) {
  return value.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}
function parseRuDate(dateStr) {
  const [day, month, year] = dateStr.split(".");
  if (!day || !month || !year) {
    return null;
  }
  const candidate = /* @__PURE__ */ new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}
function findPriceLikeText(candidates) {
  let fallback = "";
  for (const candidate of candidates.map((c) => normalizeWhitespace(c)).filter(Boolean)) {
    if (!fallback && /\d/.test(candidate)) {
      fallback = candidate;
    }
    if (cleanAndParsePrice(candidate) > 0) {
      return candidate;
    }
  }
  return fallback;
}
function extractRawPriceFragment(input) {
  const $ = (0, import_cheerio.load)(input);
  const formScope = $(".registry-entry__form").first();
  const scope = formScope.length ? formScope : $("body");
  const byPriceBlockClass = scope.find(".price-block__value").map((_i, el) => $(el).text()).get();
  const byPriceBlockResult = findPriceLikeText(byPriceBlockClass);
  if (byPriceBlockResult) {
    return byPriceBlockResult;
  }
  const byLabelAndNext = [];
  scope.find("div, span, p, dt, dd").each((_i, el) => {
    const label = normalizeWhitespace($(el).text());
    if (!/(начальная|нмцк)/i.test(label)) {
      return;
    }
    const nextValue = normalizeWhitespace($(el).nextAll("div, span, p, dd").first().text());
    if (nextValue) {
      byLabelAndNext.push(nextValue);
    }
    const parentValues = $(el).parent().find("div, span, p, dd").map((_j, node) => normalizeWhitespace($(node).text())).get().filter((value) => /\d/.test(value));
    byLabelAndNext.push(...parentValues);
  });
  const byLabelResult = findPriceLikeText(byLabelAndNext);
  if (byLabelResult) {
    return byLabelResult;
  }
  const byRubAny = scope.find("div, span, p, strong, b").map((_i, el) => normalizeWhitespace($(el).text())).get().filter((value) => /(₽|руб)/i.test(value) && /\d/.test(value));
  const byRubResult = findPriceLikeText(byRubAny);
  if (byRubResult) {
    return byRubResult;
  }
  const blockText = normalizeWhitespace(scope.text());
  const ultimateMatchFromText = blockText.match(
    /([\d\s\u00A0&nbsp;]{3,},\d{2})\s*(?:₽|руб|Российский рубль)/i
  );
  if (ultimateMatchFromText?.[0]) {
    return ultimateMatchFromText[0];
  }
  const blockTextWithEntities = normalizeWhitespace(input.replace(/<[^>]+>/g, " "));
  const ultimateMatchFromRaw = blockTextWithEntities.match(
    /([\d\s\u00A0&nbsp;]{3,},\d{2})\s*(?:₽|руб|Российский рубль)/i
  );
  if (ultimateMatchFromRaw?.[0]) {
    return ultimateMatchFromRaw[0];
  }
  const fullText = htmlToText(input);
  const fallbackRegex = [
    /(?:НМЦК|Начальная\s+цена\s*договора|Начальная\s+цена|Цена)[:\s]*([\d\s\u00A0.,]+\s*(?:₽|руб\.?|рублей|российский\s+рубль)?)/i,
    /([\d\s\u00A0.,]+\s*(?:₽|руб\.?|рублей|российский\s+рубль))/i
  ];
  const fallbackCandidates = fallbackRegex.map((pattern) => fullText.match(pattern)?.[1] ?? "").filter(Boolean);
  return findPriceLikeText(fallbackCandidates);
}
function cleanAndParsePrice(raw) {
  if (!raw) {
    return 0;
  }
  const normalized = raw.replace(/&nbsp;|&#160;|&#xA0;/gi, " ").replace(/\u00A0/g, " ").replace(/\s+/g, "").replace(/российскийрубль|российскийруб\.?|рублей|рубля|руб\.?|₽/gi, "").replace(/,/g, ".").replace(/[^0-9.]/g, "");
  if (!normalized) {
    return 0;
  }
  const dotCount = (normalized.match(/\./g) ?? []).length;
  const canonical = dotCount <= 1 ? normalized : `${normalized.slice(0, normalized.lastIndexOf(".")).replace(/\./g, "")}.${normalized.slice(normalized.lastIndexOf(".") + 1).replace(/\./g, "")}`;
  const parsed = Number(canonical);
  return Number.isFinite(parsed) ? parsed : 0;
}
function parseRegNumberFromHref(href) {
  const direct = href.match(/regNumber=(\d{8,})/i);
  if (direct) {
    return direct[1];
  }
  const fallback = href.match(/(\d{8,})/);
  return fallback ? fallback[1] : "";
}
function toAbsoluteEisUrl(href) {
  const value = href.trim();
  if (!value) {
    return "";
  }
  try {
    return new URL(value, EIS_HOME_URL).toString();
  } catch {
    return "";
  }
}
function extractBlocks(html) {
  const $ = (0, import_cheerio.load)(html);
  const cardSet = /* @__PURE__ */ new Set();
  $(".search-registry-entry-block").each((_i, el) => {
    const card = $.html(el);
    if (card?.trim()) {
      cardSet.add(card);
    }
  });
  $(".row.registry-entry__form").each((_i, el) => {
    const row = $(el);
    const container = row.closest(".search-registry-entry-block");
    const card = container.length ? $.html(container) : $.html(row);
    if (card?.trim()) {
      cardSet.add(card);
    }
  });
  if (cardSet.size > 0) {
    return Array.from(cardSet);
  }
  const fallback = html.match(/<article[\s\S]*?<\/article>/gi);
  return fallback ?? [];
}
function extractCustomerFromBlock(block) {
  const candidates = [
    /(?:Заказчик|Организация)[\s\S]{0,120}?(?:<[^>]+>){0,3}([\s\S]{3,220}?)(?:<\/|НМЦК|Цена|Регион|Субъект|ИНН)/i,
    /registry-entry__body-value[^>]*>([\s\S]{3,220}?)<\/div>/i,
    /(?:Наименование\s*заказчика|Заказчик)[\s\S]{0,120}?(?:<[^>]+>){0,3}([\s\S]{3,220}?)(?:<\/|ИНН|КПП|ОГРН)/i
  ];
  for (const pattern of candidates) {
    const match = block.match(pattern)?.[1];
    const value = stripTags(match ?? "");
    if (value) {
      return value;
    }
  }
  return "";
}
function buildSearchUrl(keyword, page, regionCodes) {
  const params = new URLSearchParams();
  params.set("searchString", keyword);
  params.set("morphology", "on");
  params.set("recordsPerPage", "_10");
  params.set("pageNumber", String(page));
  params.set("sortDirection", "false");
  params.set("fz223", "on");
  for (const region of regionCodes.map((code) => code.trim()).filter(Boolean)) {
    params.append("regions", region);
  }
  return `${EIS_RESULTS_URL}?${params.toString()}`;
}
function extractExternalIdFast(block) {
  const regNumber = block.match(/regNumber=(\d{8,})/i)?.[1];
  if (regNumber) {
    return regNumber;
  }
  return block.match(/\b\d{11,19}\b/)?.[0] ?? "";
}
function buildSurfaceTenderFromBlock(block) {
  const $ = (0, import_cheerio.load)(block);
  const hrefCandidates = $("a[href]").map((_i, el) => String($(el).attr("href") || "").trim()).get().filter(Boolean);
  const preferredHref = hrefCandidates.find((href) => /notice223\/common-info\.html/i.test(href)) || hrefCandidates.find((href) => /regNumber=\d{8,}/i.test(href)) || hrefCandidates[0] || "";
  const externalId = parseRegNumberFromHref(preferredHref) || hrefCandidates.map((href) => parseRegNumberFromHref(href)).find(Boolean) || block.match(/\b\d{11,19}\b/)?.[0] || "";
  const sourceUrlRaw = toAbsoluteEisUrl(preferredHref);
  const titleRaw = block.match(/registry-entry__header-mid__title[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? block.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "";
  const bodyPreview = stripTags(block);
  const fallbackTitle = bodyPreview.replace(/\s+/g, " ").trim().slice(0, 140);
  const title = stripTags(titleRaw) || fallbackTitle;
  if (!externalId || !title) {
    return {
      tender: null,
      rejectReason: "missing-core-fields"
    };
  }
  const rawPriceFromHtml = extractRawPriceFragment(block);
  const body = bodyPreview;
  const price = cleanAndParsePrice(rawPriceFromHtml || body);
  const published = parseDateFromText(body);
  const deadline = extractDeadlineFromBlock(block);
  const customer = extractCustomerFromBlock(block);
  const inn = body.match(/\b\d{10}\b/)?.[0] ?? "";
  const description = `${body} ${extractAreaTag(`${title} ${body}`)}`.trim();
  return {
    tender: {
      externalId: externalId.trim(),
      title: title.trim(),
      description: description.trim(),
      regionCode: body.includes("\u043C\u043E\u0441\u043A\u043E\u0432\u0441\u043A") ? "50" : "77",
      customer: customer.trim(),
      inn: inn.trim(),
      price: Number.isFinite(price) ? price : 0,
      published,
      deadline,
      source: "\u0415\u0418\u0421 223-\u0424\u0417",
      sourceUrl: sourceUrlRaw.trim(),
      relevanceScore: 0
    }
  };
}
function countSoftRoofHitsInTitle(title) {
  const normalizedTitle = normalize(title);
  return SOFT_ROOF_INCLUDE.filter((keyword) => normalizedTitle.includes(normalize(keyword))).length;
}
function calculateStage1ProxyScore(tender) {
  const includeHits = countSoftRoofHitsInTitle(tender.title);
  const priceBonus = Math.min(12, Math.max(0, Math.floor(tender.price / 5e5)));
  return includeHits * 10 + priceBonus;
}
function extractAddressField(fullText, labelPattern) {
  const match = fullText.match(labelPattern);
  return normalizeWhitespace(match?.[1] ?? "");
}
function extractInnFromText(fullText) {
  const innWithContext = /(?:^|[^0-9A-Za-zА-Яа-яЁё])ИНН[^0-9]{0,40}([0-9][0-9\s]{8,20})/gi;
  const candidates = Array.from(fullText.matchAll(innWithContext)).map((match) => match[1]).map((value) => value.replace(/\D/g, "")).filter((value) => value.length === 10 || value.length === 12);
  if (candidates.length > 0) {
    return candidates[0];
  }
  const directMatch = fullText.match(/ИНН\s*[:№]?\s*(\d{10}|\d{12})/i)?.[1];
  return directMatch ?? "";
}
function extractFieldFromHtml(html, labelPattern) {
  const $ = (0, import_cheerio.load)(html);
  const elements = $("td, th, div, span, p");
  for (const element of elements.toArray()) {
    const rawText = normalizeWhitespace($(element).text());
    if (!rawText) {
      continue;
    }
    if (labelPattern.test(rawText)) {
      const withoutLabel = normalizeWhitespace(rawText.replace(labelPattern, "").replace(/^[:\-]\s*/, ""));
      if (withoutLabel.length >= 6) {
        return withoutLabel;
      }
      const siblingText = normalizeWhitespace($(element).next().text());
      if (siblingText.length >= 6) {
        return siblingText;
      }
      const parentNext = normalizeWhitespace($(element).parent().next().text());
      if (parentNext.length >= 6) {
        return parentNext;
      }
    }
  }
  return "";
}
function truncateLogValue(value, maxLength = 180) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\u2026`;
}
function extractInnDebugSnippet(fullText) {
  const match = fullText.match(/.{0,80}ИНН.{0,80}/i);
  return truncateLogValue(normalizeWhitespace(match?.[0] ?? ""), 180);
}
function parseStage2PageData(html) {
  const fullText = normalizeWhitespace(htmlToText(html));
  const inn = extractInnFromText(fullText);
  const kpp = fullText.match(/\bКПП\s*[:]?\s*(\d{9})\b/i)?.[1] ?? "";
  const legalAddress = extractAddressField(
    fullText,
    /(?:место\s+нахождения|юридичес(?:кий|кого)\s+адрес)\s*[:\-]?\s*([\s\S]{0,260}?)(?=(?:почтов(?:ый|ого)\s+адрес|место\s+поставки|место\s+выполнения\s+работ|место\s+оказания\s+услуг|адрес\s+объекта|инн|кпп|огрн|телефон|e-?mail|$))/i
  );
  const postalAddress = extractAddressField(
    fullText,
    /(?:почтов(?:ый|ого)\s+адрес|адрес\s+для\s+корреспонденции)\s*[:\-]?\s*([\s\S]{0,260}?)(?=(?:место\s+нахождения|место\s+поставки|место\s+выполнения\s+работ|место\s+оказания\s+услуг|адрес\s+объекта|инн|кпп|огрн|телефон|e-?mail|$))/i
  );
  const deliveryLabelPattern = /(?:адрес\s+места\s+поставки|место\s+поставки(?:\s+товар(?:ов|а))?(?:\s*\([^)]*\))?(?:\s*,\s*выполнения\s+работ)?(?:\s*,\s*оказания\s+услуг)?|место\s+выполнения\s+работ(?:\s*\([^)]*\))?(?:\s*,\s*оказания\s+услуг)?|место\s+оказания\s+услуг|адрес\s+объекта)/i;
  let deliveryPlace = extractAddressField(
    fullText,
    new RegExp(
      `${deliveryLabelPattern.source}\\s*[:\\-]?\\s*([\\s\\S]{0,320}?)(?=(?:\u043C\u0435\u0441\u0442\u043E\\s+\u043D\u0430\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F|\u044E\u0440\u0438\u0434\u0438\u0447\u0435\u0441(?:\u043A\u0438\u0439|\u043A\u043E\u0433\u043E)\\s+\u0430\u0434\u0440\u0435\u0441|\u043F\u043E\u0447\u0442\u043E\u0432(?:\u044B\u0439|\u043E\u0433\u043E)\\s+\u0430\u0434\u0440\u0435\u0441|\u0438\u043D\u043D|\u043A\u043F\u043F|\u043E\u0433\u0440\u043D|\u0442\u0435\u043B\u0435\u0444\u043E\u043D|e-?mail|$))`,
      "i"
    )
  );
  if (!deliveryPlace) {
    deliveryPlace = extractFieldFromHtml(html, deliveryLabelPattern);
  }
  const addressContext = normalizeWhitespace(
    `${legalAddress} ${postalAddress} ${deliveryPlace}`
  );
  const zipCodes = Array.from(addressContext.matchAll(/\b(\d{6})\b/g)).map((match) => match[1]);
  const validZipCodes = Array.from(
    new Set(zipCodes.filter((zip) => /^[1-9]\d{5}$/.test(zip)))
  );
  const deliveryZipCodes = Array.from(
    new Set(
      Array.from(deliveryPlace.matchAll(/\b(\d{6})\b/g)).map((match) => match[1])
    )
  ).filter((zip) => /^[1-9]\d{5}$/.test(zip));
  const placeLine = fullText.match(/[Мм]есто\s+(?:нахождения|выполнения|рассмотрения)[^\n]{0,300}/)?.[0] ?? "";
  return {
    fullText,
    inn,
    kpp,
    legalAddress,
    postalAddress,
    deliveryPlace,
    addressContext,
    zipCodes,
    validZipCodes,
    deliveryZipCodes,
    placeLine
  };
}
function hasTargetZipPrefix(zipCodes) {
  return zipCodes.some((zip) => /^(10|11|12|14|17)/.test(zip));
}
function hasForeignZipPrefix(zipCodes) {
  return zipCodes.some((zip) => !/^(10|11|12|14|17)/.test(zip));
}
function isStage2Residential(text) {
  return [" \u043C\u043A\u0434", "\u043C\u043D\u043E\u0433\u043E\u043A\u0432\u0430\u0440\u0442\u0438\u0440\u043D", "\u0436\u0438\u043B\u043E\u0439 \u0434\u043E\u043C", "\u0436\u0438\u043B\u043A\u043E\u043C\u0441\u0435\u0440\u0432\u0438\u0441"].some(
    (marker) => normalize(text).includes(normalize(marker))
  );
}
function buildEnrichedTender(base, pageText, realInn, placeLine) {
  const enrichedEntry = {
    externalId: base.externalId,
    sourceUrlRaw: base.sourceUrl,
    title: base.title,
    description: `${base.description} ${placeLine}`.trim(),
    regionCode: base.regionCode,
    customer: base.customer,
    inn: realInn || base.inn,
    priceRaw: String(base.price),
    publishedRaw: base.published,
    deadlineRaw: base.deadline,
    lawRaw: pageText,
    regionText: pageText
  };
  const areaTag = extractAreaTag(`${enrichedEntry.title} ${enrichedEntry.description}`);
  const description = `${enrichedEntry.description.trim()}${areaTag}`.trim();
  return {
    ...base,
    description,
    inn: (realInn || base.inn).trim(),
    relevanceScore: calculateRelevance(enrichedEntry, base.price, areaTag)
  };
}
async function browseResultsHumanLike(args) {
  const session = await loadSession();
  const stage1Candidates = [];
  const stage2Enriched = [];
  const processedIds = /* @__PURE__ */ new Set();
  const emittedIds = /* @__PURE__ */ new Set();
  const stage1Stats = {
    scannedBlocks: 0,
    rejectedByReason: {}
  };
  const log = (message) => {
    args.log?.(message);
  };
  const sessionStart = Date.now();
  const minDuration = parserEnv.EIS_HUMAN_SESSION_MIN_SECONDS * 1e3;
  const maxDuration = parserEnv.EIS_HUMAN_SESSION_MAX_SECONDS * 1e3;
  const targetDuration = randomInt(minDuration, maxDuration);
  log(
    `[stage-1] session started; target duration ${Math.round(targetDuration / 1e3)} sec, keywords=${args.keywords.join(", ")}`
  );
  try {
    log("[stage-1] open homepage");
    await humanFetch(session, EIS_HOME_URL);
    for (const keyword of args.keywords) {
      let stopAfterKeyword = false;
      log(`[stage-1] keyword pass: ${keyword}`);
      for (let page = 1; page <= SEARCH_PAGES_PER_KEYWORD; page += 1) {
        const url = buildSearchUrl(keyword, page, args.regionCodes);
        log(`[stage-1] fetch page ${page}: ${url}`);
        const html = await humanFetch(session, url, EIS_HOME_URL);
        const blocks = extractBlocks(html);
        stage1Stats.scannedBlocks += blocks.length;
        log(`[stage-1] found blocks on page ${page}: ${blocks.length}`);
        if (blocks.length === 0) {
          log(`[stage-1] 0 blocks found on page ${page}. Exiting pagination for this keyword.`);
          break;
        }
        for (const block of blocks) {
          const quickExternalId = extractExternalIdFast(block);
          if (quickExternalId) {
            if (processedIds.has(quickExternalId)) {
              continue;
            }
            processedIds.add(quickExternalId);
          }
          const parsed = buildSurfaceTenderFromBlock(block);
          const tender = parsed.tender;
          if (!tender) {
            const reason = parsed.rejectReason ?? "unknown-stage1";
            stage1Stats.rejectedByReason[reason] = (stage1Stats.rejectedByReason[reason] ?? 0) + 1;
            continue;
          }
          let rejectReason = null;
          if (!tender.externalId || !tender.title) {
            rejectReason = "missing-core-fields";
          } else if (tender.price < MIN_PRICE) {
            rejectReason = "price-below-threshold";
            log(`[stage-1] reject price-below-threshold: ${tender.externalId} | price=${tender.price}`);
          } else if (isExpiredDate(tender.deadline)) {
            rejectReason = "expired";
          } else if (!isRecentDate(tender.published, args.fromDate, args.toDate)) {
            rejectReason = "published-out-of-range";
          } else if (containsAny(`${tender.title} ${tender.description}`, NON_B2B_CUSTOMERS)) {
            rejectReason = "non-b2b-customer";
          } else if (containsAny(`${tender.title} ${tender.description}`, HARD_ROOF_EXCLUDE)) {
            rejectReason = "hard-roof-excluded";
          }
          if (rejectReason) {
            stage1Stats.rejectedByReason[rejectReason] = (stage1Stats.rejectedByReason[rejectReason] ?? 0) + 1;
            continue;
          }
          stage1Candidates.push(tender);
          log(`[stage-1] pass: ${tender.externalId} | price=${Math.round(tender.price)}`);
          if (stage1Candidates.length >= MAX_STAGE1_CANDIDATES) {
            log("[stage-1] stop by MAX_STAGE1_CANDIDATES limit");
            stopAfterKeyword = true;
            break;
          }
        }
        if (stage1Candidates.length >= MAX_STAGE1_CANDIDATES) {
          stopAfterKeyword = true;
          break;
        }
        if (Date.now() - sessionStart >= targetDuration) {
          log("[stage-1] stop by target session duration");
          stopAfterKeyword = true;
          break;
        }
      }
      if (stopAfterKeyword || stage1Candidates.length >= MAX_STAGE1_CANDIDATES || Date.now() - sessionStart >= targetDuration) {
        break;
      }
    }
    const stage1Deduped = Array.from(
      stage1Candidates.reduce((acc, tender) => {
        const current = acc.get(tender.externalId);
        const candidateProxy = calculateStage1ProxyScore(tender);
        const currentProxy = current ? calculateStage1ProxyScore(current) : -1;
        if (!current || candidateProxy >= currentProxy) {
          acc.set(tender.externalId, {
            ...tender,
            relevanceScore: candidateProxy
          });
        }
        return acc;
      }, /* @__PURE__ */ new Map()).values()
    ).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, MAX_STAGE1_CANDIDATES);
    log(
      `[stage-1] done: scannedBlocks=${stage1Stats.scannedBlocks}, passed=${stage1Deduped.length}, rejected=${JSON.stringify(stage1Stats.rejectedByReason)}`
    );
    const stage2Stats = {
      passed: 0,
      rejectedByReason: {}
    };
    let consecutiveFetchErrors = 0;
    for (const candidate of stage1Deduped) {
      if (stage2Enriched.length >= MAX_STAGE2_OUTPUT) {
        break;
      }
      if (Date.now() - sessionStart >= targetDuration) {
        log("[stage-2] stop by target session duration");
        break;
      }
      try {
        await humanPause();
        const pageHtml = await humanFetch(session, candidate.sourceUrl, EIS_RESULTS_URL);
        const pageData = parseStage2PageData(pageHtml);
        if (!pageData.inn) {
          const innSnippet = extractInnDebugSnippet(pageData.fullText);
          log(
            `[stage-2] inn-diagnostics: ${candidate.externalId} | inn-empty | snippet=${JSON.stringify(innSnippet)}`
          );
        }
        const innPrefix = pageData.inn.slice(0, 2);
        const hasBadInnPrefix = Boolean(innPrefix) && NON_TARGET_INN_PREFIXES_HARD.includes(innPrefix) && !STAGE2_INN_WHITELIST_PREFIXES.includes(innPrefix);
        if (pageData.inn && hasBadInnPrefix) {
          log(`[stage-2] reject stage2-bad-inn: ${candidate.externalId} | inn=${pageData.inn} | prefix=${innPrefix}`);
          stage2Stats.rejectedByReason["stage2-bad-inn"] = (stage2Stats.rejectedByReason["stage2-bad-inn"] ?? 0) + 1;
          continue;
        }
        const hasTargetDeliveryZip = pageData.deliveryZipCodes.length > 0 && hasTargetZipPrefix(pageData.deliveryZipCodes);
        if (pageData.deliveryPlace || pageData.deliveryZipCodes.length > 0 || pageData.validZipCodes.length > 0) {
          const deliverySnippet = truncateLogValue(pageData.deliveryPlace, 180);
          log(
            `[stage-2] address-diagnostics: ${candidate.externalId} | delivery=${JSON.stringify(deliverySnippet)} | delivery_zips=${JSON.stringify(pageData.deliveryZipCodes)} | all_zips=${JSON.stringify(pageData.validZipCodes)} | delivery_target=${hasTargetDeliveryZip}`
          );
        }
        if (!hasTargetDeliveryZip && pageData.validZipCodes.length > 0 && hasForeignZipPrefix(pageData.validZipCodes) && !hasTargetZipPrefix(pageData.validZipCodes)) {
          log(
            `[stage-2] reject stage2-bad-zip: ${candidate.externalId} | found_zips=${JSON.stringify(pageData.validZipCodes)}`
          );
          stage2Stats.rejectedByReason["stage2-bad-zip"] = (stage2Stats.rejectedByReason["stage2-bad-zip"] ?? 0) + 1;
          continue;
        }
        const residentialScope = `${candidate.title} ${candidate.description} ${pageData.fullText}`;
        if (isStage2Residential(residentialScope)) {
          log(`[stage-2] reject stage2-residential: ${candidate.externalId}`);
          stage2Stats.rejectedByReason["stage2-residential"] = (stage2Stats.rejectedByReason["stage2-residential"] ?? 0) + 1;
          continue;
        }
        const enriched = buildEnrichedTender(candidate, pageData.fullText, pageData.inn, pageData.placeLine);
        stage2Enriched.push(enriched);
        stage2Stats.passed += 1;
        if (!emittedIds.has(enriched.externalId)) {
          emittedIds.add(enriched.externalId);
          if (args.onTender) {
            await args.onTender(enriched);
          }
        }
        consecutiveFetchErrors = 0;
        log(`[stage-2] pass: ${enriched.externalId} | inn=${pageData.inn || enriched.inn} | score=${enriched.relevanceScore}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        consecutiveFetchErrors += 1;
        log(`[stage-2] fetch-error: ${candidate.externalId} | ${message}`);
        if (consecutiveFetchErrors >= 3) {
          log("[stage-2] stop by 3 consecutive fetch errors");
          break;
        }
      }
    }
    log(
      `[etl] Stage 2 summary: passed=${stage2Stats.passed}, rejected=${JSON.stringify(stage2Stats.rejectedByReason)}`
    );
    log(
      `[etl] Pipeline summary: scannedBlocks=${stage1Stats.scannedBlocks}, passedStage1=${stage1Deduped.length}, passedStage2=${stage2Enriched.length}. Loaded to DB: ${stage2Enriched.length}.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await stateStore.reportError(message);
    log(`[stage-1] error: ${message}`);
    throw error;
  } finally {
    await saveSession(session);
    log("[stage-1] session cookies saved");
  }
  const unique = new Map(stage2Enriched.map((item) => [item.externalId, item]));
  const deduped = Array.from(unique.values()).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, MAX_STAGE2_OUTPUT);
  return deduped;
}
function containsAny(text, keywords) {
  const value = normalize(text);
  return keywords.some((keyword) => value.includes(normalize(keyword)));
}
function extractAreaTag(text) {
  const match = text.match(AREA_REGEX);
  if (!match) {
    return "";
  }
  const area = match[1].replace(",", ".").replace(/\s/g, "");
  return ` \u0412\u044B\u0442\u044F\u043D\u0443\u0442\u043E \u0430\u043B\u0433\u043E\u0440\u0438\u0442\u043C\u0430\u043C\u0438 \u0438\u0437 \u0434\u0430\u043D\u043D\u044B\u0445: ${area} \u043C\xB2`;
}
function isRecentDate(isoDate, fromDate, toDate) {
  const value = new Date(isoDate).getTime();
  if (Number.isNaN(value)) {
    return false;
  }
  const since = fromDate ? new Date(fromDate).getTime() : Date.now() - DAYS_BACK * 24 * 60 * 60 * 1e3;
  const until = toDate ? new Date(toDate).getTime() : Date.now();
  return value >= since && value <= until;
}
function isExpiredDate(isoDate) {
  if (!isoDate) {
    return false;
  }
  const deadline = new Date(isoDate);
  if (Number.isNaN(deadline.getTime())) {
    return false;
  }
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return deadline.getTime() < today.getTime();
}
function hasTargetPostalIndex(text) {
  return /\b(10[1-9]|1[1-2]\d|14[0-3]|17[0-2])\d{3}\b/.test(text);
}
function evaluateZipScore(fullText) {
  const zipCodes = fullText.match(/\b\d{6}\b/g) || [];
  let badZipFound = false;
  let goodZipFound = false;
  for (const zip of zipCodes) {
    if (/^(10|11|12|14|17)/.test(zip)) {
      goodZipFound = true;
    } else {
      badZipFound = true;
    }
  }
  return badZipFound && !goodZipFound ? -5e3 : 0;
}
function hasForeignCity(fullText) {
  const allowedCities = MOSCOW_AGGLOMERATION.map((city) => normalizeCyrillic(city));
  const matches = Array.from(fullText.matchAll(CITY_REGEX));
  for (const match of matches) {
    const city = normalizeCyrillic(normalizeWhitespace(match[1] ?? ""));
    if (!city) {
      continue;
    }
    const isAllowed = allowedCities.some(
      (candidate) => city.includes(candidate) || candidate.includes(city)
    );
    if (!isAllowed) {
      return true;
    }
  }
  return false;
}
function calculateRegionalScore(entry) {
  let relevanceScore = 0;
  const fullText = normalizeCyrillic(
    `${entry.title} ${entry.customer} ${entry.description} ${entry.lawRaw} ${entry.regionText}`
  );
  const hasPositiveContext = POSITIVE_REGION_MARKERS.some(
    (marker) => fullText.includes(normalizeCyrillic(marker))
  );
  const hasDirectCityHit = MOSCOW_MARKERS.some(
    (marker) => fullText.includes(normalizeCyrillic(marker))
  );
  const hasTargetZip = hasTargetPostalIndex(fullText);
  const hasPositiveMarker = hasPositiveContext || hasDirectCityHit || hasTargetZip;
  if (hasDirectCityHit) {
    relevanceScore += 50;
  }
  const innPrefix = entry.inn?.slice(0, 2) ?? "";
  if (TARGET_INN_PREFIXES.includes(innPrefix)) {
    relevanceScore += 50;
  } else if (innPrefix && !hasPositiveMarker) {
    relevanceScore -= 3e3;
  }
  if (innPrefix && NON_TARGET_INN_PREFIXES_HARD.includes(innPrefix) && !hasPositiveMarker) {
    relevanceScore -= 5e3;
  }
  if (hasPositiveContext || hasTargetZip) {
    relevanceScore += 40;
  }
  relevanceScore += evaluateZipScore(fullText);
  if (hasForeignCity(fullText)) {
    relevanceScore -= 1e3;
  }
  return relevanceScore;
}
function calculateRelevance(entry, price, areaTag) {
  const regionalScore = calculateRegionalScore(entry);
  const text = `${entry.title} ${entry.description}`;
  const includeHits = SOFT_ROOF_INCLUDE.filter((k) => containsAny(text, [k])).length;
  const directionBonus = 0;
  const areaBonus = areaTag ? 6 : 0;
  const priceBonus = Math.min(12, Math.floor(price / 5e5));
  return regionalScore + includeHits * 8 + directionBonus + areaBonus + priceBonus;
}
async function fetchEisFromFtpDelta(args) {
  return browseResultsHumanLike(args);
}
async function fetchEisFromMachineReadableApi(_args) {
  return [];
}
async function extractAndFilterEis(args) {
  let rawRows = [];
  if (args.method === "api") {
    rawRows = await fetchEisFromMachineReadableApi({
      ...args,
      gosuslugiToken: args.gosuslugiToken || ""
    });
  } else {
    rawRows = await fetchEisFromFtpDelta(args);
  }
  const keywords = args.keywords.map((k) => normalize(k));
  const regions = new Set(args.regionCodes.map((code) => code.trim()));
  const result = rawRows.filter((row) => {
    const searchable = normalize(`${row.title} ${row.description}`);
    const keywordHit = keywords.some((keyword) => searchable.includes(keyword));
    const regionHit = regions.size === 0 || regions.has(row.regionCode);
    return keywordHit || regionHit;
  }).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, MAX_TENDERS);
  args.log?.(
    `[eis.extract] post-filter result: input=${rawRows.length}, output=${result.length}, mode=${args.method}`
  );
  return result;
}

// src/adapters/eis/eis.adapter.ts
function mapToNormalizedTender(input) {
  return {
    externalId: input.externalId,
    title: input.title,
    customer: input.customer,
    inn: input.inn,
    price: input.price,
    published: input.published,
    deadline: input.deadline,
    source: input.source,
    sourceUrl: input.sourceUrl,
    description: input.description,
    keywords: [],
    regionCode: input.regionCode,
    status: "new",
    notes: ""
  };
}
var EisSourceAdapter = class {
  sourceName = "EIS";
  async extract(context) {
    context.log?.("[eis.adapter] start extraction");
    const rows = await extractAndFilterEis({
      method: context.method,
      keywords: context.keywords,
      regionCodes: context.regionCodes,
      fromDate: context.fromDate,
      toDate: context.toDate,
      gosuslugiToken: context.gosuslugiToken,
      log: context.log,
      onTender: async (raw) => {
        if (!context.onTenderExtracted) {
          return;
        }
        await context.onTenderExtracted(mapToNormalizedTender(raw));
      }
    });
    context.log?.(`[eis.adapter] extracted rows after filter: ${rows.length}`);
    return rows.map(mapToNormalizedTender);
  }
};

// src/loaders/appwrite-loader.ts
var import_node_appwrite2 = require("node-appwrite");
var AppwriteTenderLoader = class {
  databases;
  databaseId;
  collectionId;
  constructor(config) {
    const client = new import_node_appwrite2.Client().setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey);
    this.databases = new import_node_appwrite2.Databases(client);
    this.databaseId = config.databaseId;
    this.collectionId = config.collectionId;
  }
  async cleanExpiredTenders(log) {
    const PAGE_LIMIT = 100;
    let deleted = 0;
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const cutoffIso = today.toISOString();
    while (true) {
      const page = await this.databases.listDocuments(this.databaseId, this.collectionId, [
        import_node_appwrite2.Query.lessThan("deadline", cutoffIso),
        import_node_appwrite2.Query.limit(PAGE_LIMIT),
        import_node_appwrite2.Query.orderAsc("$id")
      ]);
      if (page.documents.length === 0) {
        break;
      }
      for (const doc of page.documents) {
        await this.databases.deleteDocument(this.databaseId, this.collectionId, doc.$id);
        deleted += 1;
      }
    }
    log?.(`[auto-clean] \u0423\u0434\u0430\u043B\u0435\u043D\u043E ${deleted} \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043D\u044B\u0445 \u0442\u0435\u043D\u0434\u0435\u0440\u043E\u0432 \u0438\u0437 \u0411\u0414.`);
    return deleted;
  }
  async upsertMany(tenders) {
    for (const tender of tenders) {
      await this.upsertOne(tender);
    }
  }
  async upsertOne(tender) {
    const documentId = String(tender.externalId).trim();
    if (!documentId) {
      throw new Error("Cannot upsert tender without externalId");
    }
    const payload = {
      id: tender.externalId,
      title: tender.title,
      customer: tender.customer,
      inn: tender.inn,
      price: tender.price,
      published: tender.published,
      deadline: tender.deadline,
      source: tender.source,
      url: tender.sourceUrl,
      description: tender.description,
      keywords: tender.keywords,
      regionCode: tender.regionCode
    };
    const createPayload = {
      ...payload,
      status: tender.status,
      notes: tender.notes,
      isViewed: false
    };
    const updatePayload = {
      ...payload,
      status: tender.status,
      notes: tender.notes
    };
    try {
      await this.databases.createDocument(
        this.databaseId,
        this.collectionId,
        import_node_appwrite2.ID.custom(documentId),
        createPayload
      );
    } catch (error) {
      const code = error instanceof import_node_appwrite2.AppwriteException ? error.code : typeof error?.code === "number" ? error.code : void 0;
      if (code !== 409) {
        throw error;
      }
      await this.databases.updateDocument(
        this.databaseId,
        this.collectionId,
        documentId,
        updatePayload
      );
    }
  }
};

// src/run.ts
var targetKeywords = [
  "\u043A\u0440\u043E\u0432\u043B\u044F",
  "\u043A\u0430\u043F\u0438\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u0440\u0435\u043C\u043E\u043D\u0442 \u043A\u0440\u043E\u0432\u043B\u0438",
  "\u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0440\u0435\u043C\u043E\u043D\u0442 \u043A\u0440\u043E\u0432\u043B\u0438",
  "\u0440\u0435\u043C\u043E\u043D\u0442 \u043A\u0440\u044B\u0448\u0438",
  "\u043C\u044F\u0433\u043A\u0430\u044F \u043A\u0440\u043E\u0432\u043B\u044F",
  "\u0440\u0435\u043C\u043E\u043D\u0442 \u043C\u044F\u0433\u043A\u043E\u0439 \u043A\u0440\u043E\u0432\u043B\u0438",
  "\u043C\u0435\u043C\u0431\u0440\u0430\u043D\u043D\u0430\u044F \u043A\u0440\u043E\u0432\u043B\u044F",
  "\u0440\u0443\u043B\u043E\u043D\u043D\u0430\u044F \u043A\u0440\u043E\u0432\u043B\u044F",
  "\u043C\u0430\u0441\u0442\u0438\u0447\u043D\u0430\u044F \u043A\u0440\u043E\u0432\u043B\u044F",
  "\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043A\u0440\u043E\u0432\u043B\u0438",
  "\u043A\u0440\u043E\u0432\u0435\u043B\u044C\u043D\u044B\u0435 \u0440\u0430\u0431\u043E\u0442\u044B",
  "\u0437\u0430\u043C\u0435\u043D\u0430 \u043A\u0440\u043E\u0432\u043B\u0438",
  "\u043F\u043B\u043E\u0441\u043A\u0430\u044F \u043A\u0440\u043E\u0432\u043B\u044F",
  "\u0440\u0435\u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F \u043A\u0440\u043E\u0432\u043B\u0438",
  "\u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043A\u0440\u043E\u0432\u043B\u0438"
];
var targetRegionCodes = ["77", "50", "69"];
async function runParser(log) {
  log("run started");
  const loader = new AppwriteTenderLoader({
    endpoint: parserEnv.APPWRITE_ENDPOINT,
    projectId: parserEnv.APPWRITE_PROJECT_ID,
    apiKey: parserEnv.PARSER_APPWRITE_API_KEY,
    databaseId: parserEnv.APPWRITE_DATABASE_ID,
    collectionId: parserEnv.APPWRITE_TENDERS_COLLECTION_ID
  });
  const result = await runEtlPipeline({
    adapters: [new EisSourceAdapter()],
    context: {
      method: parserEnv.EIS_EXTRACT_METHOD,
      gosuslugiToken: parserEnv.EIS_GOSUSLUGI_TOKEN,
      keywords: targetKeywords,
      regionCodes: targetRegionCodes,
      log
    },
    loader
  });
  log(`ETL completed. Extracted: ${result.extracted}, loaded: ${result.loaded}`);
  return result;
}
var main = async ({ req, res, log, error }) => {
  try {
    log("Execution started...");
    const data = await runParser(log);
    log("Execution successful.");
    return res.json({ success: true, data });
  } catch (err) {
    error(`Critical failure: ${err.message}`);
    return res.json({ success: false, error: err.message }, 500);
  }
};
var run_default = main;
module.exports = main;
