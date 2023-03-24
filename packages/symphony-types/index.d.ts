export interface MessageToWeb {
  programSelectionChanged?: DisplayProgram[];
  respondContextPath?: DisplayProgram[][];
  respondCreateProgram?: DisplayProgram;
  respondPathFromRoot?: DisplayProgram[];
  respondRuntimeUpdate?: boolean;
  respondSelectedPrograms?: DisplayProgram[];
}

// messages starting with "request" must be handled with "respond"
export interface MessageToFigma {
  requestContextPath?: string; // includes nodes before and above the selected node
  requestCreateProgram?: CreateProgramInput;
  requestCreateSerialTaskNodes?: CreateSerialTaskNodesInput;
  requestLinearContextGraph?: {
    leafIds: string[];
  };
  requestPathFromRoot?: string; // includes nodes above the selected node
  requestRemoveDownstreamNode?: string;
  requestRuntimeUpdate?: {
    messageHandler: string;
    selectionHandler: string;
  };
  showNotification?: {
    message: string;
    config?: {
      error?: boolean;
    };
  };
  webClientStarted?: boolean;
}

export interface GraphSelection {
  nodeName: string;
}

export interface DisplayProgram {
  id: string;
  subtype: string;
  input: string;
}

export interface CreateSerialTaskNodesInput {
  parentId: string;
  taskDescriptions: string[];
}

export interface CreateProgramInput {
  parentIds: string[];
  subtype: string;
  input: string;
}
