import type { MessageToUI } from "@h20/types";
import { render } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import { HitsCard } from "./modules/hits/card";
import type { HitsGraphNode } from "./modules/hits/hits";
import { useAuth } from "./modules/hits/use-auth";
import { useConfig } from "./modules/hits/use-config";
import { useHighlight } from "./modules/search/use-search";
import { StatusBar, useLog } from "./modules/status/status-bar";
import type { WorkerEvents, WorkerRoutes } from "./routes";
import { sendMessage } from "./utils/figma-rpc";
import { WorkerClient } from "./utils/worker-rpc";
import WebWorker from "./worker?worker";

// start worker ASAP
const worker = new WorkerClient<WorkerRoutes, WorkerEvents>(new WebWorker()).start();

// remove loading placeholder
document.getElementById("app")!.innerHTML = "";
window.focus();

function App(props: { worker: WorkerClient<WorkerRoutes, WorkerEvents> }) {
  const notifyFigma = useCallback(sendMessage.bind(null, import.meta.env.VITE_IFRAME_HOST_ORIGIN, import.meta.env.VITE_PLUGIN_ID), []);

  const { log, lines } = useLog();

  const { worker } = props;
  const { isConnected, signIn, signOut } = useAuth();
  const { value: configValue } = useConfig();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const toggleMenu = useCallback(() => setIsMenuOpen((isOpen) => !isOpen), []);
  const [installationState, setInstallationState] = useState<"installed" | "new" | "error" | "installing" | "unknown">("unknown");

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

  useEffect(() => {
    worker.subscribe("indexChanged", (type) => {
      if (type === "updated") log(`Search index updated`);
    });
  }, []);

  useEffect(() => worker.subscribe("syncProgressed", (progress) => log(`Sync ${progress.success}/${progress.total}...`)), []);

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

  useEffect(() => {
    const openUrl = new URLSearchParams(location.search).get("openUrl");
    if (openUrl) {
      window.open(openUrl, "_blank");
      notifyFigma({ requestClose: true });
    }
  }, []);

  const [query, setQuery] = useState("");
  const [searchResultTree, setResultTree] = useState<HitsGraphNode[]>([]);

  // Incremental sync on start
  useEffect(() => {
    worker.request("incSync", { config: configValue }).then((res) => {
      if (res.requireFullSync) {
        log("Pending installation...");
        setInstallationState("new");
      }
    });
  }, []);

  // TBD
  const handleReset = useCallback(async () => {}, []);

  const handleInstall = useCallback(async () => {
    setInstallationState("installing");
    const result = await worker.request("fullSync", { config: configValue });
    setInstallationState(result.hasError ? "error" : "installed");
  }, [configValue]);

  // handle search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed.length) {
      setResultTree([]);
      return;
    }

    worker.request("search", { query }).then((searchResult) => {
      setResultTree(searchResult.nodes);
    });
  }, [query, setResultTree]);

  useEffect(() => {
    document.querySelector<HTMLInputElement>(`input[type="search"]`)?.focus();
  }, []);

  const { getHighlightHtml } = useHighlight(query);

  return (
    <>
      <header class="c-app-header">
        <input
          class="c-app-header__input c-search-input"
          type="search"
          placeholder="Search"
          spellcheck={false}
          value={query}
          onInput={(e) => setQuery((e.target as any).value)}
        />
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
          </menu>
        )}
      </header>
      <main class="u-scroll c-main">
        {(installationState === "new" || installationState === "installing") && (
          <section>
            <h1>Welcome to HITS Assistant</h1>
            {installationState === "new" && (
              <button onClick={handleInstall}>
                Install
                <small>(Approximately 20MB of download)</small>
              </button>
            )}
            {installationState === "installing" && (
              <button onClick={handleInstall} disabled>
                Installing...
              </button>
            )}
          </section>
        )}
        <ul class="c-list">
          {searchResultTree.map((parentNode) => (
            <HitsCard node={parentNode} isParent={true} sendToFigma={notifyFigma} getHighlightHtml={getHighlightHtml} />
          ))}
        </ul>
      </main>
      <footer>
        <StatusBar lines={lines} />
      </footer>
    </>
  );
}

render(<App worker={worker} />, document.getElementById("app") as HTMLElement);
