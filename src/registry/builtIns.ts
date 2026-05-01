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

export const BUILT_IN_NODE_TYPES: readonly NodeTypeDescription[] = [Constant, Add, Print];
