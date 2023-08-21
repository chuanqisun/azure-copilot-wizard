export interface MessageToWeb {
  ping?: string;
  getSelectionRes?: SelectionSummary;
  selectionChanged?: SelectionSummary;
  parseDropHtml?: {
    items: string[];
    figmaDropContext: FigmaDropContext;
    webDragContext?: WebDragContext;
  };
  addedCards?: AddCards;
}

export interface MessageToFigma {
  addCards?: AddCards;
  createShelf?: ShelfCreation;
  detectSelection?: boolean; // request plugin to notfiy selection
  updateShelf?: ShelfChange;
  disableCopilot?: boolean;
  enableCopilot?: boolean;
  renderShelf?: RenderShelf;
  parseHtmlLinksRes?: ParsedLink[];
  ping?: string;
  getSelectionReq?: boolean; // read current selection
}

export interface ShelfCreation {
  name: string;
  rawData: string;
}

/** undefined means no change */
export interface ShelfChange {
  id: string;
  name?: string;
  rawData?: string;
}

export interface RenderShelf {
  name: string;
  rawData: any;
}

export interface SelectionSummary {
  stickies: SelectedSticky[];
  abstractShelves: SerializedShelf[];
  shelfNode: ShelfNode; // TBD
}

export interface SelectedSticky {
  id: string;
  text: string;
  color: string;
}

export interface SerializedShelf {
  id: string;
  name: string;
  rawData: string;
}

export interface ShelfNode {
  name?: string;
  isRoot?: boolean;
  children: ShelfChild[];
}

export type ShelfChild = string | ShelfNode;

export interface CardData {
  category: string;
  title: string;
  entityId: string;
  entityType: number;
  url: string;
  backgroundColor: string;
}

export interface AddCards {
  cards: CardData[];
  webDragContext?: WebDragContext;
  figmaDropContext?: FigmaDropContext;
}

export interface ParsedLink {
  title: string;
  url: string;
}

export interface WebDragContext {
  offsetX: number;
  offsetY: number;
  nodeWidth: number;
  nodeHeight: number;
}

export interface FigmaDropContext {
  parentNodeId: string;
  x: number;
  y: number;
  absoluteX: number;
  absoluteY: number;
}
