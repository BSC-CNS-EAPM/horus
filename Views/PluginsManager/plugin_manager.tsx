// Create the main window view
import { useState, useEffect } from "react";
import {
  fetchDesktop,
  horusGet,
  horusGetSettings,
  horusPost,
} from "../Utils/utils";
import NBDButton from "../Components/nbdbutton";
import "./plugin_manager.css";
import { SearchComponent } from "../Components/Toolbar/toolbar";
import { HorusModal, HorusModalProps } from "../Components/reusable";
import { socket } from "../Utils/socket";
import {
  HorusPlugin,
  Block,
  PluginVariableTypes,
} from "../Components/FlowBuilder/flow_builder_types";

import RotatingLines from "../Components/RotatingLines/rotatinglines";

import { PluginVariableView } from "../Components/FlowBuilder/block_variables";
import { HorusFileExplorer } from "../Components/FileExplorer/file_explorer";

interface PluginConfigViewProps {
  configBlocks: Block[];
  handleChange: (value: PluginVariableTypes, id: string) => void;
}

function PluginConfigView(props: PluginConfigViewProps) {
  const { configBlocks, handleChange } = props;

  return (
    <div>
      {/* Map the config blocks and place a <PluginVariable/> component */}
      {configBlocks.map((block, index) => {
        return block.variables.map((variable, index) => {
          return (
            <div>
              {block.name}
              <PluginVariableView
                key={variable.id}
                variable={variable}
                onChange={handleChange}
              />
            </div>
          );
        });
      })}
    </div>
  );
}

type InstalledPluginsProps = {
  pluginList?: {
    errors?: HorusPlugin[];
    plugins?: HorusPlugin[];
  };
  loading: boolean;
  fetchData: () => void;
};

