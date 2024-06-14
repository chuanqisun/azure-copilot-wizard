import type { CreateSectionMutation, MessageToFigma, MessageToWeb, MutationRequest } from "@h20/assistant-types";
import type { ProxyToFigma } from "@h20/figma-tools";
import { defaultCriteria, filter } from "../../inference/filter";
import type { ChatCompletionProxy } from "../../max/use-max-proxy";
import { contentNodestoIdContentNode, getItemText } from "../../object-tree/content-nodes-to-id-content-node";
import { createTask } from "../abort";
import type { Tool } from "../tool";
import { setSpinner } from "../utils/spinner";

export function filterTool(chatProxy: ChatCompletionProxy, proxyToFigma: ProxyToFigma<MessageToFigma, MessageToWeb>): Tool {
  return {
    id: "core.filter",
    displayName: "Filter",
    parameters: [
      {
        displayName: "Goal or instruction",
        key: "predicate",
        hint: defaultCriteria,
        isOptional: true,
      },
    ],
    getActions: () => ["Run"],
    run: async ({ input, args }) => {
      const { handle, abortController } = createTask();
      const stopSpinner = setSpinner(
        (notification) => proxyToFigma.notify({ showNotification: { ...notification, cancelButton: { handle } } }),
        "Filtering..."
      );
      abortController.signal.addEventListener("abort", stopSpinner);

      try {
        const mutationRequest: MutationRequest = {
          createSections: [
            {
              name: `✅ Accepted`,
            },
            {
              name: `❌ Rejected`,
            },
            {
              name: "Error",
            },
          ] as CreateSectionMutation[],
        };

        const { mutationResponse } = await proxyToFigma.request({ mutationRequest });
        if (mutationResponse?.createdSections.length !== 3) return;

        const [acceptedContainer, rejectedContainer, errorsContaienr] = mutationResponse.createdSections;

        const filterResults = await filter({
          chatProxy,
          predicate: args["predicate"],
          getItemText,
          items: contentNodestoIdContentNode(input).filter((node) => node.content.trim()),
          abortSignal: abortController.signal,
          onAccept: (item) =>
            proxyToFigma.request({
              mutationRequest: {
                updateSections: [
                  {
                    id: acceptedContainer,
                    cloneNodes: [item.id],
                  },
                  {
                    id: rejectedContainer,
                  },
                  {
                    id: errorsContaienr,
                  },
                ],
              },
            }),
          onReject: (item) =>
            proxyToFigma.request({
              mutationRequest: {
                updateSections: [
                  {
                    id: acceptedContainer,
                  },
                  {
                    id: rejectedContainer,
                    cloneNodes: [item.id],
                  },
                  {
                    id: errorsContaienr,
                  },
                ],
              },
            }),
          onError: (item) =>
            proxyToFigma.request({
              mutationRequest: {
                updateSections: [
                  {
                    id: acceptedContainer,
                  },
                  {
                    id: rejectedContainer,
                  },
                  {
                    id: errorsContaienr,
                    cloneNodes: [item.id],
                  },
                ],
              },
            }),
        });

        if (!filterResults.errors.length) {
          // empty mutation just to align the items
          await proxyToFigma.request({
            mutationRequest: {
              removeSections: [errorsContaienr],
              updateSections: [
                {
                  id: acceptedContainer,
                },
                {
                  id: rejectedContainer,
                },
              ],
            },
          });
        }

        stopSpinner();
      } finally {
        stopSpinner();
      }
    },
  };
}
