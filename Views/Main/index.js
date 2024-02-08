// Create the main window view
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./app";

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
    container = document.getElementById("horusRoot");
    const root = ReactDOM.createRoot(container);
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
