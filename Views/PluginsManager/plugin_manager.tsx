// Create the main window view
import { useState, useEffect } from "react";
import { horusGet, horusPost } from "../Utils/utils";
import NBDButton from "../Components/nbdbutton";
import "./plugin_manager.css"
import { SearchComponent } from "../Components/Toolbar/toolbar";
import { HorusModal } from "../Components/reusable";

import { HorusPlugin, BlockProps, PluginVariableType } from "../Interfaces/plugin_interface";
import { HorusModalProps } from "../Components/reusable";
import { PluginVariable } from "../Components/FlowBuilder/block";

interface PluginConfigViewProps {
    configBlocks: BlockProps[];
    handleChange: (value: PluginVariableType, id: string) => void;
}

function PluginConfigView(props: PluginConfigViewProps) {

    const { configBlocks, handleChange } = props;

    return (
        <div>
            {/* Map the config blocks and place a <PluginVariable/> component */}
            {
                configBlocks.map((block, index) => {
                    return (
                        block.variables.map((variable, index) => {
                            return (
                                <PluginVariable key={variable.id} variable={variable} onChange={handleChange} />
                            )
                        }
                        )
                    )
                })
            }
        </div>
    )
}

function InstalledPlugins() {

    const [loading, setLoading] = useState(true);
    const [pluginList, setPluginList] = useState(null);

    const [modalProps, setModalProps] = useState<HorusModalProps>({
        header: null,
        body: null,
        footer: null,
        show: false,
        size: "xl"
    });

    // Create a state to store the modified config
    const [tempChanges, setTempChanges] = useState<BlockProps[]>([]);

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
            // Center the spinner to the page using TailwindCSS
            <div className="flex justify-center items-center h-screen overflow-hidden">
                <div className="spinner-border" role="status"></div>
            </div>
        )
    }


    const openPluginConfiguration = (plugin: HorusPlugin) => {

        // Get the config blocks from the plugin
        const newConfigBlocks: BlockProps[] = [];

        // Loop through the blocks and subBlocks and store the ones that have config
        for (let i = 0; i < plugin.blocks.length; i++) {
            if (plugin.blocks[i].config) {
                for (let j = 0; j < plugin.blocks[i].config.length; j++) {
                    newConfigBlocks.push(plugin.blocks[i].config[j]);
                }
            }
            if (plugin.blocks[i].subBlocks) {
                for (let k = 0; k < plugin.blocks[i].subBlocks.length; k++) {
                    if (plugin.blocks[i].subBlocks[k].config) {
                        for (let l = 0; l < plugin.blocks[i].subBlocks[k].config.length; l++) {
                            console.log("Config found!")
                            newConfigBlocks.push(plugin.blocks[i].subBlocks[k].config[l]);
                        }
                    }
                }
            }
        }

        const handleModifyConfig = (
            value: PluginVariableType,
            id: string
        ) => {
            const updatedChanges = [...tempChanges]; // Create a copy of tempChanges
            const existingChangeIndex = updatedChanges.findIndex(change => change.id === id); // Check if the change already exists

            // Update the value of the variable in the tempChanges array (set to the block)
            if (existingChangeIndex >= 0) {
                // If the change already exists, update the value
                updatedChanges[existingChangeIndex].variables.find(variable => variable.id === id).value = value;
            } else {
                // If the change doesn't exist, create a new one
                console.log("New change for variable with id: " + id, "Value: " + value);
                // Find the block that has the variable
                for (let i = 0; i < newConfigBlocks.length; i++) {
                    console.log("Checking variables: " + newConfigBlocks[i].variables);
                    const variable = newConfigBlocks[i].variables.find(variable => variable.id === id);
                    if (variable) {
                        console.log("Found variable");

                        // Update the value of the variable
                        variable.value = value;

                        // If the variable exists, push the block to the tempChanges array
                        updatedChanges.push(newConfigBlocks[i]);
                        break;
                    }
                }
            }

            console.log(updatedChanges);

            setTempChanges(updatedChanges);
        }

        const handleSave = async () => {

            // Replace the config blocks with the tempChanges
            const newConfig = [...newConfigBlocks];
            for (let i = 0; i < tempChanges.length; i++) {
                console.log(tempChanges[i])
                const blockIndex = newConfig.findIndex(block => block.id === tempChanges[i].id);
                newConfig[blockIndex] = tempChanges[i];
            }

            // Update the state with the new config blocks
            // setNewConfigBlocks(newConfig);

            // Send the changes to the server
            const header = {
                "Content-Type": "application/json",
                "Accept": "application/json"
            };

            const body = JSON.stringify({
                "newConfig": newConfig
            });

            await horusPost("/plugins/config", header, body);

        };

        const handleClose = () => {
            // Reset the temporary changes array
            setTempChanges([]);

            // Close the modal
            setModalProps({
                ...modalProps,
                show: false
            })
        }

        // Pass the selected plugin to the plugin config view
        setModalProps({
            header: plugin.name,
            body: <PluginConfigView configBlocks={newConfigBlocks} handleChange={handleModifyConfig} />,
            footer: <div className="d-flex justify-content-between">
                <NBDButton text="Save" action={
                    () => {
                        // Save the changes
                        handleSave();
                        handleClose();
                    }
                } />
                <NBDButton text="Close" action={
                    () => {
                        handleClose();
                    }
                } />
            </div>,
            show: true,
            size: "xl"
        })
    }

    const dummyPlguins = () => {
        const fakePluginList = []
        for (let i = 0; i < 10; i++) {
            fakePluginList.push({
                name: "Plugin " + i,
                description: "Description " + i,
                version: "1.0.0",
            })
        }
        return fakePluginList;
    }


    return (
        <div>
            <HorusModal {...modalProps} />
            {/* Render loaded plugin data */}
            <div className="plugin-list gap-2">
                {
                    // dummyPlguins().map((plugin) => {
                    //     return (
                    //         <PluginCard key={plugin.name} plugin={plugin} error={false} />
                    //     )
                    // })
                }
                {
                    pluginList.plugins?.map((plugin) => {
                        return (
                            <PluginCard key={plugin.name} plugin={plugin} error={false} configPlugin={
                                () => {
                                    openPluginConfiguration(plugin);
                                }
                            } />
                        )
                    })

                }
                {/* Render errors */}
                {pluginList.errors?.map((error) => {
                    return (
                        <PluginCard key={error.name} plugin={error} error={true} />
                    )
                })}
            </div>
        </div>
    );
}

