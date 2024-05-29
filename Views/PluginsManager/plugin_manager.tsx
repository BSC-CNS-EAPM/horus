// React imports
import { useState, useEffect, useCallback } from "react";

// Web-server imports
import { socket } from "../Utils/socket";
import { fetchDesktop, horusGet, horusPost } from "../Utils/utils";

// Components
import { HorusFileExplorer } from "../Components/FileExplorer/file_explorer";
import { SearchComponent } from "../Components/Toolbar/toolbar";
import { PluginVariableView } from "../Components/FlowBuilder/Variables/variables";
import AppButton from "../Components/appbutton";
import RotatingLines from "../Components/RotatingLines/rotatinglines";
import HorusContainer from "../Components/HorusContainer/horus_container";
import BackArrowIcon from "../Components/Toolbar/Icons/BackArrow";

// TS Types
import { HorusPlugin, Block } from "../Components/FlowBuilder/flow.types";

// Styles
import "./plugin_manager.css";
import "../CSS/colors.css";
import "../CSS/animations.css";

interface PluginConfigViewProps {
  configBlocks: Block[];
}

function PluginConfigView(props: PluginConfigViewProps) {
  // Create a state to store the modified config
  const [tempChanges, setTempChanges] = useState<Block[]>([]);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const { configBlocks } = props;

  const handleModifyConfig = (value: any, id: string, groupID?: string) => {
    const changeID = groupID ? groupID : id;

    const updatedChanges = [...tempChanges]; // Create a copy of tempChanges
    const existingChangeIndex = updatedChanges.findIndex(
      (change) => change.id === changeID
    ); // Check if the change already exists

    // Update the value of the variable in the tempChanges array (set to the block)
    if (existingChangeIndex >= 0) {
      const updateVar = updatedChanges[existingChangeIndex]!.variables.find(
        (variable) => variable.id === changeID
      )!;
      // If the change already exists, update the value
      if (groupID) {
        updateVar.variables!.find((variable) => variable.id === id)!.value =
          value;
      } else {
        updateVar.value = value;
      }
    } else {
      // Find the block that has the variable
      for (let i = 0; i < configBlocks.length; i++) {
        const variable = configBlocks[i]!.variables.find(
          (variable) => variable.id === changeID
        );
        if (variable) {
          // Update the value of the variable
          if (groupID) {
            variable.variables!.find((variable) => variable.id === id)!.value =
              value;
          } else {
            variable.value = value;
          }

          // If the variable exists, push the block to the tempChanges array
          updatedChanges.push(configBlocks[i]!);
          break;
        }
      }
    }
    setTempChanges(updatedChanges);
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Replace the config blocks with the tempChanges
    const newConfig = [...configBlocks];
    for (let i = 0; i < tempChanges.length; i++) {
      const blockIndex = newConfig.findIndex(
        (block) => block.id === tempChanges[i]!.id
      )!;
      newConfig[blockIndex] = tempChanges[i]!;
    }

    // Send the changes to the server
    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const body = JSON.stringify({
      newConfig: newConfig,
    });

    const response = await horusPost("/api/plugins/config", header, body);
    const data = await response.json();

    if (!data.ok) {
      alert(data.msg);
      return;
    }
    setHasChanges(false);
  };

  return (
    <div className="flex flex-col gap-2 justify-center items-center w-full">
      <div className="flex flex-row gap-2 flex-wrap w-full">
        {/* Map the config blocks and place a <PluginVariable/> component */}
        {configBlocks.map((block) => {
          return block.variables.map((variable) => {
            return (
              <PluginVariableView
                key={variable.id}
                variable={variable}
                onChange={handleModifyConfig}
              />
            );
          });
        })}
      </div>
      <AppButton
        text="Save"
        action={handleSave}
        className={hasChanges ? "bg-orange-300" : ""}
      />
    </div>
  );
}

type InstalledPluginsProps = {
  pluginList?: {
    errors?: HorusPlugin[];
    plugins?: HorusPlugin[];
  };
  loading: boolean;
  deletePlugin: (id: string) => void;
  setSubView: (view: React.ReactNode) => void;
};

function InstalledPlugins(props: InstalledPluginsProps) {
  const { pluginList, loading, deletePlugin } = props;

  if (loading) {
    return (
      // Center the spinner to the page using TailwindCSS
      <div className="flex justify-center items-center h-48 overflow-hidden">
        <RotatingLines />
      </div>
    );
  }

  const hasPlugins = (pluginList?.plugins?.length ?? 0) > 0;

  return (
    <div>
      <div className="plugin-list gap-2">
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
              setSubview={props.setSubView}
              deletePlugin={deletePlugin}
            />
          );
        })}
        {/* Render errors */}
        {pluginList?.errors?.map((error) => {
          return (
            <PluginCard
              key={error.name}
              plugin={error}
              error
              setSubview={props.setSubView}
              deletePlugin={deletePlugin}
            />
          );
        })}
      </div>
    </div>
  );
}

