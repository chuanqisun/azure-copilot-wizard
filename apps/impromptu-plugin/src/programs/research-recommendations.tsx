import { getLongContext, getShortContext } from "../hits/additional-context";
import { EntityName, EntityType } from "../hits/entity";
import { removeHighlightHtml } from "../hits/highlight";
import { getRecommendationQuery } from "../hits/search";
import { stickyColors } from "../utils/colors";
import { createTargetNodes, moveStickiesToSection, setFillColor } from "../utils/edit";
import { Description, FormTitle, getFieldByLabel, getTextByContent, TextField } from "../utils/form";
import { getNextNodes } from "../utils/graph";
import { filterToType } from "../utils/query";
import { CreationContext, Program, ProgramContext } from "./program";

const { AutoLayout } = figma.widget;

export class ResearchRecommendationsProgram implements Program {
  public name = "research-recommendations";

  public getSummary(node: FrameNode) {
    const input = getFieldByLabel("Query", node)!;
    return ` Find UX Insights: "${input.value.characters}"`;
  }

  public async create(context: CreationContext) {
    const node = (await figma.createNodeFromJSXAsync(
      <AutoLayout direction="vertical" spacing={16} padding={24} cornerRadius={16} fill="#333" width={400}>
        <FormTitle>Research Recommendations</FormTitle>
        <Description>Get UX research recommendations from HITS.microsoft.com</Description>
        <TextField label="Query" value="Xbox Cloud Gaming" />
        <TextField label="Limit" value="10" />
      </AutoLayout>
    )) as FrameNode;

    getTextByContent("Research Recommendations", node)!.locked = true;
    getFieldByLabel("Query", node)!.label.locked = true;
    const targets = createTargetNodes(["Recommendations"]);

    return {
      programNode: node,
      sourceNodes: [],
      targetNodes: targets,
    };
  }

  public async run(context: ProgramContext, node: FrameNode) {
    const targetNode = getNextNodes(node).filter(filterToType<SectionNode>("SECTION"))[0];
    if (!targetNode) return;

    const query = getFieldByLabel("Query", node)!.value.characters.trim();
    const limit = parseInt(getFieldByLabel("Limit", node)!.value.characters.trim());

    let currentSkip = 0;
    let resultCount = 0;
    const pageSize = 5;
    let hasMore = true;

    while (hasMore && resultCount < limit) {
      const searchSummary = await context.hitsSearch(getRecommendationQuery({ query, top: pageSize, skip: currentSkip, count: currentSkip === 0 }));
      hasMore = searchSummary.totalCount > currentSkip + pageSize;

      if (context.isAborted() || context.isChanged()) return;

      for (const report of searchSummary.results) {
        const children = report.document.children.filter((child) => child.title).filter((child) => child.entityType === EntityType.Insight);
        const highlights = [...(report.highlights?.["children/Title"] ?? []), ...(report.highlights?.["children/Contents"] ?? [])].map(removeHighlightHtml);

        for (let highlight of highlights) {
          const titleMatchedChild = children.find((child) => child.title?.toLocaleLowerCase().includes(highlight.toLocaleLowerCase()));
          const contentsMatchedChild = children.find((child) => child.contents?.toLocaleLowerCase().includes(highlight.toLocaleLowerCase()));
          const anyMatchedChild = titleMatchedChild ?? contentsMatchedChild;

          if (anyMatchedChild) {
            const sticky = figma.createSticky();
            setFillColor(stickyColors.Yellow, sticky);
            sticky.text.characters = titleMatchedChild ? highlight : contentsMatchedChild!.title!;
            sticky.text.hyperlink = {
              type: "URL",
              value: `https://hits.microsoft.com/${EntityName[anyMatchedChild.entityType]}/${anyMatchedChild.id}`,
            };

            sticky.setPluginData("longContext", getLongContext(report, anyMatchedChild));
            sticky.setPluginData("shortContext", getShortContext(report, anyMatchedChild));

            resultCount++;
            moveStickiesToSection([sticky], targetNode);
          }

          if (resultCount >= limit) return;
        }
      }

      currentSkip += pageSize;
    }
  }
}
