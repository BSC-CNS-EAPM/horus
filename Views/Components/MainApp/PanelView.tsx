import {
  DockviewDefaultTab,
  DockviewReact,
  DockviewReadyEvent,
  IDockviewPanelHeaderProps,
  IDockviewPanelProps,
  DockviewApi,
  AddPanelOptions,
  DockviewPanelApi,
  IDockviewHeaderActionsProps,
  IDockviewDefaultTabProps,
} from "dockview";
import { themeLight } from "dockview";

import { CloseButton } from "dockview/dist/esm/svg";
import "dockview/dist/styles/dockview.css";
import Molstar from "../Molstar/molstar";
import {
  isMolstarLoaded,
  LoadMoleculeFileType,
} from "../Molstar/HorusWrapper/horusmolstar";
import {
  DebugFlow,
  FlowBuilderView,
  ModalContainer,
  ServerFileExplorerContainers,
} from "../FlowBuilder/flow.view";
import MolStarIcon from "../Toolbar/Icons/MolStar";
import HorusTerm from "../Console/console";
import { SmilesGrid } from "../Smiles/SmilesGrid";
import IFrameLoader from "../IframeLoader/iframeloader";
import {
  FlowStatus,
  PluginPage,
  PluginPageExtensionEvent,
} from "../FlowBuilder/flow.types";
import {
  createContext,
  FunctionComponent,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { FlowStatusView } from "../FlowStatus/flow_status";
import { Error } from "@/Error/ShemsuError";
import HorusToolbar from "../Toolbar/toolbar";
import { socket } from "@/Utils/socket";
import { FlowBuilderHooks, useFlowBuilder } from "../FlowBuilder/flow.hooks";
import LogFile from "../Toolbar/Icons/LogFile";
import SettingsIcon from "../Toolbar/Icons/Settings";
import PluginsIcon from "../Toolbar/Icons/Plugins";
import RemoteIcon from "../Toolbar/Icons/Remote";
import { SettingsView } from "@/Settings/settings";
import { PluginManager } from "@/PluginsManager/plugin_manager";
import ConfigRemotes from "../../Remotes/remotes";
import SmilesIcon from "../Toolbar/Icons/Smiles";
import ConsoleIcon from "../Toolbar/Icons/Console";
import Chevron from "../Toolbar/Icons/Chevron";
import { VariableSetupView } from "../FlowBuilder/Variables/variable_connections";
import { BlockLogsView } from "../FlowBuilder/Logs/logs_connections";
import { getPluginLogo } from "../logo";
import MaximizeIcon from "../Toolbar/Icons/Maximize";
import MinimizeIcon from "../Toolbar/Icons/Minimize";
import { Editor } from "@monaco-editor/react";
import CodeIcon from "../Toolbar/Icons/CodeIcon";
import AppButton from "../appbutton";
import NewFlowIcon from "../Toolbar/Icons/New";
import { BlockRegistry } from "../FlowBuilder/BlockRegistry/block_list_view";

// Import drag and drop kit
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { BlockView } from "../FlowBuilder/Blocks/block.view";
import PlotIcon from "../Toolbar/Icons/Plot";
import { MoleculePlotter } from "../MoleculePlotter/MoleculePlotter";
import { HorusFileEditor } from "../FileEditor/FileEditor";
import { BlockEditor } from "../FlowBuilder/BlockRegistry/BlockEditor";
import { IconFile } from "@tabler/icons-react";

const MOLSTAR_PANEL: AddPanelOptions = {
  id: "molstar",
  title: "Mol*",
  component: "molstar",
  renderer: "always",
  floating: false,
  position: {
    direction: "right",
  },
  tabComponent: "confirmClose",
};

const SMILES_PANEL: AddPanelOptions = {
  id: "smiles",
  component: "smiles",
  renderer: "always",
  title: "Smiles",
  floating: false,
  position: {
    direction: "right",
  },
  tabComponent: "confirmClose",
};

const ERROR_PANEL: AddPanelOptions = {
  id: "error",
  title: "Error",
  component: "error",
  renderer: "always",
};

const EXTENSIONS_PANEL: AddPanelOptions = {
  id: "extensions",
  title: "Extensions",
  component: "extensions",
  renderer: "always",
  tabComponent: "extensionsTab",
};

const FLOW_PANEL: AddPanelOptions = {
  id: "flow",
  title: "New flow",
  component: "flow",
  renderer: "always",
  tabComponent: "flow",
};

const TERMINAL_PANEL: AddPanelOptions = {
  id: "terminal",
  title: "Terminal",
  component: "terminal",
  renderer: "always",
};

const DEBUG_FLOW_PANEL: AddPanelOptions = {
  id: "debugFlow",
  title: "Debug Flow",
  component: "debugFlow",
  renderer: "always",
};

const HORUS_SETTINGS_PANEL: AddPanelOptions = {
  id: "horusSettings",
  title: "Settings",
  component: "horusSettings",
  renderer: "always",
};

const HORUS_PLUGINS_PANEL: AddPanelOptions = {
  id: "horusPlugins",
  title: "Plugins",
  component: "horusPlugins",
  renderer: "always",
};

const HORUS_REMOTES_PANEL: AddPanelOptions = {
  id: "horusRemotes",
  title: "Remotes",
  component: "horusRemotes",
  renderer: "always",
};

const BLOCK_VARIABLES_PANEL: AddPanelOptions = {
  id: "blockVariables",
  title: "Block Variables",
  component: "blockVariables",
  renderer: "always",
  floating: false,
};

const BLOCK_VARIABLES_PANEL_EXTENSION: AddPanelOptions = {
  ...BLOCK_VARIABLES_PANEL,
  component: "blockVariablesExtension",
  renderer: "always",
};

const BLOCK_LOGS_PANEL: AddPanelOptions = {
  id: "blockLogs",
  title: "Block Logs",
  component: "blockLogs",
  renderer: "always",
  floating: false,
};

const CODE_EDITOR_PANEL: AddPanelOptions = {
  id: "codeEditor",
  title: "Code Editor",
  component: "codeEditor",
  renderer: "always",
  floating: false,
};

const FILE_EDITOR_PANEL: AddPanelOptions = {
  id: "fileEditor",
  title: "File Editor",
  component: "fileEditor",
  renderer: "always",
  floating: false,
};

const BLOCK_REGISTRY_PANEL: AddPanelOptions = {
  id: "blockRegistry",
  title: "Block Registry",
  component: "blockRegistry",
  renderer: "always",
  floating: false,
  position: {
    direction: "left",
  },
  minimumWidth: 300,
  maximumWidth: 300,
};

const MOLECULE_PLOTTER_PANEL: AddPanelOptions = {
  id: "moleculePlotter",
  title: "Molecule Plotter",
  component: "moleculePlotter",
  renderer: "always",
  tabComponent: "editableTab",
};

const BLOCK_EDITOR_PANEL: AddPanelOptions = {
  id: "blockEditor",
  title: "Block Editor",
  component: "blockEditor",
  renderer: "always",
};

// To be used in other components
export const PANEL_REGISTRY = {
  flow: FLOW_PANEL,
  debugFlow: DEBUG_FLOW_PANEL,
  molstar: MOLSTAR_PANEL,
  smiles: SMILES_PANEL,
  extensions: EXTENSIONS_PANEL,
  terminal: TERMINAL_PANEL,
  error: ERROR_PANEL,
  horusSettings: HORUS_SETTINGS_PANEL,
  horusPlugins: HORUS_PLUGINS_PANEL,
  horusRemotes: HORUS_REMOTES_PANEL,
  blockVariables: BLOCK_VARIABLES_PANEL,
  blockVariablesExtension: BLOCK_VARIABLES_PANEL_EXTENSION,
  blockLogs: BLOCK_LOGS_PANEL,
  codeEditor: CODE_EDITOR_PANEL,
  fileEditor: FILE_EDITOR_PANEL,
  blockRegistry: BLOCK_REGISTRY_PANEL,
  moleculePlotter: MOLECULE_PLOTTER_PANEL,
  blockEditor: BLOCK_EDITOR_PANEL,
};

// For DockApi
const PANELS: Record<string, AddPanelOptions> = Object.freeze(PANEL_REGISTRY);
const PANEL_ICONS: Record<string, ReactElement> = {
  molstar: <MolStarIcon />,
  smiles: <SmilesIcon />,
  terminal: <ConsoleIcon />,
  debugFlow: <LogFile />,
  extensions: <PluginsIcon />,
  horusSettings: <SettingsIcon />,
  horusPlugins: <PluginsIcon />,
  horusRemotes: <RemoteIcon />,
  blockVariables: <SettingsIcon />,
  blockVariablesExtension: <SettingsIcon />,
  blockLogs: <LogFile />,
  blockRegistry: <NewFlowIcon />,
  codeEditor: <CodeIcon />,
  fileEditor: <IconFile />,
  moleculePlotter: <PlotIcon />,
  blockEditor: <SettingsIcon />,
};

function FlowTab(props: IDockviewPanelHeaderProps) {
  const flowContext = useContext(FlowBuilderContext);

  const onPointerDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // If no title, set "Flow builder" as placeholder
  if (!props.api.title) {
    props.api.setTitle("Flow builder");
  }

  return (
    <span className="dv-default-tab">
      <DockviewDefaultTab {...props} hideClose />
      <FlowStatusView status={props.params?.status ?? FlowStatus.IDLE} />
      <div
        className="ml-2 dv-default-tab-action"
        onPointerDown={onPointerDown}
        onClick={() => {
          if (flowContext?.flow.isFlowActive) {
            alert("Cannot close the flow while it is active");
          } else {
            // Close also the block registry
            props.containerApi
              .getPanel(PANEL_REGISTRY.blockRegistry.id)
              ?.api.close();

            props.api.close();
          }
        }}
      >
        <CloseButton />
      </div>
    </span>
  );
}

function useTitle(api: DockviewPanelApi): string | undefined {
  const [title, setTitle] = useState<string | undefined>(api.title);

  useEffect(() => {
    const disposable = api.onDidTitleChange((event) => {
      setTitle(event.title);
    });

    return () => {
      disposable.dispose();
    };
  }, [api]);

  return title;
}

function EditableTitleTab(
  props: IDockviewPanelHeaderProps & { icon?: ReactElement }
) {
  const { api, ...rest } = props;

  const title = useTitle(api);

  const onClose = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      api.close();
    },
    [api]
  );

  const onPointerDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) {
        return;
      }

      api.setActive();
    },
    [api]
  );

  const [isEditing, setIsEditing] = useState(false);

  api.onDidActiveChange(() => {
    setIsEditing(false);
  });

  return (
    <div
      data-testid="dockview-dv-default-tab"
      {...rest}
      onClick={onClick}
      className="dv-default-tab gap-2"
    >
      {props.icon}
      {isEditing ? (
        <input
          autoFocus
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setIsEditing(false);
            }
          }}
          className="dv-default-tab-content italic underline"
          type="text"
          value={title}
          placeholder="Extension"
          onChange={(e) => api.setTitle(e.target.value)}
        />
      ) : (
        <span
          className="dv-default-tab-content"
          onClick={() => setIsEditing(true)}
        >
          {title}
        </span>
      )}

      <div
        className="dv-default-tab-action"
        onPointerDown={onPointerDown}
        onClick={onClose}
      >
        <CloseButton />
      </div>
    </div>
  );
}

