// Create the error window view
import { createRoot } from "react-dom/client";
import Error from "./ShemsuError";

let container = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!container) {
        container = document.getElementById("error");
        const root = createRoot(container)
        root.render(<Error />);
    }
});