interface PluginCardProps {
    plugin: HorusPlugin,
    error: boolean,
    configPlugin?: () => void
}

function PluginCard(props: PluginCardProps) {

    const { plugin, error, configPlugin } = props;

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
        <div className="card plugin-card">
            <div className="card-body d-flex justify-content-between align-items-start">
                <div>
                    <h5 className="card-title">{plugin.name}</h5>
                    {!error ?
                        (<>
                            <h6 className="card-subtitle text-muted">{plugin.description}</h6>
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
                        </>) : (
                            <div className="plugin-error">{plugin.description}</div>
                        )
                    }
                </div>
                <div>
                    <div className="d-flex justify-content-between align-items-start">
                        {
                            !error && (<button className="card-link" onClick={configPlugin}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                </svg>
                            </button>)
                        }
                        {plugin.default ? <>Default plugin</> : <button className="card-link" onClick={deletePlugin}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="red" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                        </button>}
                    </div>
                </div>
            </div>
        </div>
    );
}


export function PluginManager() {

    // Open new window for plugin installation
    const installPlugin = async () => {
        await horusGet("/plugins/install");
        // Refresh page
        window.location.reload();
    }

    // Open plugins folder
    const openPluginsFolder = async () => {
        await horusGet("/desktop/appsupportdir");
    }


    return (
        <div className="root-plugin-container overflow-hidden">
            <div className="flex flex-col">
                <div className="plugin-manager-title flex">
                    <h1>Plugin manager</h1>
                    <div className="flex flex-row gap-2 mr-2">
                        <NBDButton text="Install plugin" action={installPlugin} />
                        <NBDButton text="Open plugins folder" action={openPluginsFolder} />
                        <SearchComponent />
                    </div>
                </div>
                <div>
                    <InstalledPlugins />
                </div>
            </div>
        </div>
    )
}
