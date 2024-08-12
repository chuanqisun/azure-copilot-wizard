export interface ProxyToFigma<MessageToFigma, MessageToWeb> {
  notify(message: MessageToFigma): void;
  request(request: MessageToFigma): Promise<MessageToWeb>;
  respond(request: MessageToWeb, response: MessageToFigma): void;
}

let currentId = 0;

export function getProxyToFigma<MessageToFigma, MessageToWeb>(pluginId: string): ProxyToFigma<MessageToFigma, MessageToWeb> {
  const notify = (message: MessageToFigma) => sendMessage(pluginId, message);

  async function request(message: MessageToFigma) {
    const _sourceId = ++currentId;
    return new Promise<MessageToWeb>((resolve) => {
      const messageHandler = (e: MessageEvent) => {
        const { _id, ...restOfMessage } = e.data.pluginMessage;
        if (_id === _sourceId) {
          window.removeEventListener("message", messageHandler);
          resolve(restOfMessage);
        }
      };

      window.addEventListener("message", messageHandler);
      notify({ ...message, _id: _sourceId } as any);
    });
  }

  function respond(request: MessageToWeb, response: MessageToFigma) {
    notify({ ...response, _id: (request as any)._id } as any);
  }

  return {
    notify,
    request,
    respond,
  };
}

function sendMessage<T>(pluginId: string, message: T) {
  parent.postMessage({ pluginMessage: message, pluginId }, "*");
}
