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
import SidebarView from "../Components/SidebarView/sidebar_view";

// TS Types
import {
  HorusPlugin,
  Block,
  PluginVariable,
} from "../Components/FlowBuilder/flow.types";

// Styles
import "./plugin_manager.css";
import "../CSS/colors.css";
import "../CSS/animations.css";
import { useAlert } from "../Components/HorusPrompt/horus_alert";
import { useConfirm } from "../Components/HorusPrompt/horus_confirm";
import PluginsIcon from "../Components/Toolbar/Icons/Plugins";
import OpenFlowIcon from "../Components/Toolbar/Icons/Open";
import { PluginBrowserRoot } from "./repo_browser";
import { HorusViewTabs, Tab } from "../Components/Tabs";
import RemoteIcon from "../Components/Toolbar/Icons/Remote";
import { HorusLazyLog } from "../Components/HorusLazyLog/HorusLazyLog";

type ConfigBlockType = Array<{
  remote: string;
  config: Block[];
}>;

type PluginConfigViewProps = {
  configBlocks: ConfigBlockType;
};

function getModal() {
  const modal = document.getElementById("home-modal");

  if (!modal) {
    return null;
  }

  const root = document.documentElement;

  const buttons = modal.querySelectorAll("button");

  return {
    root,
    buttons,
  };
}

function disableModal() {
  const queryModal = getModal();

  if (!queryModal) {
    return;
  }

  const { root, buttons } = queryModal;

  buttons.forEach((button) => {
    button.disabled = true;
  });

  root.style.pointerEvents = "none";
  root.style.cursor = "wait";
}

function enableModal() {
  const queryModal = getModal();

  if (!queryModal) {
    return;
  }

  const { root, buttons } = queryModal;

  buttons.forEach((button) => {
    button.disabled = false;
  });

  root.style.pointerEvents = "auto";
  root.style.cursor = "default";
}

