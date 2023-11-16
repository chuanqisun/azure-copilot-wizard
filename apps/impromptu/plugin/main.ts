import { handleAuthMssages } from "./handlers/handle-auth-messages";
import { handleDataNode } from "./handlers/handle-data-node";
import { handleGetSelectionSummary } from "./handlers/handle-get-selection-summary";
import { getSelectionChangeHandler } from "./handlers/handle-selection-change";
import { getUINotifier } from "./lib/notify-ui";

// perf optimization
// ref: https://www.figma.com/plugin-docs/accessing-document/#optimized-document-traversal
figma.skipInvisibleInstanceChildren = true;

figma.showUI(__html__, { themeColors: true, width: 430, height: 932 });

const notifyUI = getUINotifier();

const handleSelectionChange = getSelectionChangeHandler({ notifyUI });

const handlers = [handleDataNode(), handleAuthMssages({ notifyUI }), handleGetSelectionSummary({ callback: handleSelectionChange })];

figma.ui.onmessage = (msg) => {
  console.log("[debug] message from ui", msg);
  handlers.map((handler) => handler(msg));
};

figma.on("selectionchange", handleSelectionChange);
