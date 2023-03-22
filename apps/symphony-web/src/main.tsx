import { getFigmaProxy } from "@h20/figma-relay";
import { MessageToFigma, MessageToWeb, SelectedProgram } from "@symphony/types";
import { render } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import "./main.css";
import { useAuth } from "./modules/account/use-auth";
import { useInvitieCode } from "./modules/account/use-invite-code";
import { getCompletion, OpenAICompletionPayload, OpenAICompletionResponse } from "./modules/openai/completion";

const figmaProxy = getFigmaProxy<MessageToFigma, MessageToWeb>(import.meta.env.VITE_PLUGIN_ID);

export interface RunContext {
  getCompletion: (prompt: string, config: Partial<OpenAICompletionPayload>) => Promise<OpenAICompletionResponse>;
}

function App() {
  const { isConnected, signIn, signOut, accessToken } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const isInviteCodeValid = useInvitieCode(inviteCode);
  const [selectedPrograms, setSelectedPrograms] = useState<SelectedProgram[]>([]);

  const runContext = useMemo<RunContext>(
    () => ({
      getCompletion: getCompletion.bind(null, accessToken),
    }),
    [accessToken]
  );

  useEffect(() => {
    const handleMainMessage = async (e: MessageEvent) => {
      const message = e.data.pluginMessage as MessageToWeb;

      if (message.programSelectionChanged) {
        setSelectedPrograms(message.programSelectionChanged);
      }
    };

    window.addEventListener("message", handleMainMessage);
    return () => window.removeEventListener("message", handleMainMessage);
  }, []);

  const summarizeContext = async (targetNodeId: string) => {
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

  const handleThinkStep = useCallback(async () => {}, [runContext, selectedPrograms]);

  const handleActStep = useCallback(async () => {
    const activeProgram = selectedPrograms[0];
    if (!activeProgram) return;

    const context = await summarizeContext(activeProgram.id);
    // TBD
  }, [runContext, selectedPrograms]);

  return (
    <main>
      {isConnected ? (
        <>
          <fieldset>
            <legend>Menu</legend>
            <menu>
              <button onClick={() => figmaProxy.notify({ requestCreateProgramNode: true })}>Ask</button>{" "}
              <button onClick={handleThinkStep} disabled={!selectedPrograms.length}>
                Think
              </button>
              <button onClick={handleActStep} disabled={!selectedPrograms.some((program) => program.subtype === "Task")}>
                Act
              </button>{" "}
              <button disabled={true}>Auto-run</button>
            </menu>
          </fieldset>
          <fieldset>
            <legend>Context</legend>
            <ul>
              {selectedPrograms.map((program) => (
                <li key={program.id}>
                  {program.subtype}: {program.input}{" "}
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
