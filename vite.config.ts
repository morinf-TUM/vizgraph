import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    // Vite 8 ships rolldown; manualChunks is a function-only API in rolldown,
    // so we use the advancedChunks groups form for declarative vendor splits.
    // VueFlow + dagre are heavy, sit on the canvas / autolayout path, and
    // change rarely — splitting them lets browsers cache them across editor
    // builds. The Vue + Pinia framework runtime gets its own chunk for the
    // same reason.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "vendor-vueflow", test: /node_modules\/@vue-flow\// },
            { name: "vendor-graph", test: /node_modules\/@dagrejs\/dagre/ },
            { name: "vendor-zod", test: /node_modules\/zod\// },
            {
              name: "vendor-vue",
              test: /node_modules\/(vue|@vue|pinia|@vue\/runtime-core|@vue\/runtime-dom|@vue\/shared)/,
            },
          ],
        },
      },
    },
  },
});
