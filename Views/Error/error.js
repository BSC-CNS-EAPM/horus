// Create the error window view
import { createRoot } from "react-dom/client";
import Error from "./ShemsuError";

const container = document.getElementById("error");
const root = createRoot(container)
root.render(<Error />);