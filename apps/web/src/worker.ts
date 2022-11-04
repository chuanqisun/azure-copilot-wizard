/// <reference lib="WebWorker" />

import type { Document as FlexDocument } from "flexsearch";
import { createFtsIndex, exportFtsIndex, importFtsIndex, IndexedItem, queryFts } from "./modules/fts/fts";
import { getDb } from "./modules/graph/db";
import { clearAllNodes, exportNodes, getLastSyncRecord, getNodes, putNodes, updateSyncRecord } from "./modules/graph/graph";
import { graphNodeToFtsDocument, searchResultDocumentToGraphNode } from "./modules/hits/adaptor";
import { getAccessToken } from "./modules/hits/auth";
import type { HitsGraphNode } from "./modules/hits/hits";
import { getAuthenticatedProxy } from "./modules/hits/proxy";
import { search } from "./modules/hits/search";
import type { WorkerEvents, WorkerRoutes } from "./routes";
import { WorkerServer } from "./utils/worker-rpc";

declare const self: SharedWorkerGlobalScope | DedicatedWorkerGlobalScope;

let activeIndex: FlexDocument<IndexedItem> | undefined = undefined;

async function main() {
  const worker = new WorkerServer<WorkerRoutes, WorkerEvents>(self)
    .onRequest("echo", handleEcho)
    .onRequest("fullSync", handleFullSync)
    .onRequest("incSync", handleIncSync)
    .onRequest("search", handleSearch)
    .start();

  getDb()
    .then(getLastSyncRecord)
    .then((syncRecord) => (syncRecord ? importFtsIndex(syncRecord.exportedIndex) : createFtsIndex()))
    .then((initialIndex) => {
      activeIndex = initialIndex;
      console.log("emitting indexChanged");
      worker.emit("indexChanged", "imported");
    });
}

const handleEcho: WorkerRoutes["echo"] = async ({ req }) => ({ message: req.message });

const handleIncSync: WorkerRoutes["incSync"] = async ({ req, emit }) => {
  const config = req.config;
  const db = getDb();
  const accessToken = await getAccessToken({ ...config, id_token: config.idToken });
  const proxy = getAuthenticatedProxy(accessToken);

  const lastSync = await getLastSyncRecord(await db);
  if (!lastSync) {
    return {
      requireFullSync: true,
      total: 0,
      success: 0,
      hasError: false,
    };
  }

  const summary = await search({
    proxy,
    filter: {
      publishDateNewerThan: lastSync.latestUpdatedOn.toISOString(),
    },
    onProgress: async (progress) => {
      const graphNodes = searchResultDocumentToGraphNode(progress.items.map((item) => item.document));
      await putNodes(await db, graphNodes);
      emit("syncProgressed", progress);
    },
  });

  const draftIndex = createFtsIndex();
  await exportNodes(await db, (exportNodeData) => draftIndex.add(graphNodeToFtsDocument(exportNodeData.node as HitsGraphNode)));
  activeIndex = draftIndex;
  emit("indexChanged", "updated");

  const exportedIndex = await exportFtsIndex(draftIndex);
  updateSyncRecord(await db, new Date(), exportedIndex);

  return summary;
};

const handleFullSync: WorkerRoutes["fullSync"] = async ({ req, emit }) => {
  const config = req.config;
  const db = getDb();
  const accessToken = await getAccessToken({ ...config, id_token: config.idToken });
  const proxy = getAuthenticatedProxy(accessToken);

  await clearAllNodes(await db);

  const summary = await search({
    proxy,
    filter: {},
    onProgress: async (progress) => {
      const graphNodes = searchResultDocumentToGraphNode(progress.items.map((item) => item.document));
      await putNodes(await db, graphNodes);
      emit("syncProgressed", progress);
    },
  });

  const draftIndex = createFtsIndex();
  await exportNodes(await db, (exportNodeData) => draftIndex.add(graphNodeToFtsDocument(exportNodeData.node as HitsGraphNode)));
  activeIndex = draftIndex;
  emit("indexChanged", "updated");

  const exportedIndex = await exportFtsIndex(draftIndex);
  updateSyncRecord(await db, new Date(), exportedIndex);

  return summary;
};

const handleSearch: WorkerRoutes["search"] = async ({ req }) => {
  const db = getDb();
  const ids = (await queryFts(activeIndex!, req.query)) as string[];
  // TODO memoize getNodes
  const nodes = await getNodes<HitsGraphNode>(await db, ids);

  return {
    nodes,
  };
};

main();
