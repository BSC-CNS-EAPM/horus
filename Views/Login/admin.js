// Create the error window view
import { createRoot } from "react-dom/client";

// Load the React component
import { AdminTools } from "./admintools.tsx";

// Import CSS
import "bootstrap/dist/css/bootstrap.css";
import "../CSS/main.css";
import "./admintools.css"

import "../Components/FlowBuilder/Blocks/block.css";
import "../PluginsManager/plugin_manager.css";

let container = null;
document.addEventListener("DOMContentLoaded", () => {
  if (!container) {
    container = document.getElementById("admin-root");
    const root = createRoot(container);
    root.render(<AdminTools />);
  }
});
