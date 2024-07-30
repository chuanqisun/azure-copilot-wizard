import type { MessageToFigma, MessageToWeb } from "@h20/assistant-types";

export default {};
console.log("[debug-shim] ready");

const mainIframe = document.querySelector<HTMLIFrameElement>("#iframe-main")!;

const webHost = `${location.protocol}//${location.host}`;
mainIframe.src = webHost;

window.addEventListener("message", (e) => {
  const message = e.data?.pluginMessage as MessageToFigma;
  console.log(`[debug] UI -> Main`, message);
});

window.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest("[data-action]");
  const action = target?.closest("[data-action]")?.getAttribute("data-action");

  switch (action) {
    case "rotate":
      // select the last iframe on the page and prepend it to the first iframe
      const lastIframe = [...document.querySelectorAll("iframe")].at(-1)!;
      const firstIframe = document.querySelector("iframe")!;
      firstIframe.insertAdjacentElement("beforebegin", lastIframe);
      break;
  }
});

function sendMessageFromMockMain(message: MessageToWeb) {
  document.querySelector("iframe")!.contentWindow!.postMessage({ pluginMessage: message }, "*");
}
