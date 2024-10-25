// Create the error window view
import { createRoot } from "react-dom/client";

// Load the React component
import Reset from "./reset.tsx";

// Import CSS
import "../CSS/main.css";
import "../CSS/colors.css";
import "../CSS/animations.css";
import "../CSS/font.css";

import "../Components/FlowBuilder/Blocks/block.css";
import "../PluginsManager/plugin_manager.css";

let container = null;
document.addEventListener("DOMContentLoaded", () => {
  if (!container) {
    container = document.getElementById("reset-root");
    const root = createRoot(container);
    root.render(<Reset />);
  }
});
