import type { MessageToUI } from "@h20/types";
import { JSX, render } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import type { HitsFtsNode } from "./modules/fts/fts";
import { HitsArticle } from "./modules/hits/article";
import { useAuth } from "./modules/hits/use-auth";
import { useConfig } from "./modules/hits/use-config";
import { StatusBar, useLog } from "./modules/status/status-bar";
import type { WorkerEvents, WorkerRoutes } from "./routes";
import { getParentOrigin, sendMessage } from "./utils/figma-rpc";
import { useDebounce } from "./utils/use-debounce";
import { useVirtualList } from "./utils/use-virtual-list";
import { WorkerClient } from "./utils/worker-rpc";
import WebWorker from "./worker?worker";

// start worker ASAP
const worker = new WorkerClient<WorkerRoutes, WorkerEvents>(new WebWorker()).start();

// remove loading placeholder
document.getElementById("app")!.innerHTML = "";
window.focus();

function App(props: { worker: WorkerClient<WorkerRoutes, WorkerEvents> }) {
  // Handle URL redirect
  useEffect(() => {
    const openUrl = new URLSearchParams(location.search).get("openUrl");
    if (openUrl) {
      window.open(openUrl, "_blank");
      notifyFigma({ requestClose: true });
    }
  }, []);

  const notifyFigma = useCallback(sendMessage.bind(null, getParentOrigin(), import.meta.env.VITE_PLUGIN_ID), []);
  const { log, lines } = useLog();

  const { worker } = props;
  const { isConnected, signIn, signOut } = useAuth();
  const { value: configValue } = useConfig();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const toggleMenu = useCallback(() => setIsMenuOpen((isOpen) => !isOpen), []);
  const [installationState, setInstallationState] = useState<"installed" | "new" | "error" | "installing" | "unknown">("unknown");
  const [installProgress, setInstallProgress] = useState("0.00%");
  const [indexRev, setIndexRev] = useState(0);

  useEffect(() => {
    switch (isConnected) {
      case false:
        return log("Signed out");
      case true:
        return log("Signed in");
      case undefined:
        return log("Signing in...");
    }
  }, [isConnected]);

  // Handle server events
  // Caution: please keep deps array empty
  useEffect(() => {
    const subArray = [
      worker.subscribe("indexChanged", (type) => {
        setIndexRev((prev) => prev + 1);
        type === "builtFromIncSync" && log(`Index maintenance... Success`);
      }),
      worker.subscribe("fullSyncProgressed", (progress) => {
        if (progress.total) {
          const percentage = `${((100 * progress.success) / progress.total).toFixed(2)}%`;
          log(`Sync... ${progress.success == progress.total ? `Success! ${progress.total} updated` : percentage}`);
          setInstallProgress(percentage);
        } else {
          log(`Sync... No change`);
        }
      }),
      worker.subscribe("incSyncProgressed", (progress) => {
        const total = progress.existingTotal + progress.newTotal;
        const indexed = progress.existingIndexed + progress.newIndexed;
        const isDone = total === indexed;
        if (total) {
          log(`Sync... ${isDone ? `Success! ${progress.newTotal} updated | ${progress.existingTotal} existing` : `${((100 * indexed) / total).toFixed(2)}%`}`);
        } else {
          log(`Sync... No change`);
        }
      }),
      worker.subscribe("syncFailed", () => log(`Sync... Failed. Please try again or reset the app`)),
      worker.subscribe("requestInstallation", () => setInstallationState("new")),
      worker.subscribe("uninstalled", () => location.reload()),
      worker.subscribe("installed", (status) => {
        setInstallationState(status === "success" ? "installed" : "error");
      }),
    ];

    return () => subArray.map((unsub) => unsub());
  }, []);

  // Figma RPC
  useEffect(() => {
    const handleMainMessage = (e: MessageEvent) => {
      const pluginMessage = e.data.pluginMessage as MessageToUI;
      console.log(`[ipc] Main -> UI`, pluginMessage);

      if (pluginMessage.reset) {
        localStorage.clear();
        location.reload();
      }
    };

    window.addEventListener("message", handleMainMessage);

    return () => window.removeEventListener("message", handleMainMessage);
  }, []);

  const [query, setQuery] = useState("");
  const [ftsNodes, setFtsNodes] = useState<HitsFtsNode[]>([]);

  // Incremental sync on start
  useEffect(() => void worker.request("incSync", { config: configValue }), []);

  const handleUninstall = useCallback(async () => {
    worker.request("uninstall");
    log("Uninstalling...");
  }, []);

  const handleInstall = useCallback(async () => {
    setInstallationState("installing");
    await worker.request("fullSync", { config: configValue });
  }, [configValue]);

  const handleInputChange = useCallback((event: JSX.TargetedEvent) => {
    setQuery((event.target as any).value);
    virtualListRef.current?.scrollTo({ top: 0 });
  }, []);

  // handle search V2
  const debouncedQuery = useDebounce(query.trim(), "", 250);
  const liveSearch = useCallback((query: string) => worker.request("liveSearch", { query, config: configValue }), [configValue]);
  const recentSearch = useCallback(() => worker.request("recentV2", { config: configValue }), [configValue]);

  useEffect(() => {
    if (!debouncedQuery) return;
    liveSearch(debouncedQuery).then((result) => setFtsNodes(result.nodes));
  }, [liveSearch, debouncedQuery]);

  // handle search
  useEffect(() => {
    if (!query.trim()) {
      recentSearch().then((result) => setFtsNodes(result.nodes));
    }
  }, [query]);

  useEffect(() => {
    document.querySelector<HTMLInputElement>(`input[type="search"]`)?.focus();
  }, []);

  const { VirtualListItem, setVirtualListRef, virtualListRef } = useVirtualList();

  return (
    <>
      <header class="c-app-header">
        <input class="c-app-header__input c-search-input" type="search" placeholder="Search" spellcheck={false} value={query} onInput={handleInputChange} />
        <button class="u-reset c-app-header__trigger c-menu-trigger-button" data-active={isMenuOpen} onClick={toggleMenu}>
          Menu
        </button>
        {isMenuOpen && (
          <menu class="c-app-header__menu c-app-menu" onClick={toggleMenu}>
            {isConnected === undefined && <span class="c-app-menu--text">Signing in...</span>}
            {isConnected === false && (
              <button class="u-reset c-app-menu--btn" onClick={signIn}>
                Sign in
              </button>
            )}
            {isConnected && (
              <>
                <button class="u-reset c-app-menu--btn" onClick={signOut}>
                  Sign out
                </button>
              </>
            )}
            <button class="u-reset c-app-menu--btn" onClick={handleUninstall}>
              Uninstall
            </button>
          </menu>
        )}
      </header>
      <main class="c-app-layout__main u-scroll" ref={setVirtualListRef}>
        {isConnected === false && (
          <section class="c-welcome-mat">
            <h1 class="c-welcome-title">Welcome to HITS Assistant</h1>
            <div class="c-welcome-action-group">
              <button class="u-reset c-jumbo-button" onClick={signIn}>
                Sign in
              </button>
            </div>
          </section>
        )}
        {((isConnected === true && installationState === "new") || installationState === "installing") && (
          <section class="c-welcome-mat">
            <h1 class="c-welcome-title">Welcome to HITS Assistant</h1>
            <div class="c-welcome-action-group">
              {installationState === "new" && (
                <button class="u-reset c-jumbo-button" onClick={handleInstall}>
                  <span>Install</span>
                </button>
              )}
              {installationState === "installing" && (
                <button class="u-reset c-jumbo-button" onClick={handleInstall} disabled>
                  Installing...<span class="c-jumbo-button__progress">&nbsp;{installProgress}</span>
                </button>
              )}
              <small class="c-welcome-hint">(Will download about 20MB of data)</small>
            </div>
          </section>
        )}
        {isConnected !== false && (
          <ul class="c-list" id="js-virtual-list">
            {ftsNodes.map((parentNode, index) => (
              <VirtualListItem key={parentNode.id} forceVisible={index < 15} placeholderClassName="c-list__placeholder">
                <HitsArticle node={parentNode} isParent={true} sendToFigma={notifyFigma} />
              </VirtualListItem>
            ))}
          </ul>
        )}
      </main>
      <footer>
        <StatusBar lines={lines} />
      </footer>
    </>
  );
}

render(<App worker={worker} />, document.getElementById("app") as HTMLElement);