function ExtensionsTab(
  props: Omit<IDockviewPanelHeaderProps, "params"> & { params: PluginPage }
) {
  const page = props.params;

  const [extensionIcon, setExtensionIcon] = useState<ReactElement>(
    <Chevron direction="right" />
  );

  useEffect(() => {
    if (page.logo) {
      setExtensionIcon(<img className="w-5 h-5" src={page.logo} alt="logo" />);
    } else {
      // Get the logo from the ID
      const pluginID = page?.url?.split("/").pop()?.split(".")[0];

      if (!pluginID) {
        return;
      }

      getPluginLogo({ pluginID }).then((logo) => {
        if (logo) {
          setExtensionIcon(<img className="w-5 h-5" src={logo} alt="logo" />);
        }
      });
    }
  }, [page]);

  return <EditableTitleTab {...props} icon={extensionIcon} />;
}

function BaseTab(props: IDockviewDefaultTabProps) {
  const icon = PANEL_ICONS[props.api.component] ?? null;
  return (
    <span className="dv-default-tab flex flex-row gap-2">
      {icon}
      <DockviewDefaultTab {...props} />
    </span>
  );
}

function ConfirmCloseTab(props: IDockviewDefaultTabProps) {
  const flowContext = useContext(FlowBuilderContext);

  const onPointerDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const confirmClose = async () => {
    if (flowContext?.flow.isFlowActive) {
      alert(`Cannot close this tab while the flow is active.`);
      return;
    }

    if (await confirm(`Are you sure you want to close this tab?`)) {
      props.api.close();
    }
  };

  return (
    <span className="dv-default-tab">
      <BaseTab {...props} hideClose />
      <div
        className="ml-2 dv-default-tab-action"
        onPointerDown={onPointerDown}
        onClick={confirmClose}
      >
        <CloseButton />
      </div>
    </span>
  );
}