function PluginConfigView(props: PluginConfigViewProps) {
  // Create a state to store the modified config
  const [tempChanges, setTempChanges] = useState<Block[]>([]);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [selectedRemote, setSelectedRemote] = useState(
    props.configBlocks[0]?.remote ?? "Error getting configuration"
  );
  const [saving, setSaving] = useState(false);

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
      const configBlock = configBlocks.find((c) => c.remote === selectedRemote);

      if (!configBlock) {
        return;
      }

      for (let i = 0; i < configBlock.config.length; i++) {
        const variable = configBlock.config[i]!.variables.find(
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
          updatedChanges.push(configBlock.config[i]!);
          break;
        }
      }
    }
    setTempChanges(updatedChanges);
    setHasChanges(true);
  };

  const horusAlert = useAlert();

  const handleSave = async () => {
    setSaving(true);

    try {
      // Replace the config blocks with the tempChanges
      const configBlock = configBlocks.find((c) => c.remote === selectedRemote);

      if (!configBlock) {
        return;
      }

      const newConfig = [...configBlock?.config];
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
        config: newConfig,
        remote: selectedRemote,
      });

      const response = await horusPost("/api/plugins/config", header, body);
      const data = await response.json();

      if (!data.ok) {
        await horusAlert(data.msg);
        return;
      }
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  const currentVariables = configBlocks.find(
    (c) => c.remote === selectedRemote
  );

  const getGroupedVariables = () => {
    // Group the variables by category
    const groupedVariables: Record<string, PluginVariable[]> = {};

    currentVariables?.config.forEach((b) => {
      return b.variables.forEach((variable) => {
        if (!groupedVariables[variable.category]) {
          groupedVariables[variable.category] = [];
        }
        groupedVariables[variable.category]!.push(variable);
      });
    });

    const groupedViews: Record<string, React.ReactNode[]> = {};

    for (const [category, gVariables] of Object.entries(groupedVariables)) {
      const variableViews = gVariables.map((gVar) => {
        return (
          <PluginVariableView
            key={gVar.id}
            variable={gVar}
            onChange={handleModifyConfig}
            customClass="w-fit"
          />
        );
      });
      groupedViews[category] = [
        <div className="flex flex-col gap-2 flex-wrap">{variableViews}</div>,
      ];
    }

    return groupedViews;
  };

  const availRemotes: {
    [key: string]: Tab;
  } = {};

  configBlocks.map((c) => {
    if (!availRemotes[c.remote]) {
      availRemotes[c.remote] = {
        title: c.remote,
        view: (
          <div className="flex flex-col gap-2 flex-wrap w-full">
            {currentVariables && (
              <div className="flex justify-end mr-2">
                <AppButton
                  disabled={saving}
                  text={saving ? "Saving..." : "Save"}
                  action={handleSave}
                  className={`${hasChanges ? "bg-orange-300" : ""}`}
                />
              </div>
            )}
            {/* Map the config blocks and place a <PluginVariable/> component */}
            {currentVariables ? (
              <SidebarView key={selectedRemote} views={getGroupedVariables()} />
            ) : (
              <div className="w-full text-center text-red-600">
                Error reading remote configuration
              </div>
            )}
          </div>
        ),
        icon: <RemoteIcon />,
      };
    }
  });

  return (
    <HorusViewTabs
      tabs={availRemotes}
      disabled={saving}
      onTabChange={async (tab) => {
        if (hasChanges) {
          await horusAlert("You have unsaved changes for the current remote.");
          return false;
        }
        setTempChanges([]);
        setHasChanges(false);
        setSelectedRemote(tab);
        return true;
      }}
    />
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

  const horusConfirm = useConfirm();
  const horusAlert = useAlert();

  const deletePlugin = async () => {
    if (!(await horusConfirm("Are you sure you want to delete this plugin?"))) {
      return;
    }

    setIsDeleting(true);

    disableModal();

    try {
      const body = JSON.stringify({
        id: plugin.id,
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

      if (!data.ok) {
        await horusAlert("Error deleting plugin: " + data.msg);
      } else {
        props.deletePlugin(plugin.id);
      }
    } finally {
      enableModal();
      setShowDeletingView(false);
      setIsDeleting(false);
    }
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
      <div className="grid grid-cols-[100px_auto]">
        <div className="my-2 ml-2 grid place-items-center overflow-hidden rounded">
          {plugin.logo ? (
            <img
              src={plugin.logo}
              alt={plugin.name}
              className="w-20 h-20 object-contain"
            />
          ) : (
            <PluginsIcon
              className="w-20 h-20"
              color={error ? "red" : undefined}
            />
          )}
        </div>
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
                {plugin.externalURL && (
                  <span>
                    External URL:{" "}
                    <a target="_blank" href={plugin.externalURL}>
                      {plugin.externalURL}
                    </a>
                  </span>
                )}
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
    </div>
  );
}

type PluginList = {
  plugins: HorusPlugin[];
  errors: HorusPlugin[];
};

export function PluginManager() {
  const [subView, setSubView] = useState<React.ReactNode>(null);
  const [hideSubView, setHideSubView] = useState<boolean>(true);

  const [pluginList, setPluginList] = useState<PluginList | null>(null);
  const [filteredPluginList, setFilteredPluginList] =
    useState<typeof pluginList>(pluginList);
  const [loading, setLoading] = useState<boolean>(true);
  const [developmentMode, setDevelopmentMode] = useState<boolean>(false);

  const horusAlert = useAlert();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await horusGet("/api/plugins/list");
      const data = await response.json();

      if (!data.ok) {
        await horusAlert(data.msg);
        return;
      }

      setPluginList(data.plugins);
      setFilteredPluginList(data.plugins);

      // Set the development mode
      const key = "developmentMode";

      const devMode =
        key in window.horusSettings ? window.horusSettings[key].value : false;

      setDevelopmentMode(devMode || false);
    } catch (error) {
      await horusAlert(`Error fetching plugins: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Open plugins folder
  const openPluginsFolder = async () => {
    await horusGet("/api/desktop/appsupportdir");
  };

  const reloadPlugins = async () => {
    setLoading(true);
    await horusGet("/api/plugins/reload");
    await horusAlert("Plugins reloaded!");
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
            {developmentMode && (
              <AppButton text="Reload plugins" action={reloadPlugins} />
            )}
            <AppButton
              text="Install plugin"
              action={() => {
                handleSetSubview(
                  <InstallingPluginView onPluginInstall={fetchData} />
                );
              }}
            />
            {window.horusInternal.isDesktop && (
              <AppButton text="Open Horus folder" action={openPluginsFolder} />
            )}
            <SearchComponent
              placeholder="Search installed plugins..."
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
          <div className="p-2 fade-in-animation items-start">
            <div className="m-2">
              <AppButton
                action={returnToMainView}
                id="back-arrow-plugins"
                className="flex flex-row gap-2 items-center"
              >
                <BackArrowIcon className="w-5 h-5" />
                <span>Go back</span>
              </AppButton>
            </div>
            <div className="w-full p-2">{subView}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function getFileName(path: string) {
  return (path.split("/").pop() ?? "").split(".")[0];
}

function InstallingPluginView({
  onPluginInstall,
}: {
  onPluginInstall: () => void;
}) {
  const [isInstalling, setIsInstalling] = useState(false);
  const [text, setText] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<string>("");

  const updateText = useCallback((data: any) => {
    // Update the state
    setText((currentText) => {
      return currentText + data.toString();
    });
  }, []);

  const horusAlert = useAlert();

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

    horusPost("/api/plugins/install", header, body)
      .then((response) => response.json())
      .then((data) => {
        if (!data.ok) {
          const msg = "Error installing plugin: " + data.msg;

          horusAlert(msg);

          setText((currentText) => {
            return currentText + "\n" + msg;
          });
        } else {
          onPluginInstall();
        }
      })
      .catch(() => {
        horusAlert(
          "Error retrieving data while installing plugin. Please check the Horus console for details."
        );
      })
      .finally(() => {
        setIsInstalling(false);
      });
  };

  const showAlertOnDisconnect = useCallback(() => {
    if (!isInstalling) {
      return;
    }

    const msg =
      "Disconnected from server while installing plugin. Don't worry, this is expected if the plugin installation is slow. Check the terminal for details on the installation progress.";
    horusAlert(msg);

    setText((currentText) => {
      return currentText + "\n" + msg;
    });

    setIsInstalling(false);
  }, [isInstalling, horusAlert]);

  useEffect(() => {
    // When recieving a message from the server, log it to the console
    socket.on("installPluginDep", updateText);
    socket.on("disconnect", showAlertOnDisconnect);

    return () => {
      socket.off("installPluginDep", updateText);
      socket.off("disconnect", showAlertOnDisconnect);
    };
  }, [updateText, showAlertOnDisconnect]);

  useEffect(() => {
    // Disable all pointer events on the modal,
    // The modal has the following class "fade modal-backdrop show"

    // If no path is selected is just the first render
    if (!selectedFile) {
      return;
    }

    if (isInstalling) {
      disableModal();
    } else {
      enableModal();
    }
  }, [selectedFile, isInstalling]);

  return (
    <div>
      {isInstalling ? (
        <div>
          <h1 className="plugin-variable-name text-2xl mb-2">
            Installing Plugin...
          </h1>
          <HorusContainer className="flex flex-col gap-2 justify-center items-center mb-2">
            <span className="plugin-variable-name">
              Installing {selectedFile}
            </span>
            <RotatingLines />
            <p>
              Please be patient as some dependencies may take a while to
              download and install.
            </p>
          </HorusContainer>
        </div>
      ) : (
        !text && (
          <ManualOrStoreInstall
            isInstalling={isInstalling}
            onPluginInstall={installPlugin}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
          />
        )
      )}
      {text && (
        <div className="space-y-2">
          <div className="flex flex-row justify-between items-center ">
            <h1 className="plugin-variable-name text-2xl">Installation logs</h1>
            <AppButton disabled={isInstalling} action={() => setText("")}>
              Install other...
            </AppButton>
          </div>
          <div
            style={{
              height: "500px",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <HorusLazyLog
              logText={text}
              keepDisabled={!isInstalling}
              filename={
                getFileName(selectedFile)
                  ? `${getFileName(selectedFile)}.log`
                  : "plugin-install.log"
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

export type PluginInstallProps = {
  selectedFile: string;
  setSelectedFile: (file: string) => void;
  isInstalling: boolean;
  onPluginInstall: (file: string) => void;
};

type InstallationViewsType = "manual" | "repo";

function ManualOrStoreInstall({
  selectedFile,
  setSelectedFile,
  isInstalling,
  onPluginInstall,
}: PluginInstallProps) {
  const tabs: {
    [key in InstallationViewsType]: {
      title: string;
      view: JSX.Element;
      icon: JSX.Element;
    };
  } = {
    repo: {
      title: "Plugins repository",
      icon: <PluginsIcon />,
      view: (
        <PluginBrowserRoot
          isInstalling={isInstalling}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          onPluginInstall={onPluginInstall}
        />
      ),
    },
    manual: {
      title: "Manual install",
      icon: <OpenFlowIcon />,
      view: (
        <ManualFileSelectionInstall
          isInstalling={isInstalling}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          onPluginInstall={onPluginInstall}
        />
      ),
    },
  };

  return <HorusViewTabs tabs={tabs} disabled={isInstalling} />;
}

function ManualFileSelectionInstall({
  selectedFile,
  setSelectedFile,
  onPluginInstall,
}: PluginInstallProps) {
  return (
    <div>
      <h1 className="plugin-variable-name text-2xl mb-2">
        Manual installation
      </h1>
      <div className="flex flex-row justify-center items-center gap-2 mb-2">
        <input
          className="app-button plugin-variable-value"
          placeholder="Select a plugin to install or input an URL..."
          value={selectedFile}
          onChange={(e) => {
            setSelectedFile(e.target.value);
          }}
        />
        <AppButton
          disabled={!selectedFile}
          action={() => {
            onPluginInstall(selectedFile!);
          }}
        >
          Install
        </AppButton>
        <HorusFileExplorer
          openOutsideFlowContext
          onFileConfirm={(file) => {
            onPluginInstall(file);
          }}
          onFileSelect={(file) => {
            setSelectedFile(file);
          }}
          allowedExtensions={["hp"]}
        >
          Browse...
        </HorusFileExplorer>
      </div>
    </div>
  );
}
