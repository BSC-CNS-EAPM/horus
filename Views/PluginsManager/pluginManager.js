// Create the main window view
import { createRoot } from "react-dom/client";
import 'bootstrap/dist/css/bootstrap.css';

function PluginManager() {
    return (
        <div className="error">
            <h1>Plugin Manager</h1>
            <p>Here you can manage the plugins installed in your Shemsu instance.</p>
            <p>Currently, this feature is not implemented.</p>
        </div>
    )
}

const container = document.getElementById("plugin-manager-root");
const root = createRoot(container)
root.render(<PluginManager />);