// Create the main window view
import { createRoot } from "react-dom/client";
import { FlowBuilder } from "./flow_builder";
import 'bootstrap/dist/css/bootstrap.css';

const container = document.getElementById("flow-builder");
const root = createRoot(container)
root.render(<FlowBuilder />);