function InstalledPlugins(props: InstalledPluginsProps) {
  const { pluginList, loading, fetchData: propFetchData } = props;

  const [modalProps, setModalProps] = useState<HorusModalProps>({
    header: null,
    body: null,
    footer: null,
    show: false,
    size: "xl",
  });

  const fetchData = async () => {
    setModalProps({
      ...modalProps,
      show: false,
    });

    propFetchData();
  };

  // Create a state to store the modified config
  const [tempChanges, setTempChanges] = useState<Block[]>([]);

  if (loading) {
    return (
      // Center the spinner to the page using TailwindCSS
      <div className="flex justify-center items-center h-screen overflow-hidden">
        <div className="spinner-border" role="status"></div>
      </div>
    );
  }

  const openPluginConfiguration = (plugin: HorusPlugin) => {
    // Get the config blocks from the plugin
    let newConfigBlocks: Block[] = [];

    // Loop through the blocks and subBlocks and store the ones that have config
    for (let i = 0; i < plugin.blocks.length; i++) {
      if (plugin.blocks[i].config.length > 0) {
        newConfigBlocks = [...newConfigBlocks, ...plugin.blocks[i].config];
      }
    }
    const handleModifyConfig = (value: any, id: string, groupID?: string) => {
      const changeID = groupID ? groupID : id;

      const updatedChanges = [...tempChanges]; // Create a copy of tempChanges
      const existingChangeIndex = updatedChanges.findIndex(
        (change) => change.id === changeID
      ); // Check if the change already exists

      // Update the value of the variable in the tempChanges array (set to the block)
      if (existingChangeIndex >= 0) {
        const updateVar = updatedChanges[existingChangeIndex].variables.find(
          (variable) => variable.id === changeID
        );
        // If the change already exists, update the value
        if (groupID) {
          updateVar.variables.find((variable) => variable.id === id).value =
            value;
        } else {
          updateVar.value = value;
        }
      } else {
        // Find the block that has the variable
        for (let i = 0; i < newConfigBlocks.length; i++) {
          const variable = newConfigBlocks[i].variables.find(
            (variable) => variable.id === changeID
          );
          if (variable) {
            // Update the value of the variable
            if (groupID) {
              variable.variables.find((variable) => variable.id === id).value =
                value;
            } else {
              variable.value = value;
            }

            // If the variable exists, push the block to the tempChanges array
            updatedChanges.push(newConfigBlocks[i]);
            break;
          }
        }
      }
      setTempChanges(updatedChanges);
    };

    const handleSave = async () => {
      // Replace the config blocks with the tempChanges
      const newConfig = [...newConfigBlocks];
      for (let i = 0; i < tempChanges.length; i++) {
        const blockIndex = newConfig.findIndex(
          (block) => block.id === tempChanges[i].id
        );
        newConfig[blockIndex] = tempChanges[i];
      }

      // Update the state with the new config blocks
      // setNewConfigBlocks(newConfig);

      // Send the changes to the server
      const header = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      const body = JSON.stringify({
        newConfig: newConfig,
      });

      await horusPost("/plugins/config", header, body);
    };

    const handleClose = () => {
      // Reset the temporary changes array
      setTempChanges([]);

      // Close the modal
      setModalProps({
        ...modalProps,
        show: false,
      });
    };

    // Pass the selected plugin to the plugin config view
    setModalProps({
      header: plugin.name,
      body: (
        <PluginConfigView
          configBlocks={newConfigBlocks}
          handleChange={handleModifyConfig}
        />
      ),
      footer: (
        <div className="d-flex justify-content-between gap-2">
          <NBDButton
            text="Save"
            action={() => {
              // Save the changes
              handleSave();
              handleClose();
            }}
          />
          <NBDButton
            text="Cancel"
            action={() => {
              handleClose();
            }}
          />
        </div>
      ),
      show: true,
      size: "sm",
    });
  };

  const deletingPluginModal = (pluginName: string) => {
    setModalProps({
      header: "Deleting plugin",
      body: (
        <div className="flex justify-center align-items-center flex-col">
          <RotatingLines />
          <div className="text-center">{"Deleting plugin " + pluginName}</div>
        </div>
      ),
      footer: (
        <div className="text-center">
          Please wait while the plugin is being deleted. This may take a while.
        </div>
      ),
      show: true,
      size: "lg",
    });
  };

  const dummyPlguins = () => {
    const fakePluginList = [];
    for (let i = 0; i < 10; i++) {
      fakePluginList.push({
        name: "Plugin " + i,
        description: "Description " + i,
        version: "1.0.0",
      });
    }
    return fakePluginList;
  };

  const hasPlugins = pluginList?.plugins?.length > 0;

  return (
    <div>
      <HorusModal {...modalProps} />
      {/* Render loaded plugin data */}
      <div className="plugin-list gap-2">
        {/* {dummyPlguins().map((plugin) => {
          return <PluginCard key={plugin.name} plugin={plugin} error={false} />;
        })} */}

        {!hasPlugins && (
          <div className="flex justify-center align-items-center flex-col">
            <div className="text-center">No plugins found</div>
          </div>
        )}

        {pluginList?.plugins?.map((plugin) => {
          return (
            <PluginCard
              key={plugin.name}
              plugin={plugin}
              error={false}
              configPlugin={() => {
                openPluginConfiguration(plugin);
              }}
              deleteModal={deletingPluginModal}
              fetchData={fetchData}
            />
          );
        })}
        {/* Render errors */}
        {pluginList?.errors?.map((error) => {
          return (
            <PluginCard
              key={error.name}
              plugin={error}
              error={true}
              deleteModal={deletingPluginModal}
              fetchData={fetchData}
            />
          );
        })}
      </div>
    </div>
  );
}

interface PluginCardProps {
  plugin: HorusPlugin;
  error: boolean;
  configPlugin?: () => void;
  deleteModal?: (name: string) => void;
  fetchData: () => void;
}

