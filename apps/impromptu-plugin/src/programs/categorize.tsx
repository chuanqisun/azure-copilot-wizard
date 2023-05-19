import { getMethodInputName } from "../hits/method-input";
import { ChatMessage } from "../openai/chat";
import { cloneSticky, createOrUseSourceNodes, createTargetNodes, moveStickiesToSection } from "../utils/edit";
import { Description, FormTitle, getTextByContent } from "../utils/form";
import { getNextNodes } from "../utils/graph";
import { filterToType, getInnerStickies } from "../utils/query";
import { CreationContext, Program, ProgramContext, ReflectionContext } from "./program";

const { Text, AutoLayout, Input } = figma.widget;

export class CategorizeProgram implements Program {
  public name = "categorize";

  public getSummary(node: FrameNode) {
    const [type] = node.findAllWithCriteria({ types: ["TEXT"] });
    const targetNodeNames = getNextNodes(node)
      .filter(filterToType<SectionNode>("SECTION"))
      .map((node) => node.name)
      .join(", ");

    return `Categorize: ${targetNodeNames}`;
  }

  public getMethodology(_context: ReflectionContext, node: FrameNode) {
    const targetNodes = getNextNodes(node).filter(filterToType<SectionNode>("SECTION"));
    return `For each item in the ${getMethodInputName(node)}, categorize its information into one of [${targetNodes
      .map((targetNode) => targetNode.name)
      .join(", ")}]`;
  }

  public async create(context: CreationContext) {
    const node = (await figma.createNodeFromJSXAsync(
      <AutoLayout direction="vertical" spacing={16} padding={24} cornerRadius={16} fill="#333" width={400}>
        <FormTitle>Categorize</FormTitle>
        <Description>
          Group stickies into predefined categories. Rename categories to improve accuracy. Lock an output sticky for use as training example.
        </Description>
      </AutoLayout>
    )) as FrameNode;

    getTextByContent("Categorize", node)!.locked = true;

    const sources = createOrUseSourceNodes(["Uncategorized"], context.selectedOutputNodes);
    const targets = createTargetNodes(["Category A", "Category B"]);

    return {
      programNode: node,
      sourceNodes: sources,
      targetNodes: targets,
    };
  }

  public async run(context: ProgramContext, node: FrameNode) {
    const inputStickies = getInnerStickies(context.sourceNodes);

    for (const currentSticky of inputStickies) {
      const targetNodes = getNextNodes(node).filter(filterToType<SectionNode>("SECTION"));

      const trainingSamples = targetNodes.flatMap((targetNode) =>
        getInnerStickies([targetNode])
          .slice(0, 7)
          .map((sticky) => ({
            category: targetNode.name,
            text: sticky.text.characters,
          }))
      );

      const maxCategoryWordCount = Math.max(...targetNodes.map((targetNode) => targetNode.name.split(" ").length));

      const messages: ChatMessage[] = [
        { role: "system", content: `Classify the text into one of the categories: [${targetNodes.map((targetNode) => targetNode.name).join(", ")}]` },
        ...trainingSamples.flatMap((sample) => [
          { role: "user" as const, content: sample.text },
          { role: "assistant" as const, content: sample.category },
        ]),
        {
          role: "user",
          content: `${currentSticky.text.characters} ${currentSticky.getPluginData("shortContext")}`,
        },
      ];

      const topChoiceResult =
        (
          await context.chat(messages, {
            max_tokens: Math.min(5, 4 * maxCategoryWordCount),
          })
        ).choices[0].message.content?.trim() ?? "";

      if (!figma.getNodeById(currentSticky.id)) continue;
      if (context.isAborted() || context.isChanged()) return;

      // TODO user may have deleted the sticky during completion
      const targetNodesAfterCompletion = getNextNodes(node).filter(filterToType<SectionNode>("SECTION"));
      const matchedCategory = targetNodesAfterCompletion.find(
        (targetNode) =>
          targetNode.name.toLocaleLowerCase().includes(topChoiceResult.toLocaleLowerCase()) ||
          topChoiceResult.toLocaleLowerCase().includes(targetNode.name.toLocaleLowerCase())
      );

      // exit loop when no category is matched
      if (!matchedCategory) break;

      // TODO: move sticky to matched category
      moveStickiesToSection([cloneSticky(currentSticky)], matchedCategory);
    }
  }
}