const headerComponents = {
  extensionsTab: ExtensionsTab,
  editableTab: (props: IDockviewPanelHeaderProps) => {
    const icon = PANEL_ICONS[props.api.component];
    return <EditableTitleTab {...props} icon={icon} />;
  },
  flow: FlowTab,
  confirmClose: ConfirmCloseTab,
  default: BaseTab,
};

export function addBlockRegistryGroup(api: DockviewApi) {
  return api.addPanel({
    ...BLOCK_REGISTRY_PANEL,
    floating: false,
    position: {
      referenceGroup: api.addGroup({
        ...BLOCK_REGISTRY_PANEL,
        referencePanel: FLOW_PANEL.id,
        locked: true,
      }),
    },
  });
}

async function defaultConfig({
  urlProps,
  api,
}: {
  urlProps: any;
  api: DockviewApi;
}) {
  if (urlProps.has("new") || urlProps.has("open")) {
    api.addPanel(FLOW_PANEL);
  }

  if (urlProps.has("new")) {
    addBlockRegistryGroup(api);
  }

  if (urlProps.get("terminal") === "true") {
    api.addPanel(TERMINAL_PANEL);
  }

  if (urlProps.has("smiles")) {
    api.addPanel(SMILES_PANEL);
  }

  const molHidden = window?.horusSettings?.["molstarHidden"]?.value;
  if (urlProps.has("molstar") || !molHidden) {
    api.addPanel({ ...MOLSTAR_PANEL, inactive: !urlProps.has("molstar") });
  }
  if (urlProps.has("ext")) {
    const page: PluginPage = {
      name: urlProps.get("ext"),
      url: urlProps.get("url"),
    };

    api.addPanel({ ...EXTENSIONS_PANEL, params: page });
  }
}

