// Create the main window view
import { createRoot } from "react-dom/client";
import { App } from "./app";

const container = document.getElementById("horusRoot");
const root = createRoot(container)
root.render(<App />);