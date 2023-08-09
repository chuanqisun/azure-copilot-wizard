import { MessageToFigma, MessageToWeb } from "@h20/assistant-types";
import { ProxyToWeb, getProxyToWeb } from "@h20/figma-relay";
import BadgeLightSvg from "./assets/BadgeLight.svg";
import { useCard } from "./card/use-card";
import { addCard } from "./handlers/add-card";
import { openCardPage, openIndexPage } from "./router/router";
import { cssPadding } from "./utils/css-padding";

const { widget } = figma;
const { useEffect, AutoLayout, useWidgetId, SVG, Text } = widget;

const webProxy = getProxyToWeb<MessageToWeb, MessageToFigma>();

function Widget() {
  const widgetId = useWidgetId();

  const { cardData } = useCard({ openIndexPage });

  useEffect(() => {
    figma.ui.onmessage = async (message: MessageToFigma) => {
      const context: HandlerContext = {
        message,
        widgetId,
        webProxy,
      };

      console.log(message);

      addCard(context);
    };
  });

  return cardData === null ? (
    <SVG src={BadgeLightSvg} width={436} height={436} onClick={() => new Promise((_resolve) => openIndexPage())} />
  ) : (
    <AutoLayout
      padding={0}
      direction="vertical"
      fill={cardData.backgroundColor}
      cornerRadius={6}
      strokeWidth={4}
      onClick={() => new Promise((_resolve) => openCardPage(cardData.entityId, cardData.entityType))}
    >
      <AutoLayout padding={cssPadding(20, 24, 6, 24)}>
        <Text width={500} fontSize={20} fontWeight={600} lineHeight={26}>
          {cardData.title}
        </Text>
      </AutoLayout>
      <AutoLayout padding={cssPadding(4, 24, 20, 24)}>
        <Text opacity={0.7} width={500} fontSize={18} lineHeight={20} href={cardData!.url}>
          {cardData!.url.replace("https://", "")}
        </Text>
      </AutoLayout>
    </AutoLayout>
  );
}

widget.register(Widget);

export interface HandlerContext {
  message: MessageToFigma;
  widgetId: string;
  webProxy: ProxyToWeb<MessageToWeb, MessageToFigma>;
}