function ExtensionComponent(props: IDockviewPanelProps) {
  // Opening it from a block action yields a socket event
  const page = props.params as PluginPage;

  props.api.setTitle(page.name ?? "Unnamed");

  const onFocus = () => {
    // Continue the default onfocus
    props.params?.onFocus?.();
  };

  return (
    <IFrameLoader
      page={page}
      data={page.data}
      onFocus={onFocus}
      panelApi={props.api}
      onLoad={props.params?.onLoad}
    />
  );
}
type DockView = FunctionComponent<IDockviewPanelProps>;
const components: Record<string, DockView> = {
  molstar: Molstar as DockView,
  smiles: SmilesGrid,
  terminal: HorusTerm,
  flow: FlowBuilderView,
  debugFlow: DebugFlow,
  horusSettings: SettingsView as DockView,
  horusPlugins: PluginManager,
  horusRemotes: ConfigRemotes,
  blockRegistry: BlockRegistry,
  moleculePlotter: (props: IDockviewPanelProps) => {
    return <MoleculePlotter smilesToPlot={props.params.smilesToPlot} />;
  },
  codeEditor: (props: IDockviewPanelProps) => {
    return <Editor {...props.params} />;
  },
  fileEditor: (props: IDockviewPanelProps) => {
    return <HorusFileEditor dockApi={props.api} params={props.params} />;
  },
  blockVariables: (props: IDockviewPanelProps) => {
    // Set the panel title to the block name
    props.api.setTitle(
      `${props.params.block.name} - Block ${props.params.block.placedID}`
    );

    const key = `${props.params.block.id}-${props.params.block.placedID}`;

    return (
      <VariableSetupView
        key={key}
        block={props.params.block}
        handleVariableChange={props.params.handleVariableChange}
      />
    );
  },
  blockVariablesExtension: ExtensionComponent,
  blockLogs: (props: IDockviewPanelProps) => {
    // Set the panel title to the block name
    props.api.setTitle(
      `${props.params.block.name} - Block ${props.params.block.placedID}`
    );

    return <BlockLogsView block={props.params.block} />;
  },
  extensions: ExtensionComponent,
  error: () => <Error error="View not found" />,
  blockEditor: (props: IDockviewPanelProps) => {
    // Update the title of the tab to the block ID
    props.api.setTitle(
      `Block Editor - ${props.params?.block?.id || "New Block"}`
    );

    return (
      <BlockEditor
        block={props.params.block}
        onBlockChange={(newBlock) => {
          props.api.setTitle(`Block Editor - ${newBlock.id || "New Block"}`);
        }}
      />
    );
  },
};

