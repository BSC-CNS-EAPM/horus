// Create the main window view
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// Polyfills
import "core-js/stable";
import "regenerator-runtime/runtime";

import { App } from "./app";

// Import CSS
import "../CSS/main.css";

let container = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!container) {
    // check if createRoot has already been called
    container = document.getElementById("horusRoot");
    const root = createRoot(container);
    root.render(
      // StrictMode is not compatible with XArrows, disable in production, enable in debug
      // <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      // </React.StrictMode>
    );
  }
});