interface PluginCardProps {
  plugin: HorusPlugin;
  error?: boolean;
  setSubview: (view: React.ReactNode) => void;
  deletePlugin: (id: string) => void;
}

function PluginCard(props: PluginCardProps) {
  const { plugin, error } = props;

  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showDeletingView, setShowDeletingView] = useState<boolean>(false);

  const deletePlugin = async () => {
    if (!confirm("Are you sure you want to delete this plugin?")) {
      return;
    }

    setIsDeleting(true);
    // Disable all pointer events on modal
    const modal = document.getElementById("home-modal") as HTMLDivElement;
    const buttons = modal.querySelectorAll("button");

    buttons.forEach((button) => {
      button.disabled = true;
    });
    modal.style.cursor = "wait !important";

    const body = JSON.stringify({
      name: plugin.name,
    });

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Wait for the animation to finish
    await new Promise((resolve) => setTimeout(resolve, 600));
    setShowDeletingView(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await horusPost("/api/plugins/uninstall", headers, body);

    const data = await response.json();

    buttons.forEach((button) => {
      button.disabled = false;
    });
    modal.style.cursor = "default";

    if (!data.ok) {
      alert("Error deleting plugin: " + data.msg);
    } else {
      props.deletePlugin(plugin.id);
    }
    setShowDeletingView(false);
    setIsDeleting(false);
  };

  if (showDeletingView) {
    return (
      <div className="p-2 card w-full flex flex-col gap-2 justify-center items-center red-container fade-in-animation text-white font-semibold">
        <RotatingLines />
        Removing {plugin.name}
      </div>
    );
  }

  return (
    <div
      className={`card ${
        error ? "plugin-card-error" : "plugin-card"
      } animated-gradient ${isDeleting ? "slide-left-exit-animation" : null}`}
      onClick={() => {
        if (isDeleting) return;
        !error && plugin.config.length > 0;
      }}
    >
      <div className="card-body d-flex justify-content-between align-items-start">
        <div>
          <div className="flex flex-row items-baseline gap-2">
            <div>
              <span className="text-xl font-semibold">{plugin.name}</span>
              {!error && (
                <span className="card-subtitle"> - {plugin.description}</span>
              )}
            </div>
          </div>
          {!error ? (
            <>
              <div>Version: {plugin.version}</div>
              <div>Author: {plugin.author}</div>
            </>
          ) : (
            <div className="plugin-error">{plugin.description}</div>
          )}
        </div>
        <div>
          <div className="d-flex justify-content-between gap-2">
            {!error && plugin.config.length > 0 && (
              <button
                onClick={() => {
                  props.setSubview(
                    <PluginConfigView configBlocks={plugin.config} />
                  );
                }}
              >
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

type PluginList = {
  plugins: HorusPlugin[];
  errors: HorusPlugin[];
};

export function PluginManager({
  closePluginManager,
}: {
  closePluginManager?: () => void;
}) {
  const [subView, setSubView] = useState<React.ReactNode>(null);
  const [hideSubView, setHideSubView] = useState<boolean>(true);

  const [pluginList, setPluginList] = useState<PluginList | null>(null);
  const [filteredPluginList, setFilteredPluginList] =
    useState<typeof pluginList>(pluginList);
  const [loading, setLoading] = useState<boolean>(true);
  const [developmentMode, setDevelopmentMode] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await horusGet("/api/plugins/list");
      const data = await response.json();

      setPluginList(data);
      setFilteredPluginList(data);

      // Set the development mode
      const key = "developmentMode";

      const devMode =
        key in window.horusSettings ? window.horusSettings[key].value : false;

      setDevelopmentMode(devMode || false);
    } catch (error) {
      alert(`Error fetching plugins: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Open plugins folder
  const openPluginsFolder = async () => {
    await horusGet("/api/desktop/appsupportdir");
  };

  const reloadPlugins = async () => {
    await horusGet("/api/plugins/reload");
    alert("Plugins reloaded!");
    fetchData();
  };

  useEffect(() => {
    // If we are on an iFrame (plugin manager server)
    // get the isDesktop variable from the parent window
    if (window.parent !== window) {
      window.horusInternal.isDesktop = window.parent.horusInternal.isDesktop;
    }

    fetchData();
  }, []);

  const filterPlugins = (searchTerm: string) => {
    if (searchTerm === "") {
      setFilteredPluginList(pluginList);
      return;
    }

    const filteredPlugins = pluginList?.plugins.filter((plugin) => {
      return (
        plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plugin.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plugin.author.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    const filteredErrors = pluginList?.errors.filter((plugin) => {
      return (
        plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plugin.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plugin.author.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    setFilteredPluginList({
      plugins: filteredPlugins ?? [],
      errors: filteredErrors ?? [],
    });
  };

  const deletePlugin = (id: string) => {
    const newPluginList = { ...pluginList } as PluginList;

    // Remove the plugin from the list
    newPluginList.plugins = newPluginList.plugins.filter(
      (plugin) => plugin.id !== id
    );

    setPluginList(newPluginList);
    setFilteredPluginList(newPluginList);
  };

  useEffect(() => {
    fetchDesktop();
  }, []);

  const handleSetSubview = (subView: React.ReactNode) => {
    setHideSubView(false);
    setSubView(subView);
  };

  const returnToMainView = () => {
    setHideSubView(true);
  };

  return (
    <div className="overflow-hidden w-full">
      <div className="flex flex-col">
        <div className="plugin-manager-title flex">
          <div
            className="
            text-2xl
            font-semibold
            flex
            justify-center
            items-center
            gap-2
            ml-2
          "
          >
            Plugin manager
          </div>
          <div className="flex flex-row flex-wrap justify-center gap-2 mr-2">
            <AppButton
              text="Install plugin"
              action={() => {
                handleSetSubview(
                  <InstallingPluginView onPluginInstall={fetchData} />
                );
              }}
            />
            {developmentMode && (
              <AppButton text="Reload plugins" action={reloadPlugins} />
            )}
            {window.horusInternal.isDesktop && (
              <AppButton text="Open Horus folder" action={openPluginsFolder} />
            )}
            <AppButton
              text="Close"
              action={() => {
                closePluginManager?.();
              }}
            />
            <SearchComponent
              placeholder="Search plugins..."
              onChange={(e) => {
                filterPlugins(e.target.value);
              }}
            />
          </div>
        </div>
        {hideSubView ? (
          <div className="fade-in-animation">
            <InstalledPlugins
              pluginList={filteredPluginList!}
              loading={loading}
              setSubView={handleSetSubview}
              deletePlugin={deletePlugin}
            />
          </div>
        ) : (
          <>
            <div className="p-2 flex flex-row fade-in-animation">
              <button onClick={returnToMainView} id="back-arrow-plugins">
                <BackArrowIcon className="w-10 h-10" />
              </button>
              <div className="flex-grow p-2">{subView}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InstallingPluginView({
  onPluginInstall,
}: {
  onPluginInstall: () => void;
}) {
  const [isInstalling, setIsInstalling] = useState(false);
  const [text, setText] = useState<string>("");

  const updateText = useCallback((data: any) => {
    // Update the state
    setText((currentText) => {
      return currentText + data.toString();
    });
  }, []);

  // Open new window for plugin installation
  const installPlugin = async (file: string) => {
    if (file === null || file === undefined) {
      return;
    }

    setIsInstalling(true);
    setText("");

    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const body = JSON.stringify({
      file: file,
    });

    const response = await horusPost("/api/plugins/install", header, body);
    const data = await response.json();

    setIsInstalling(false);

    if (!data.ok) {
      alert("Error installing plugin: " + data.msg);
    } else {
      onPluginInstall();
    }
  };

  useEffect(() => {
    // When recieving a message from the server, log it to the console
    socket.on("installPluginDep", updateText);

    return () => {
      socket.off("installPluginDep", updateText);
    };
  }, [updateText]);

  useEffect(() => {
    // Disable all pointer events on modal
    const modal = document.getElementById("home-modal") as HTMLDivElement;
    const buttons = modal.querySelectorAll("button");
    if (isInstalling) {
      buttons.forEach((button) => {
        button.disabled = true;
      });
      modal.style.cursor = "wait !important";
    } else {
      buttons.forEach((button) => {
        button.disabled = false;
      });
      modal.style.cursor = "default";
    }
  }, [isInstalling]);

  return (
    <div className="flex flex-col justify-center items-center gap-2">
      <HorusContainer className="w-[25rem] h-[10rem] flex flex-col gap-2 justify-center items-center">
        {isInstalling ? (
          <RotatingLines />
        ) : (
          <div>Select a plugin to install</div>
        )}
        {!isInstalling && (
          <HorusFileExplorer
            onFileConfirm={(file) => {
              installPlugin(file);
            }}
            onFileSelect={() => {}}
            allowedExtensions={["hp"]}
          >
            Browse...
          </HorusFileExplorer>
        )}
      </HorusContainer>
      {text && (
        <HorusContainer className="overflow-scroll lg:w-[1000px] w-[400px]">
          <pre>{text}</pre>
        </HorusContainer>
      )}
    </div>
  );
}
