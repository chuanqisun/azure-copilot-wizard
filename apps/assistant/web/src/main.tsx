import type { MessageToFigma, MessageToWeb, RenderAutoLayoutItem, SearchNodeResult, SelectionSummary } from "@h20/assistant-types";
import { getProxyToFigma } from "@h20/figma-tools";
import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
const proxyToFigma = getProxyToFigma<MessageToFigma, MessageToWeb>(import.meta.env.VITE_PLUGIN_ID);

// remove loading placeholder
document.getElementById("app")!.innerHTML = "";
window.focus();

interface TemplateLibrary {
  threadTemplates: SearchNodeResult[];
  userTemplates: SearchNodeResult[];
  spinnerTemplates: SearchNodeResult[];
  copilotTemplates: (SearchNodeResult & { displayName: string })[];
  suggestContainer: SearchNodeResult[];
  suggestTemplates: (SearchNodeResult & { displayName: string })[];
}

function App() {
  const [selection, setSelection] = useState<SelectionSummary | null>(null);
  const [templateLibrary, setTemplateLibrary] = useState<TemplateLibrary>({
    copilotTemplates: [],
    threadTemplates: [],
    userTemplates: [],
    spinnerTemplates: [],
    suggestContainer: [],
    suggestTemplates: [],
  });

  // Figma RPC
  useEffect(() => {
    const handleMainMessage = (e: MessageEvent) => {
      const pluginMessage = e.data.pluginMessage as MessageToWeb;
      console.log(`[ipc] Main -> UI`, pluginMessage);

      if (pluginMessage.selectionChanged) {
        setSelection(pluginMessage.selectionChanged);
      }
    };

    window.addEventListener("message", handleMainMessage);

    return () => window.removeEventListener("message", handleMainMessage);
  }, []);

  useEffect(() => {
    proxyToFigma.notify({ detectSelection: true });

    handleLoadTemplates();
  }, []);

  const byName = useCallback((name: string) => (node: SearchNodeResult) => node.name === name, []);
  const byNameStartsWith = useCallback((name: string) => (node: SearchNodeResult) => node.name.startsWith(name), []);
  const addDisplayName = useCallback((prefix: string) => (node: SearchNodeResult) => ({ ...node, displayName: node.name.replace(prefix, "") }), []);
  const byLocaleComapreDisplayName = useCallback(<T extends { displayName: string }>(a: T, b: T) => a.displayName.localeCompare(b.displayName), []);

  const handleLoadTemplates = async () => {
    const { searchNodesByNamePattern } = await proxyToFigma.request({
      searchNodesByNamePattern: String.raw`@(copilot-template\/.+)|(thread)|(user-template)|(suggest-container)|(suggest-template)|(spinner-template)`,
    });
    if (!searchNodesByNamePattern) return;

    setTemplateLibrary((prev) => ({
      ...prev,
      threadTemplates: searchNodesByNamePattern.filter(byName("@thread")),
      userTemplates: searchNodesByNamePattern.filter(byName("@user-template")),
      spinnerTemplates: searchNodesByNamePattern.filter(byName("@spinner-template")),
      suggestContainer: searchNodesByNamePattern.filter(byName("@suggest-container")),
      suggestTemplates: searchNodesByNamePattern
        .filter(byNameStartsWith("@suggest-template/"))
        .map(addDisplayName("@suggest-template/"))
        .sort(byLocaleComapreDisplayName),
      copilotTemplates: searchNodesByNamePattern
        .filter(byNameStartsWith("@copilot-template/"))
        .map(addDisplayName("@copilot-template/"))
        .sort(byLocaleComapreDisplayName),
    }));
  };

  const handleRenderItem = async (request: RenderAutoLayoutItem) => {
    proxyToFigma.notify({ renderAutoLayoutItem: request });
  };

  const handleZoomNodeIntoView = async (names: string[]) => {
    proxyToFigma.notify({ zoomIntoViewByNames: names });
  };

  const clearTextAreaElement = (element?: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.value = "";
  };

  const handleLocateNodeByNames = useCallback((names: string[]) => {
    handleLoadTemplates();
    handleZoomNodeIntoView(names);
  }, []);

  const userMessageTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const copilotMessageVariableValueRef = useRef<HTMLTextAreaElement>(null);

  const TemplateLocator = (options: { templateNames: string[]; componentNamePattern: string }) => {
    return options.templateNames?.length ? (
      <a href="javascript:void(0)" onClick={() => handleLocateNodeByNames(options.templateNames)} title="Click to locate">
        ❖{options.componentNamePattern}
      </a>
    ) : (
      <a
        href="javascript:void(0)"
        onClick={() => handleLocateNodeByNames(options.templateNames)}
        title={`Component or Frame named "${options.componentNamePattern}" not found. Click to re-scan`}
      >
        ❖{options.componentNamePattern} ⚠️
      </a>
    );
  };

  //drag and drop
  const ItemType = {
    TEMPLATE: 'template',
  };

  interface DraggableButtonProps {
    template: any; // Replace 'any' with the actual type if known
    index: number;
    moveTemplate: (fromIndex: number, toIndex: number) => void;
  }

  const moveTemplate = (fromIndex: number, toIndex: number) => {
    setTemplateLibrary((prev) => {
      const updatedTemplates = [...prev.copilotTemplates];
      const [movedItem] = updatedTemplates.splice(fromIndex, 1);
      updatedTemplates.splice(toIndex, 0, movedItem);
      return { ...prev, copilotTemplates: updatedTemplates };
    });
  };
  interface DraggedItem {
    index: number;
  }

  const DraggableButton = ({ template, index, moveTemplate }: DraggableButtonProps) => {
    const [, ref] = useDrag({
      type: ItemType.TEMPLATE,
      item: { index },
    });

    const [, drop] = useDrop({
      accept: ItemType.TEMPLATE,
      hover: (draggedItem: DraggedItem) => {
        if (draggedItem.index !== index) {
          moveTemplate(draggedItem.index, index);
          draggedItem.index = index;
        }
      },
    });

    return (
      <div ref={(node) => ref(drop(node))}>
        <button
        style={{ width: '100%' }}
        onClick={() =>
          handleRenderItem({
            containerName: "@thread",
            templateName: template.name,
            clear: "@spinner-instance",
            replacements: {
              content: copilotMessageVariableValueRef.current?.value ?? "",
            },
          }).then(() => clearTextAreaElement(copilotMessageVariableValueRef.current))
        }
        >{template.displayName}</button>
      </div>
    );
  };

  return (
    <div class="c-module-stack">

      {/* Thread container */}
      <section class="c-module-stack__section">
        <header class="c-split-header">
          <h2>Thread container</h2>
          <span>
            <TemplateLocator templateNames={templateLibrary.threadTemplates.map((t) => t.name)} componentNamePattern="@thread" />
          </span>
        </header>
        <menu class="c-columns">
          <button
            onClick={() => {
              /* tbd */
            }}
          >
            Undo
          </button>
          <button onClick={() => handleRenderItem({ containerName: "@thread", clear: true })}>Clear</button>
        </menu>
      </section>

      {/* User message */}
      <section class="c-module-stack__section">
        <header class="c-split-header">
          <h2>User message</h2>
          <span>
            <TemplateLocator templateNames={templateLibrary.userTemplates.map((t) => t.name)} componentNamePattern="@user-template" />
          </span>
        </header>
        <textarea
          rows={6}
          ref={userMessageTextAreaRef}
          placeholder="Enter any text to replace the {{content}} placeholder in the user message template."
        ></textarea>
        <button
          onClick={() =>
            handleRenderItem({
              containerName: "@thread",
              templateName: "@user-template",
              replacements: {
                content: userMessageTextAreaRef.current?.value ?? "",
              },
            }).then(() => clearTextAreaElement(userMessageTextAreaRef.current))
          }
        >
          Append
        </button>
      </section>

       {/* Suggest container */}
       <section class="c-module-stack__section">
        <header class="c-split-header">
          <h2>Suggest container</h2>
          <span>
            <TemplateLocator templateNames={templateLibrary.suggestContainer.map((t) => t.name)} componentNamePattern="@suggest-container" />
          </span>
        </header>
        <button
          onClick={() =>
            handleRenderItem({
              containerName: "@suggest-container",
              clear: true,
            })
          }
        >
          Clear
        </button>
        <header class="c-split-header">
          <h2>Suggest content</h2>
          <span>
            <TemplateLocator templateNames={templateLibrary.suggestTemplates.map((t) => t.name)} componentNamePattern="@suggest-template/*" />
          </span>
        </header>
        {templateLibrary.suggestTemplates.map((template) => (
          <button
            onClick={() =>
              handleRenderItem({
                containerName: "@suggest-container",
                templateName: template.name,
                clear: "@suggest-container",
              })
            }
          >
            {template.displayName}
          </button>
        ))}
      </section>

      {/* Spinner */}
      <section class="c-module-stack__section">
        <header class="c-split-header">
          <h2>Spinner</h2>
          <span>
            <TemplateLocator templateNames={templateLibrary.spinnerTemplates.map((t) => t.name)} componentNamePattern="@spinner-template" />
          </span>
        </header>
        <button
          onClick={() =>
            handleRenderItem({
              containerName: "@thread",
              templateName: "@spinner-template",
              clear: "@spinner-instance",
            })
          }
        >
          Show spinner
        </button>
      </section>

      {/* Copilot message */}
      <DndProvider backend={HTML5Backend}>
        <section class="c-module-stack__section">
          <div class="c-split-header">
            <h2>Copilot message</h2>
            <span>
              <TemplateLocator templateNames={templateLibrary.copilotTemplates.map((t) => t.name)} componentNamePattern="@copilot-template/*" />
            </span>
          </div>
          {templateLibrary.copilotTemplates.map((template, index) => (
            <DraggableButton
              key={template.name}
              template={template}
              index={index}
              moveTemplate={moveTemplate}
            />
          ))}
          <details open>
            <summary>Variable value</summary>
            <div class="c-module-stack__section c-module-stack__no-padding">
              <textarea
                rows={6}
                ref={copilotMessageVariableValueRef}
                placeholder="Enter any text to replace the {{content}} placeholder in the Copilot message template."
              ></textarea>
            </div>
          </details>
        </section>
      </DndProvider>

    </div>
  );
}

render(<App />, document.getElementById("app") as HTMLElement);
