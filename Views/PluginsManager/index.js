// Create the main window view
import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import { PluginManager } from "./plugin_manager";

import 'bootstrap/dist/css/bootstrap.css';

let container = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!container) { // check if createRoot has already been called
        container = document.getElementById("plugin-manager-root")
        container.className = "root-plugin-container";
        const root = ReactDOM.createRoot(container)
        root.render(
            <React.StrictMode>
                <BrowserRouter>
                    <PluginManager />
                </BrowserRouter>
            </React.StrictMode>
        )
    }
});

