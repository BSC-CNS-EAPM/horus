// Create the error window view
import { createRoot } from "react-dom/client";

// Load the React component
import LoginRegister from "./login.tsx";

// Import CSS
import "../CSS/main.css";
import "../CSS/colors.css";
import "../CSS/animations.css";
import "../CSS/font.css";
import "../CSS/login.css";

import "../Components/FlowBuilder/Blocks/block.css";
import "../PluginsManager/plugin_manager.css";

let container = null;
document.addEventListener("DOMContentLoaded", () => {
  if (!container) {
    container = document.getElementById("login-root");
    const root = createRoot(container);
    root.render(<LoginRegister />);
  }
});
