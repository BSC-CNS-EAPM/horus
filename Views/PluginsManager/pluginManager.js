// Create the main window view
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import 'bootstrap/dist/css/bootstrap.css';

import { horusGet } from "../Utils/utils";

function PluginManager() {

    const [loading, setLoading] = useState(true);
    const [pluginList, setPluginList] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("/desktop/plugins/list");
                const data = await response.json();
                console.log(data);
                setPluginList(data);
                setLoading(false);
            } catch (error) {
                setPluginList(["Error loading plugins"]);
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div>
                <h1>Loading plugins</h1>
                <div className="spinner-border" role="status"></div>
            </div>
        )
    }

    return (
        <div>
            <h1>Plugin Manager</h1>
            {/* Render plugin data */}
            {pluginList.map((plugin) => {
                return (
                    <div className="card" style={{ width: "30rem", marginLeft: "1rem" }} >
                        <div className="card-body">
                            <h5 className="card-title">{plugin.name} </h5>
                            <h6 className="card-subtitle mb-2 text-muted">{plugin.description}</h6>
                            <div>
                                Version: {plugin.version}
                            </div>
                            <div>
                                Author: {plugin.author}
                            </div>
                            <div>
                                Dependencies: {plugin.dependencies.join(", ")}
                            </div>
                        </div>
                    </div>
                )
            })
            }
        </div>
    );
}

const container = document.getElementById("plugin-manager-root");
const root = createRoot(container)
root.render(<PluginManager />);