type PanelFunctions = {
  dockApi?: DockviewApi | null;
  component: string;
  panelID?: string;
  noFocus?: boolean;
  params?: any;
  title?: string;
};

export function addPanel({
  dockApi,
  component,
  panelID,
  noFocus,
  params,
  title,
}: PanelFunctions) {
  if (!dockApi) {
    return;
  }

  // If the panel with the id already exists, focus it
  const newPanelID =
    panelID ?? `${component}-${Math.floor(Math.random() * 100000)}`;
  const exists = dockApi.getPanel(newPanelID);
  if (exists) {
    !noFocus && exists.focus();
    return;
  }

  const panel = PANELS[component] ?? ERROR_PANEL;
  panel.title = title ?? panel.title;

  const panelToAdd = {
    ...panel,
    id: newPanelID,
    params: params,
    inactive: noFocus,
    floating: panel.floating ?? false,
    position: panel.position,
  };

  const referencePanel = dockApi.getPanel(FLOW_PANEL.id);
  if (referencePanel && !panelToAdd.position) {
    panelToAdd.position = {
      referencePanel: referencePanel,
    };
  }

  return dockApi.addPanel(panelToAdd as AddPanelOptions);
}

export function togglePanel({
  dockApi,
  component,
  panelID,
  params,
  title,
}: PanelFunctions & { panelID: string }): ReturnType<typeof addPanel> | void {
  if (!dockApi) {
    return;
  }

  const panel = dockApi.getPanel(panelID);

  if (panel) {
    dockApi.removePanel(panel);
  } else {
    // For the blockregistry, add the group instead
    if (component === BLOCK_REGISTRY_PANEL.component) {
      return addBlockRegistryGroup(dockApi);
    }

    return addPanel({ dockApi, component, panelID, params, title });
  }
}

export function closeAllPanels({ dockApi }: { dockApi: DockviewApi | null }) {
  dockApi?.panels.map((panel) => {
    if (panel.id === "flow") {
      panel.focus();
    } else {
      dockApi.removePanel(panel);
    }
  });
}

export const FlowBuilderContext = createContext<FlowBuilderHooks | null>(null);

type DockContextType = {
  dockApi: DockviewApi | null;
};
export const DockContext = createContext<DockContextType>({
  dockApi: null,
});

const Icon = (props: {
  icon: ReactElement;
  title?: string;
  onClick?: (event: React.MouseEvent) => void;
}) => {
  return (
    <div
      title={props.title}
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "30px",
        height: "100%",
        color: "black",
        fontSize: "18px",
      }}
      onClick={props.onClick}
    >
      <span
        style={{ fontSize: "inherit", cursor: "pointer" }}
        className="material-symbols-outlined"
      >
        {props.icon}
      </span>
    </div>
  );
};

