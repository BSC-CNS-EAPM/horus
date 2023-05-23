// Create the main window view
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import 'bootstrap/dist/css/bootstrap.css';

import { horusGet, horusPost } from "../Utils/utils";
import NBDButton from "../Components/NBDbutton";


function InstalledPlugins() {

    const [loading, setLoading] = useState(true);
    const [pluginList, setPluginList] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await horusGet("/plugins/list");
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
                return (
                    <PluginCard key={plugin.name} plugin={plugin} />
                )
            })}
        </div>
    );
}

function PluginCard({ plugin }) {

    const deletePlugin = async () => {
        const body = JSON.stringify({
            name: plugin.name
        });

        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        await horusPost("/plugins/uninstall", headers, body);

        // Refresh page
        window.location.reload();
    }

    return (
        <div className="card mb-2" style={{ width: "30rem", marginLeft: "1rem" }}>
            <div className="card-body d-flex justify-content-between align-items-start">
                <div>
                    <h5 className="card-title">{plugin.name}</h5>
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
                    <div>
                        Views: {plugin.views}
                    </div>
                </div>
                <div>
                    <button className="card-link" onClick={deletePlugin}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="red" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}


function PluginManager() {

    // Open new window for plugin installation
    const installPlugin = async () => {
        await horusGet("/plugins/install");
        // Refresh page
        window.location.reload();
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