function PluginCard(props: PluginCardProps) {
  const { plugin, error, configPlugin, deleteModal, fetchData } = props;

  const deletePlugin = async () => {
    // Show the deleting plugin modal
    deleteModal(plugin.name);

    const body = JSON.stringify({
      name: plugin.name,
    });

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const response = await horusPost("/plugins/uninstall", headers, body);

    const data = await response.json();

    if (!data.ok) {
      alert("Error deleting plugin: " + data.message);
    }

    // Fetch the new data
    fetchData();
  };

  return (
    <div className="card plugin-card">
      <div className="card-body d-flex justify-content-between align-items-start">
        <div>
          <h5 className="card-title">{plugin.name}</h5>
          {!error ? (
            <>
              <h6 className="card-subtitle text-muted">{plugin.description}</h6>
              <div>Version: {plugin.version}</div>
              <div>Author: {plugin.author}</div>
              {plugin.dependencies && plugin.dependencies.length > 0 ? (
                <div>
                  Dependencies:
                  <div>
                    {plugin.dependencies?.map((dependency) => {
                      return <li key={dependency}>{dependency}</li>;
                    })}
                  </div>
                </div>
              ) : (
                "No dependencies"
              )}
            </>
          ) : (
            <div className="plugin-error">{plugin.description}</div>
          )}
        </div>
        <div>
          <div className="d-flex justify-content-between gap-2">
            {!error && (
              <button onClick={configPlugin}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
            {plugin.default ? (
              <div>Default plugin</div>
            ) : (
              <button onClick={deletePlugin}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="red"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PluginManager() {
  const [modalProps, setModalProps] = useState<HorusModalProps>({
    header: "Installing plugin",
    body: (
      <div className="flex justify-center align-items-center flex-col">
        <RotatingLines />
        <div className="text-center">{"Select a plugin to install..."}</div>
      </div>
    ),
    footer: (
      <div className="text-center">
        Please wait while the plugin is being installed. This may take a while.
      </div>
    ),
    show: false,
    size: "lg",
  });

  const installingModal = <HorusModal {...modalProps} />;

  const [pluginList, setPluginList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filteredPluginList, setFilteredPluginList] = useState(pluginList);
  const [developmentMode, setDevelopmentMode] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await horusGet("/plugins/list");
      const data = await response.json();
      setPluginList(data);
      setFilteredPluginList(data);

      // Set the development mode
      const devMode = await horusGetSettings("developmentMode");

      setDevelopmentMode(devMode?.value || false);

      setLoading(false);
    } catch (error) {
      setPluginList(["Error loading plugins"]);
      setLoading(false);
    }
  };

  const updateText = (data) => {
    let stringData = data.toString();

    // Strip the string
    stringData = stringData.replace(/(\r\n|\n|\r)/gm, "");

    if (stringData === "" || stringData === " ") {
      return;
    }

    // Update the state
    setModalProps((currentModalProps) => {
      return {
        ...currentModalProps,
        body: (
          <div className="flex justify-center align-items-center flex-col">
            <RotatingLines />
            <div className="text-center">{stringData}</div>
          </div>
        ),
      };
    });
  };

  useEffect(() => {
    // When recieving a message from the server, log it to the console
    socket.on("installPluginDep", updateText);

    return () => {
      socket.off("installPluginDep", updateText);
    };
  }, []);

  // Open new window for plugin installation
  const installPlugin = async (file) => {
    if (file === null || file === undefined) {
      return;
    }

    setModalProps({
      ...modalProps,
      show: true,
    });

    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const body = JSON.stringify({
      file: file,
    });

    const response = await horusPost("/plugins/install", header, body);
    const data = await response.json();

    if (!data.ok) {
      alert("Error installing plugin: " + data.message);
    }

    setModalProps({
      ...modalProps,
      show: false,
    });

    // Fetch the new data
    fetchData();
  };

  // Open plugins folder
  const openPluginsFolder = async () => {
    await horusGet("/desktop/appsupportdir");
  };

  const reloadPlugins = async () => {
    await horusGet("/api/plugins/reload");
    fetchData();
  };

  useEffect(() => {
    // If we are on an iFrame (plugin manager server)
    // get the isDesktop variable from the parent window
    if (window.parent !== window) {
      window.isDesktop = window.parent.isDesktop;
    }

    fetchData();
  }, []);

  const filterPlugins = (event) => {
    const searchTerm = event.target.value;

    if (searchTerm === "") {
      setFilteredPluginList(pluginList);
      return;
    }

    const filteredPlugins = pluginList.plugins.filter((plugin) => {
      return (
        plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plugin.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plugin.author.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    const filteredErrors = pluginList.errors.filter((plugin) => {
      return (
        plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plugin.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plugin.author.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    setFilteredPluginList({
      plugins: filteredPlugins,
      errors: filteredErrors,
    });
  };

  useEffect(() => {
    fetchDesktop();
  }, []);

  return (
    <div className="root-plugin-container overflow-hidden">
      <div className="flex flex-col">
        <div className="plugin-manager-title flex">
          <h1>Plugin manager</h1>
          <div className="flex flex-row flex-wrap justify-center gap-2 mr-2">
            <HorusFileExplorer
              onFileConfirm={(file) => {
                installPlugin(file);
              }}
              onFileSelect={() => {}}
              allowedExtensions={["hp"]}
            >
              Install plugin
            </HorusFileExplorer>
            {developmentMode && (
              <NBDButton text="Reload plugins" action={reloadPlugins} />
            )}
            <NBDButton text="Open Horus folder" action={openPluginsFolder} />
            <SearchComponent
              placeholder="Search plugins..."
              onChange={filterPlugins}
            />
          </div>
        </div>
        <div>
          {/* Add a hidden rotating lines div because otherwise the rotating lines will not be shown in the modal */}
          <div
            style={{
              display: "none",
            }}
          >
            <RotatingLines />
          </div>
          {installingModal}
          <InstalledPlugins
            pluginList={filteredPluginList}
            loading={loading}
            fetchData={fetchData}
          />
        </div>
      </div>
    </div>
  );
}