function MaximizeComponent(props: IDockviewHeaderActionsProps) {
  const [maximized, setMaximized] = useState<boolean>(props.api.isMaximized());

  useEffect(() => {
    const disposable = props.containerApi.onDidMaximizedGroupChange(() => {
      setMaximized(props.api.isMaximized());
    });

    return () => {
      disposable.dispose();
    };
  }, [props.containerApi, props.api]);

  const onClick = () => {
    if (maximized) {
      props.api.exitMaximized();
    } else {
      props.api.maximize();
    }
  };

  // For the block registry panel, do not show the maximize button
  if (props.group.id === BLOCK_REGISTRY_PANEL.id) {
    return null;
  }

  return (
    <div style={{ height: "100%", color: "white", padding: "0px 4px" }}>
      <Icon
        onClick={onClick}
        icon={maximized ? <MinimizeIcon /> : <MaximizeIcon />}
      />
    </div>
  );
}

const WatermarkComponent = () => {
  const { dockApi } = useContext(DockContext);

  return (
    <div className="flex justify-center gap-2 h-full items-center flex-col">
      <span>No views opened</span>
      <AppButton
        action={() => {
          addPanel({
            dockApi: dockApi,
            component: PANEL_REGISTRY.flow.component,
            panelID: PANEL_REGISTRY.flow.id,
          });
        }}
      >
        Open the flow panel
      </AppButton>
    </div>
  );
};

export function handleExtensionPanelCreation({
  dockApi,
  extension,
  placedID,
}: {
  dockApi: DockviewApi | null;
  extension: PluginPage & { pageID?: string; pluginID?: string };
  placedID?: number;
}) {
  // Special case for opening files with the Horus File Editor
  if (extension?.pluginID === "horus" && extension?.pageID === "load_file") {
    addPanel({
      dockApi: dockApi,
      component: PANEL_REGISTRY.fileEditor.component,
      panelID: `fileEditor-${placedID}-${extension.dataID}`,
      title: extension.name,
      params: {
        ...extension.data,
        title: extension.name,
        placedID: placedID,
      },
    });
    return;
  }

  addPanel({
    dockApi: dockApi,
    component: PANEL_REGISTRY.extensions.component,
    panelID: `extensions-${placedID}-${extension.dataID}`,
    params: {
      ...extension,
      placedID: placedID,
    },
  });
}

