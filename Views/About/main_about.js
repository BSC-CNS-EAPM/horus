// Create the error window view
import { createRoot } from "react-dom/client";

import About from "./about";

// Import CSS
import "../CSS/main.css";
import "../CSS/colors.css";
import "../CSS/animations.css";
import "../CSS/font.css";

let container = null;
document.addEventListener("DOMContentLoaded", () => {
  if (!container) {
    container = document.getElementById("about");
    const root = createRoot(container);
    root.render(<About />);
  }
});
