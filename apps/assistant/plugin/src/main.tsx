import type { MessageToFigma, MessageToWeb } from "@h20/assistant-types";
import { getProxyToWeb, type ProxyToWeb } from "@h20/figma-tools";
import BadgeImage from "./assets/FigmaWidgetIcon.png";
import { handleClearNotification } from "./handlers/handle-clear-notification";
import { handleDetectSelection } from "./handlers/handle-detect-selection";
import { handleGetViewport } from "./handlers/handle-get-viewport";
import { handleMutation } from "./handlers/handle-mutation";
import { handleRenderAutoLayoutItem } from "./handlers/handle-render-auto-layout-item";
import { handleSearchNodesByNamePattern } from "./handlers/handle-search-nodes-by-name-pattern";
import { handleSelectionChange } from "./handlers/handle-selection-change";
import { handleSetSelection } from "./handlers/handle-set-selection";
import { handleShowNotification } from "./handlers/handle-show-notification";
import { handleZoomIntoViewByNames } from "./handlers/handle-zoom-into-view-by-names";
import { openIndexPage } from "./router/router";

const { widget } = figma;
const { useEffect, useWidgetNodeId, Image } = widget;

const proxyToWeb = getProxyToWeb<MessageToWeb, MessageToFigma>();

function Widget() {
  const widgetId = useWidgetNodeId();

  useEffect(() => {
    const wrappedHandleSelectionChange = () => {
      handleSelectionChange(proxyToWeb);
    };

    const handleMessageFromWeb = async (message: MessageToFigma) => {
      console.log(message);

      handleClearNotification(message);
      handleDetectSelection(message, wrappedHandleSelectionChange);
      handleGetViewport(message, proxyToWeb);
      handleMutation(message, proxyToWeb);
      handleRenderAutoLayoutItem(message);
      handleSearchNodesByNamePattern(message, proxyToWeb);
      handleSetSelection(message, proxyToWeb);
      handleShowNotification(message, proxyToWeb);
      handleZoomIntoViewByNames(message);
    };

    figma.ui.onmessage = handleMessageFromWeb;

    figma.on("selectionchange", wrappedHandleSelectionChange);

    return () => {
      figma.off("selectionchange", wrappedHandleSelectionChange);
    };
  });

  return <Image src={BadgeImage} width={436} height={436} onClick={() => new Promise((_resolve) => openIndexPage())} />;
}

widget.register(Widget);

export interface HandlerContext {
  message: MessageToFigma;
  widgetId: string;
  webProxy: ProxyToWeb<MessageToWeb, MessageToFigma>;
}
