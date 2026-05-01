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

export const nextCommentId = (doc: GraphDocument): string => {
  // Comments get short c<n> identifiers, monotonically increasing within the
  // document. Re-using the highest cN seen rather than counting elements
  // means deletes don't collide with the next allocation.
  let max = 0;
  for (const c of doc.graph.comments) {
    const m = /^c(\d+)$/.exec(c.id);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `c${String(max + 1)}`;
};
