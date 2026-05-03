import type { NodeTypeDescription } from "./types";

const Constant: NodeTypeDescription = {
  type: "Constant",
  display_name: "Constant",
  category: "Input",
  inputs: [],
  outputs: [{ name: "out", type: "int" }],
  parameters: {
    value: { type: "int", required: true, default: 0 },
  },
};

const Add: NodeTypeDescription = {
  type: "Add",
  display_name: "Add",
  category: "Math",
  inputs: [
    { name: "a", type: "int" },
    { name: "b", type: "int" },
  ],
  outputs: [{ name: "sum", type: "int" }],
  parameters: {},
};

const Print: NodeTypeDescription = {
  type: "Print",
  display_name: "Print",
  category: "Output",
  inputs: [{ name: "in", type: "int" }],
  outputs: [],
  parameters: {},
};

const Subgraph: NodeTypeDescription = {
  type: "Subgraph",
  display_name: "Sub-graph",
  category: "Subgraph",
  // Outer-face ports are derived dynamically from the inner pseudo-nodes;
  // the registry description carries no static port list.
  inputs: [],
  outputs: [],
  parameters: {},
};

const SubgraphInput: NodeTypeDescription = {
  type: "SubgraphInput",
  display_name: "Sub-graph input",
  category: "Subgraph",
  inputs: [],
  // Single output handle. The user-visible type is parameters.portType, set
  // per-instance; the registry description leaves the handle type untyped so
  // it doesn't fight the validator's per-pseudo-node typing.
  outputs: [{ name: "out" }],
  parameters: {
    name: { type: "string", required: true },
    portType: { type: "string", required: true },
  },
};

const SubgraphOutput: NodeTypeDescription = {
  type: "SubgraphOutput",
  display_name: "Sub-graph output",
  category: "Subgraph",
  inputs: [{ name: "in" }],
  outputs: [],
  parameters: {
    name: { type: "string", required: true },
    portType: { type: "string", required: true },
  },
};

export const BUILT_IN_NODE_TYPES: readonly NodeTypeDescription[] = [
  Constant,
  Add,
  Print,
  Subgraph,
  SubgraphInput,
  SubgraphOutput,
];
