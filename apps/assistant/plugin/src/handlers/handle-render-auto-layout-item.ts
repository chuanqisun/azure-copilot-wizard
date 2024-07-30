import type { MessageToFigma } from "@h20/assistant-types";

export async function handleRenderAutoLayoutItem(message: MessageToFigma) {
  if (!message.renderAutoLayoutItem) return;

  await figma.currentPage.loadAsync();
  const container = await figma.currentPage.findOne((n) => n.name === message.renderAutoLayoutItem!.containerName);

  if (!container) {
    figma.notify(`Container with name "${message.renderAutoLayoutItem?.containerName}" not found`, { error: true });
    return;
  }

  if (container.type !== "FRAME" && container.type !== "COMPONENT") {
    figma.notify(`Container with name "${message.renderAutoLayoutItem?.containerName}" is not a frame or component`, { error: true });
    return;
  }

  if (message.renderAutoLayoutItem.clear === true) {
    (container as ComponentNode | FrameNode).children?.forEach((child) => {
      child.remove();
    });
  }

  if (typeof message.renderAutoLayoutItem.clear === "string") {
    const toRemove = (container as ComponentNode | FrameNode).findAll((child) => child.name === message.renderAutoLayoutItem!.clear);
    toRemove.forEach((child) => child.remove());
  }

  const template = message.renderAutoLayoutItem.templateName
    ? await figma.currentPage.findOne((n) => n.name === message.renderAutoLayoutItem!.templateName)
    : null;

  if (message.renderAutoLayoutItem.templateName && !template) {
    figma.notify(`Template with name "${message.renderAutoLayoutItem?.templateName}" not found`, { error: true });
    return;
  }

  if (template && template.type !== "FRAME" && template.type !== "COMPONENT") {
    figma.notify(`Template with name "${message.renderAutoLayoutItem?.templateName}" is not a frame or component`, { error: true });
    return;
  }

  const instance = template?.type === "COMPONENT" ? template.createInstance() : template?.type === "FRAME" ? template.clone() : null;
  if (instance) {
    instance.name = instance.name.replace("template", "instance");

    if (message.renderAutoLayoutItem.replacements) {
      const allTextNodes = instance.findAllWithCriteria({ types: ["TEXT"] });
      const loadFonts = (allTextNodes.map((node) => node.fontName) as FontName[]).filter(
        (value, index, self) => self.findIndex((t) => t.family === value.family && t.style === value.style) === index
      ) as FontName[];
      await Promise.all(loadFonts.map((font) => figma.loadFontAsync(font)));

      allTextNodes.forEach((textNode) => {
        Object.entries(message.renderAutoLayoutItem!.replacements!).forEach(([key, value]) => {
          textNode.characters = textNode.characters.replace(`{{${key}}}`, value);
        });
      });
    }

    container.appendChild(instance);
  }

  // if height overflows, change constraints to align with bottom, otherwise, aligh with top
  // when there is no instance, we use 0 height
  const childrenY = container.children.flatMap((child) => [child.y, child.y + child.height]);
  const childMaxY = Math.max(...childrenY);
  const childMinY = Math.min(...childrenY);
  const isOverflow = childMaxY > container.height || childMinY < 0;

  if (isOverflow) {
    console.log({ overflow: true, childMaxY, childMinY });
    container.primaryAxisAlignItems = "MAX";
  } else {
    console.log({ overflow: false, childMaxY, childMinY });
    container.primaryAxisAlignItems = "MIN";
  }
}
