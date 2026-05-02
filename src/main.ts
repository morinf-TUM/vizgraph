import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./styles/theme.css";

// Element Plus is part of the locked stack (PROJECT_MEMORY) but no component
// or directive in the editor uses it yet, so the global registration and
// theme CSS were eager-loading ~700KB of unused weight. Components that need
// Element Plus can import per-component (e.g. `import { ElButton } from
// "element-plus"`) when the time comes.
const app = createApp(App);
app.use(createPinia());
app.mount("#app");
