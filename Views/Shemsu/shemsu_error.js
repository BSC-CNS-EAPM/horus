// Create the error window view
import { createRoot } from "react-dom/client";
import Error from "./../Components/ShemsuError";

const container = document.getElementById("horusRoot");
const root = createRoot(container)
root.render(<Error />);