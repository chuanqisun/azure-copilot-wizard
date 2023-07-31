import { emit } from "./emit";
import { parse } from "./parse";

export function getType(input: any, rootName = "Root"): string {
  const root = parse(input);
  const code = emit(root, { rootName });
  return code;
}

export function getArrayItemType(input: any[], rootName = "Item"): string {
  if (!Array.isArray(input)) throw new Error("Input is not an array");
  // HACK, when array is empty, use an empty object to make simulate arbitrary item
  const root = parse(input.length ? input : [{}]);
  const itemRoot = root.children?.get(0);
  if (!itemRoot) throw new Error("Parser error: Did not find array item");
  const code = emit(itemRoot, { rootName });
  return code;
}
