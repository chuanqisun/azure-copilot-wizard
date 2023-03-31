import { FigmaProxy, getFigmaProxy } from "@h20/figma-relay";
import { LiveProgram, MessageToFigma, MessageToWeb } from "@symphony/types";
import { render } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import "./main.css";
import { useAuth } from "./modules/account/use-auth";
import { useInvitieCode } from "./modules/account/use-invite-code";
import { getCompletion, OpenAICompletionPayload, OpenAICompletionResponse } from "./modules/openai/completion";
import { generateReasonAct } from "./modules/prompts/reason-act";

const figmaProxy = getFigmaProxy<MessageToFigma, MessageToWeb>(import.meta.env.VITE_PLUGIN_ID);

export interface RunContext {
  figmaProxy: FigmaProxy<MessageToFigma, MessageToWeb>;
  getCompletion: (prompt: string, config?: Partial<OpenAICompletionPayload>) => Promise<OpenAICompletionResponse>;
}

function App() {
  const { isConnected, signIn, signOut, accessToken } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const isInviteCodeValid = useInvitieCode(inviteCode);
  const [contextPrograms, setContextPrograms] = useState<LiveProgram[]>([]);

  const runContext = useMemo<RunContext>(
    () => ({
      figmaProxy,
      getCompletion: getCompletion.bind(null, accessToken),
    }),
    [accessToken]
  );

  useEffect(() => {
    const handleMainMessage = async (e: MessageEvent) => {
      const message = e.data.pluginMessage as MessageToWeb;

      if (message.upstreamGraphChanged) {
        setContextPrograms(message.upstreamGraphChanged);
      }
    };

    window.addEventListener("message", handleMainMessage);
    return () => window.removeEventListener("message", handleMainMessage);
  }, []);

  const selectedPrograms = useMemo(() => contextPrograms.filter((program) => program.isSelected), [contextPrograms]);

  // request initial selection
  useEffect(() => {
    figmaProxy.notify({ webClientStarted: true });
  }, []);

  const summarizeContext = async (targetNodeId: string, figmaProxy: FigmaProxy<MessageToFigma, MessageToWeb>) => {
    const { respondContextPath } = await figmaProxy.request({ requestContextPath: targetNodeId });

    const layerSizes = respondContextPath!.map((layer) => layer.length);

    return respondContextPath!
      .flatMap((layer, layerIndex) =>
        layer.map(
          (item, itemIndex) =>
            `${item.subtype}${layerIndex === 0 ? "" : " " + [...layerSizes.slice(0, layerIndex), itemIndex + 1].slice(1).join(".")}: ${item.input}`
        )
      )
      .join("\n");
  };

  const handleCreateThought = useCallback(async () => {
    if (!selectedPrograms.length) {
      figmaProxy.request({
        requestCreateProgram: {
          parentIds: [],
          subtype: "Thought",
          input: "How to conduct a literature review on usability issues with the “Create new link” pattern?",
        },
      });

      return;
    }

    const parentIds = selectedPrograms.map((p) => p.id);
    const { respondUpstreamGraph: respondLinearContextGraph } = await runContext.figmaProxy.request({ requestUpstreamGraph: { leafIds: parentIds } });
    if (!respondLinearContextGraph?.length) return;

    const thought = await generateReasonAct(runContext, {
      pretext: respondLinearContextGraph.map((program) => `${program.subtype}: ${program.input}`).join("\n"),
      generateStepName: "Thought",
    });

    if (!thought) {
      runContext.figmaProxy.notify({
        showNotification: {
          message: "Nothing came up. Try again or make a change?",
        },
      });
      return;
    }

    await runContext.figmaProxy.request({
      requestCreateProgram: {
        parentIds: parentIds,
        subtype: "Thought",
        input: thought,
      },
    });
  }, [runContext, selectedPrograms]);

  const handleCreateAction = useCallback(async () => {
    const activeProgram = selectedPrograms[0];
    if (!activeProgram) {
      figmaProxy.request({
        requestCreateProgram: {
          parentIds: [],
          subtype: "Action",
          input: `Search the web for "Technology Trend"`,
        },
      });
      return;
    }

    const parentIds = selectedPrograms.map((p) => p.id);
    const { respondUpstreamGraph: respondLinearContextGraph } = await runContext.figmaProxy.request({ requestUpstreamGraph: { leafIds: parentIds } });
    if (!respondLinearContextGraph?.length) return;
    const action = await generateReasonAct(runContext, {
      pretext: respondLinearContextGraph.map((program) => `${program.subtype}: ${program.input}`).join("\n"),
      generateStepName: "Action",
    });

    if (!action) {
      runContext.figmaProxy.notify({
        showNotification: {
          message: "Nothing came up. Try again or make a change?",
        },
      });
      return;
    }

    await runContext.figmaProxy.request({
      requestCreateProgram: {
        parentIds: parentIds,
        subtype: "Action",
        input: action,
      },
    });
    // TBD
  }, [runContext, selectedPrograms]);

  const handleCreateObservation = useCallback(async () => {
    const activeProgram = selectedPrograms[0];
    if (!activeProgram) {
      figmaProxy.request({
        requestCreateProgram: {
          parentIds: [],
          subtype: "Observation",
          input: "The Earth revolves around the Sun",
        },
      });
      return;
    }

    const parentIds = selectedPrograms.map((p) => p.id);
    const { respondUpstreamGraph: respondLinearContextGraph } = await runContext.figmaProxy.request({ requestUpstreamGraph: { leafIds: parentIds } });
    if (!respondLinearContextGraph?.length) return;
    const observation = await generateReasonAct(runContext, {
      pretext: respondLinearContextGraph.map((program) => `${program.subtype}: ${program.input}`).join("\n"),
      generateStepName: "Observation",
    });

    if (!observation) {
      runContext.figmaProxy.notify({
        showNotification: {
          message: "Nothing came up. Try again or make a change?",
        },
      });
      return;
    }

    await runContext.figmaProxy.request({
      requestCreateProgram: {
        parentIds: parentIds,
        subtype: "Observation",
        input: observation,
      },
    });
    // TBD
  }, [runContext, selectedPrograms]);

  return (
    <main>
      {isConnected ? (
        <>
          <fieldset>
            <legend>Create</legend>
            <menu>
              <button onClick={handleCreateThought}>Thought</button>
              <button onClick={handleCreateAction}>Action</button>
              <button onClick={handleCreateObservation}>Observation</button>
            </menu>
          </fieldset>
          <fieldset>
            <legend>Run</legend>
            <menu>
              <button>Step</button>
              <button>Auto-run</button>
            </menu>
          </fieldset>
          <fieldset>
            <legend>Action tools</legend>
            <ul class="tool-list">
              <li>
                <input type="checkbox" checked={true}></input>Auto tooling
              </li>
              <li>
                <input type="checkbox"></input>HITS search
              </li>
              <li>
                <input type="checkbox"></input>Academic search
              </li>
              <li>
                <input type="checkbox"></input>Wikipedia search
              </li>
              <li>
                <input type="checkbox"></input>Google search
              </li>
              <li>
                <input type="checkbox"></input>Theme extraction
              </li>
              <li>
                <input type="checkbox"></input>Summarization
              </li>
              <li>
                <input type="checkbox"></input>Filter
              </li>
              <li>
                <input type="checkbox"></input>Problem analysis
              </li>
              <li>
                <input type="checkbox"></input>Step-by-step planning
              </li>
            </ul>
          </fieldset>
          <fieldset>
            <legend>Context</legend>
            <ul class="context-list">
              {contextPrograms.map((program) => (
                <li key={program.id} data-selected={program.isSelected}>
                  <b>{program.subtype}</b>: {program.input}{" "}
                </li>
              ))}
            </ul>
          </fieldset>
        </>
      ) : null}
      <fieldset>
        <legend>Account</legend>
        <menu>
          {isConnected === undefined && <button disabled>Authenticating...</button>}
          {isConnected === true && <button onClick={signOut}>Sign out</button>}
          {isConnected === false && (
            <>
              <input
                ref={(e) => e?.focus()}
                style={{ width: 80 }}
                type="password"
                placeholder="Invite code"
                name="invite-code"
                onInput={(e) => setInviteCode((e.target as HTMLInputElement).value)}
              />
              <button onClick={signIn} disabled={!isInviteCodeValid}>
                Sign in
              </button>
            </>
          )}
        </menu>
      </fieldset>
    </main>
  );
}

document.getElementById("app")!.innerHTML = "";
render(<App />, document.getElementById("app") as HTMLElement);
