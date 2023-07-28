import { threePointSampleArrayItems } from "./array";

export interface InferJsonTypeConfig {
  /** @default "Root" */
  rootTypeName?: string;
  /** @default "full" */
  arraySampleStrategy?: "full" | "head";
}
export function inferJsonType(object: any, config?: InferJsonTypeConfig): string {
  const finalConfig = {
    rootTypeName: "Root",
    arraySampleStrategy: "full",
    ...config,
  };

  if (finalConfig.arraySampleStrategy === "head") return jsonToTyping(object, finalConfig.rootTypeName);

  return "";
}

export function jsonToTyping(object: any, rootName = "Root"): string {
  const ast = getJsonAst(object, rootName);
  const emitResult = emitNode(ast);
  return printEmittedResult(emitResult, rootName);
}

export function jsonArrayToItemTyping(array: any[], rootName = "Item"): string {
  const ast = getJsonAst(array[0], rootName);
  const emitResult = emitNode(ast);
  return printEmittedResult(emitResult, rootName);
}

export function printEmittedResult(emittedNode: EmittedNode, rootName = "Root"): string {
  return [getRootLevelTyping(emittedNode, rootName), ...getInterfaceTyping(emittedNode)].join("\n\n");
}

export function getRootLevelTyping(emittedNode: EmittedNode, rootName = "Root"): string {
  return `type ${capitalizeFirstChar(rootName)}${emittedNode.valueType.endsWith("[]") ? "Array" : ""} = ${emittedNode.valueType};`;
}

export function getInterfaceTyping(emittedNode: EmittedNode): string[] {
  return emittedNode.interfaces.map(
    (emittedInterface) => `interface ${emittedInterface.name} {
${emittedInterface.records.map((record) => `  ${record.key}: ${record.value};`).join("\n")}
}`
  );
}

// Walk the entire json tree and output a reduced json object by sampling the input
// long strings will be cropped
// arrays will be cropped to 3 elements (head, middle, tail)
export function sampleJsonContent(object: any): any {
  const type = typeof object;
  switch (type) {
    case "object":
      if (object === null) {
        return null;
      } else if (Array.isArray(object)) {
        // sample head, middle, tail
        if (!object.length) return [];
        const uniqueSamples = threePointSampleArrayItems(object);
        return uniqueSamples.map(sampleJsonContent);
      } else {
        return Object.fromEntries(
          Object.entries(object).map(([key, value]) => {
            return [key, sampleJsonContent(value)];
          })
        );
      }
    case "string":
      return trimTextIfOverflow(48)(object); // for reference: uuid is 36 char long
    default:
      return object;
  }
}

function trimTextIfOverflow(length: number) {
  return (text: string) => {
    if (text.length > length) {
      return text.slice(0, length) + "...";
    } else {
      return text;
    }
  };
}

export interface JsonAstNode {
  key: string | number;
  type: string;
  children?: JsonAstNode[];
}
export function getJsonAst(object: any, key: string | number): JsonAstNode {
  const type = typeof object;
  switch (type) {
    case "object":
      if (object === null) {
        return { key, type: "null" };
      } else if (Array.isArray(object)) {
        return {
          key,
          type: "array",
          ...(object.length ? { children: [getJsonAst(object[0], 0)] } : undefined),
        };
      } else {
        return {
          key,
          type: "object",
          children: Object.entries(object).map(([key, value]) => {
            return getJsonAst(value, key);
          }),
        };
      }
    default:
      return { key, type };
  }
}

interface EmittedNode {
  valueType: string;
  interfaces: EmittedInterface[];
}
interface EmittedInterface {
  keysPath: (string | number)[];
  name: string;
  records: { key: string; value: string }[];
}

export function emitNode(node: JsonAstNode, parentKeysPath: (string | number)[] = []): EmittedNode {
  const currentKeysPath = [...parentKeysPath, node.key];

  if (node.type === "object") {
    const children = (node.children ?? []).map((child) => ({ key: child.key as string, emittedNode: emitNode(child, currentKeysPath) }));

    const selfInterface: EmittedInterface = {
      keysPath: currentKeysPath,
      name: getInterfaceName(currentKeysPath),
      records: children.map(({ key, emittedNode }) => ({ key, value: emittedNode.valueType })),
    };

    const childrenInterfaces: EmittedInterface[] = children.flatMap(({ emittedNode }) => emittedNode.interfaces);
    return { valueType: selfInterface.name, interfaces: [selfInterface, ...childrenInterfaces] };
  } else if (node.type === "array") {
    if (!node.children?.length) {
      return { valueType: `unknown[]`, interfaces: [] };
    } else {
      const { valueType, interfaces } = emitNode(node.children![0], currentKeysPath);
      return { valueType: `${valueType}[]`, interfaces };
    }
  } else {
    return { valueType: node.type, interfaces: [] };
  }
}

function getInterfaceName(keysPath: (string | number)[]) {
  return `I${keysPath
    .map(indexToItemKey)
    .map((key) => capitalizeFirstChar(key))
    .join("")}`;
}

function capitalizeFirstChar(text: string): any {
  if (!text.length) return text;
  return text[0].toUpperCase() + text.slice(1);
}

function indexToItemKey(key: string | number): string {
  return typeof key === "string" ? key : `item`;
}
