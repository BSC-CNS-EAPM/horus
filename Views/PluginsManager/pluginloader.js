// Create the main window view
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import PluginsInitView from "./pluginsinit";

import "bootstrap/dist/css/bootstrap.css";

let container = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!container) {
    // check if createRoot has already been called
    container = document.getElementById("plugin-loader-root");
    container.className = "root-plugin-container";
    const root = ReactDOM.createRoot(container);
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <PluginsInitView />
        </BrowserRouter>
      </React.StrictMode>
    );
  }
});