export function HorusPanelView() {
  // The flow context will be defined here as the flow is what controls everything (only one flow at a time)

  const [dockApi, setDockApi] = useState<DockviewApi | null>(null);

  const flowBuilderState = useFlowBuilder({ dockApi });

  const onReady = (event: DockviewReadyEvent) => {
    const dockApi = event.api;

    event.api.onWillDragPanel((e) => {
      if (e.panel.id === BLOCK_REGISTRY_PANEL.id) {
        e.nativeEvent.preventDefault();
      }
    });

    event.api.onWillDrop((e) => {
      // Get the dragged panel
      const dragged = e.getData();

      // This will prevent the block registry panel being draged to other panels and also prevent other panels being draged to the block registry group
      if (
        e.group?.id === BLOCK_REGISTRY_PANEL.id ||
        dragged?.groupId === BLOCK_REGISTRY_PANEL.id ||
        dragged?.panelId === BLOCK_REGISTRY_PANEL.id ||
        e.panel?.id === BLOCK_REGISTRY_PANEL.id
      ) {
        e.preventDefault();
      }
    });

    window.horus.openPanel = (type, id?, params?) => {
      // If of type extensions, we need to reconstruct the url of the
      // extension with the pluginID + extensionID
      if (type === "extensions" && params) {
        const incomingParams = params as PluginPage;
        params = {
          ...incomingParams,
          url: `/plugins/pages/${incomingParams?.plugin}.${incomingParams?.id}`,
        } as PluginPage;
      }

      addPanel({
        dockApi: dockApi,
        component:
          PANEL_REGISTRY[type].component ?? PANEL_REGISTRY.error.component,
        panelID:
          (id as string) || PANEL_REGISTRY[type].id || PANEL_REGISTRY.error.id,
        params: params,
      });
    };

    window.horus.closePanel = (id) => {
      const panel = dockApi?.getPanel(id);
      if (panel) {
        dockApi.removePanel(panel);
      }
    };

    // Add a new function to open the file editor
    window.horus.openFileInEditor = ({
      name,
      path,
      readOnly,
      format,
    }: {
      path: string;
      name?: string;
      readOnly?: boolean;
      format?: string;
    }) => {
      addPanel({
        dockApi: dockApi,
        component: PANEL_REGISTRY.fileEditor.component,
        panelID: `fileEditor-${path}`,
        title: name ?? path.split("/").pop() ?? "File",
        params: {
          title: name,
          path,
          readOnly,
          format,
        },
      });
    };

    setDockApi(dockApi);

    // Setup the hooks before loading the default panels
    hooksInitializer();

    // Load the default ocnfiguration
    const urlProps = new URLSearchParams(location.search);
    defaultConfig({ urlProps, api: event.api });
  };

  useEffect(() => {
    if (!dockApi) {
      return;
    }

    const togglePanelEventListener = (e: any) => {
      togglePanel({
        dockApi: dockApi,
        component: e.detail.component,
        panelID: e.detail.panelID,
        noFocus: e.detail.noFocus,
        params: e.detail.params,
      });
    };

    const addPanelEventListener = (e: any) => {
      addPanel({
        dockApi: dockApi,
        component: e.detail.component,
        panelID: e.detail.panelID,
        noFocus: e.detail.noFocus,
        params: e.detail.params,
      });
    };

    const addExtensions = (e: PluginPageExtensionEvent) => {
      // Only add the extension if the current flow is the opened one
      if (
        e?.bypass !== true &&
        flowBuilderState.flow.flow.savedID !== e.savedID
      ) {
        return;
      }

      handleExtensionPanelCreation({
        dockApi,
        extension: e,
        placedID: e.placedID,
      });
    };

    window.horus.addExtensions = addExtensions;

    document.addEventListener("addPanel", addPanelEventListener);
    document.addEventListener("togglePanel", togglePanelEventListener);
    socket.on("openExtension", addExtensions);

    return () => {
      document.removeEventListener("addPanel", addPanelEventListener);
      document.removeEventListener("togglePanel", togglePanelEventListener);
      socket.off("openExtension", addExtensions);
    };
  }, [dockApi, flowBuilderState.flow.flow.savedID]);

  return (
    <DndContext
      onDragEnd={flowBuilderState.dnd.handleDragEnd}
      onDragStart={flowBuilderState.dnd.handleDragStart}
      collisionDetection={pointerWithin}
      sensors={flowBuilderState.dnd.dndTweaks.sensors}
      measuring={flowBuilderState.dnd.dndTweaks.measuring}
    >
      <DockContext.Provider
        value={{
          dockApi: dockApi,
        }}
      >
        <FlowBuilderContext.Provider value={flowBuilderState}>
          <HorusToolbar />
          <div>
            <DockviewReact
              components={components}
              tabComponents={headerComponents}
              watermarkComponent={WatermarkComponent}
              defaultTabComponent={headerComponents.default}
              rightHeaderActionsComponent={MaximizeComponent}
              onReady={onReady}
              theme={themeLight}
            />
          </div>
          {
            // If there is a block being dragged, show it
            flowBuilderState.dnd.draggingBlock &&
              !flowBuilderState.dnd.draggingBlock.isPlaced && (
                <DragOverlay
                  modifiers={[snapCenterToCursor]}
                  dropAnimation={null}
                  style={{ cursor: "grabbing !important" }}
                >
                  <BlockView
                    extraStyle={{ maxWidth: "300px" }}
                    block={flowBuilderState.dnd.draggingBlock}
                    blockHooks={flowBuilderState.block}
                    onAir={true}
                  />
                </DragOverlay>
              )
          }
          <ModalContainer flowBuilderState={flowBuilderState} />
          <ServerFileExplorerContainers flowBuilderState={flowBuilderState} />
        </FlowBuilderContext.Provider>
      </DockContext.Provider>
    </DndContext>
  );
}

// Utility function to initialize some useful hooks for the webpacke
export function hooksInitializer() {
  // Create a function that laoids the molstar panel if it does not exits
  if (!isMolstarLoaded(window.molstar)) {
    const hookFunction: LoadMoleculeFileType = async (file, options) => {
      // Open the panel
      window.horus?.openPanel?.("molstar");

      // Wait till molstar is opened
      while (!isMolstarLoaded(window.molstar)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Open the file
      return window.molstar?.loadMoleculeFile(file, options);
    };

    window.molstar = {
      loadMoleculeFile: hookFunction,
    };
  }
}
