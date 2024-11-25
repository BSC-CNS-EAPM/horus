// Create the error window view
import { createRoot } from "react-dom/client";
import { Error } from "./ShemsuError";

import "@/CSS/main.css";

declare global {
  interface Window {
    flaskError: string;
  }
}
let container: HTMLElement | null = null;

document.addEventListener("DOMContentLoaded", () => {
  // Before rendering react, check if the flask-error has any content
  // if not, render the default error
  const flaskError = document.getElementById("flask-error")!;

  if (flaskError?.innerHTML === "{{errormsg}}") {
    window.flaskError = "";
  } else {
    window.flaskError = flaskError.innerHTML;
  }

  flaskError.remove();

  if (!container) {
    container = document.getElementById("error")!;
    const root = createRoot(container);
    root.render(<Error />);
  }
});
