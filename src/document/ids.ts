import type { GraphDocument } from "./types";

export const nextNodeId = (doc: GraphDocument): number => {
  const ids = doc.graph.nodes.map((n) => n.id);
  return ids.length === 0 ? 1 : Math.max(...ids) + 1;
};

export const edgeIdFor = (
  srcNode: number,
  srcPort: string,
  dstNode: number,
  dstPort: string,
): string => `e${srcNode}_${srcPort}__${dstNode}_${dstPort}`;
