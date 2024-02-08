// Create the main window view
import React from "react";
import ReactDOM from "react-dom/client";

import ConfigRemotes from "./remotes";

// Import CSS
import "bootstrap/dist/css/bootstrap.css";
import "../CSS/main.css";
import "../CSS/colors.css";
import "../CSS/animations.css";
import "../CSS/font.css";

let container = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!container) {
    // check if createRoot has already been called
    container = document.getElementById("remotes-root");
    // container.className = "root-plugin-container";
    const root = ReactDOM.createRoot(container);
    root.render(
      <React.StrictMode>
        <ConfigRemotes />
      </React.StrictMode>
    );
  }
});
