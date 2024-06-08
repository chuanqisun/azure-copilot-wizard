import { ensureJsonResponse } from "../openai/ensure-json-response";
import type { Chat } from "../openai/proxy";
import { ensureTokenLimit } from "../openai/tokens";

export interface NamedInsight<T> {
  name: string;
  description: string;
  items: T[];
}

export const defaultContext = `Identify common themes across texts`;

export async function synthesize<T>(
  chatProxy: Chat,
  items: T[],
  goalOrInstruction: string | undefined,
  onStringify: (item: T) => string,
  abortHandle?: string
): Promise<NamedInsight<T>[]> {
  const itemsWithIds = items.map((item, index) => ({ id: index + 1, data: onStringify(item) }));
  const originalItems = items.map((item, index) => ({ id: index + 1, data: item }));

  const itemsYaml = itemsWithIds
    .map((item) =>
      `
[id: ${item.id}]
${item.data}`.trim()
    )
    .join("\n\n");

  const safeCount = ensureTokenLimit(10_000, itemsYaml);
  const maxTokens = Math.min(4096, 200 + Math.round(safeCount * 2)); // assume 200 token overhead + 2X expansion from input
  console.log({ maxTokens, safeCount });

  const result = await chatProxy({
    input: {
      max_tokens: maxTokens,
      temperature: 0.5,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content: `
Synthesize findings from evidence items based on this user goal: ${goalOrInstruction?.trim().length ? goalOrInstruction : defaultContext}

Cite *AS MANY AS POSSIBLE* evidence items id numbers to support each finding.

Respond in JSON format like this:
"""
{
  "findings": [
    {
      "name": "<name of the finding>",
      "description": "<one sentence description of this finding>",
      "evidence": [<id number>, <id number>, ...]
    },
    ...
  ]
}
"""
          `.trim(),
        },
        {
          role: "user",
          content: `

Evidence items:
${itemsYaml}
          `.trim(),
        },
      ],
    },
    context: {
      models: ["gpt-4o"],
      abortHandle,
    },
  }).then((response) =>
    ensureJsonResponse((rawResponse) => {
      if (!Array.isArray(rawResponse?.findings)) throw new Error("Expected findings array");

      const mappedResults = (rawResponse.findings as any[]).map((finding) => {
        if (typeof finding.name !== "string") {
          throw new Error("Expected name string in each finding");
        }

        if (typeof finding.description !== "string") {
          throw new Error("Expected description string in each finding");
        }

        if (!Array.isArray(finding.evidence)) {
          throw new Error("Expected evidence array in each finding");
        }

        return {
          name: finding.name as string,
          description: finding.description as string,
          items: (finding.evidence as any[]).map((id) => {
            if (typeof id !== "number") {
              throw new Error("Expected number in evidence array");
            }

            return originalItems.find((item) => item.id === id)!.data;
          }),
        };
      });

      const unusedItems = originalItems.filter((item) => mappedResults.every((cateogry) => !cateogry.items.includes(item.data)));
      if (unusedItems.length) {
        mappedResults.push({
          name: "Unused",
          description: "Items not used in any insight",
          items: unusedItems.map((item) => item.data),
        });
      }

      console.log("synthesized", mappedResults);

      return mappedResults;
    }, response)
  );

  return result;
}
