// Create the main window view
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import 'bootstrap/dist/css/bootstrap.css';

import { horusGet } from "../Utils/utils";
import NBDButton from "../Components/NBDButton";

function InstalledPlugins() {

    const [loading, setLoading] = useState(true);
    const [pluginList, setPluginList] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await horusGet("/desktop/plugins/list");
                const data = await response.json();
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
            <h1>Installed plugins</h1>
            {/* Render plugin data */}
            {pluginList.map((plugin) => {
                console.log(plugin)
                return (
                    <div className="card mb-2" style={{ width: "30rem", marginLeft: "1rem" }} >
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
                                Dependencies: {plugin.dependencies}
                            </div>
                            <div>
                                Actions: {plugin.actions}
                            </div>
                        </div>
                    </div>
                )
            })
            }
        </div>
    );
}

function PluginManager() {

    // Open new window for plugin installation
    const installPlugin = () => {
        horusGet("/desktop/plugins/install");
    }

    return (
        <div>
            <h1>Plugin Manager</h1>
            <NBDButton text="Install plugin" action={installPlugin} />
            <InstalledPlugins />
        </div>
    )
}

const container = document.getElementById("plugin-manager-root");
const root = createRoot(container)
root.render(<PluginManager />);