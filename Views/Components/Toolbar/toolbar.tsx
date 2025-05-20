import { useCallback, useContext, useEffect } from "react";

// Horus components
import { usePluginPages } from "./extensions_list";
import { ToolBarItemProps, ToolbarMenu, ToolBarMenuProps } from "./ToolbarItem";
import { HorusSearch } from "./ToolbarSearch";

// Context
import {
  addPanel,
  closeAllPanels,
  DockContext,
  FlowBuilderContext,
  PANEL_REGISTRY,
  togglePanel,
} from "../MainApp/PanelView";
import { useFlowShortcuts } from "../FlowBuilder/flow.hooks";

// Icons
import NewFlowIcon from "./Icons/New";
import OpenFlowIcon from "./Icons/Open";
import MolStarIcon from "./Icons/MolStar";
import Chevron from "./Icons/Chevron";
import LogFile from "./Icons/LogFile";
import SaveIcon from "./Icons/Save";
import SaveAsIcon from "./Icons/SaveAs";
import CreateFolderIcon from "./Icons/CreateFolder";
import TrashLines from "./Icons/TrashLines";
import BackArrow from "./Icons/Undo";
import ForwardArrow from "./Icons/Redo";
import CenterView from "./Icons/CenterView";
import ConsoleIcon from "./Icons/Console";
import TemplateIcon from "./Icons/Template";
import PausedIcon from "./Icons/Paused";
import CrossIcon from "./Icons/Cross";
import SettingsIcon from "./Icons/Settings";
import RemoteIcon from "./Icons/Remote";
import PluginsIcon from "./Icons/Plugins";

// Horus web-server utils
import { horusGet } from "../../Utils/utils";

// Styles
import "../appbutton.css";
import "./toolbar.css";

// Other
import { useConfirm } from "../HorusPrompt/horus_confirm";
import { useAlert } from "../HorusPrompt/horus_alert";
import { navigateTo } from "@/Utils/navigationService";
import SmilesIcon from "./Icons/Smiles";
import StopIcon from "./Icons/Stop";
import { queryClient } from "@/Main";

// Define the logos for the shortcuts
const modifierKeyLogo: string = navigator.userAgent.includes("Mac")
  ? "⌘ "
  : "Ctrl + ";
const shiftKeyLogo: string = navigator.userAgent.includes("Mac")
  ? "⇧ "
  : "Shift + ";

// Define the actual key to listen to
export const modifierKey: string = navigator.userAgent.includes("Mac")
  ? "Meta"
  : "Control";
export const shiftKey: string = "Shift";

export default function HorusToolbar() {
  // This is the toolbar component
  // Will lie on top of the page and will contain the
  // user menu, search bar, etc.

  const pages = usePluginPages();

  const horusAlert = useAlert();
  const horusConfirm = useConfirm();

  const { dockApi } = useContext(DockContext)!;
  const flowContext = useContext(FlowBuilderContext);
  const shortcuts = useFlowShortcuts();

  // Panel-related shortcuts
  const toggleConsole = useCallback(() => {
    togglePanel({
      dockApi: dockApi,
      component: PANEL_REGISTRY.terminal.component,
      panelID: PANEL_REGISTRY.terminal.id,
    });
  }, [dockApi]);

  const toggleSmiles = useCallback(() => {
    addPanel({
      dockApi: dockApi,
      component: PANEL_REGISTRY.smiles.component,
      panelID: PANEL_REGISTRY.smiles.id,
    });
  }, [dockApi]);

  const toggleMolstar = useCallback(() => {
    addPanel({
      dockApi: dockApi,
      component: PANEL_REGISTRY.molstar.component,
      panelID: PANEL_REGISTRY.molstar.id,
    });
  }, [dockApi]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      let isModifierKeyPressed = false;
      let isShiftKeyPressed = false;
      if (!event.getModifierState) return;

      isModifierKeyPressed = event.getModifierState(modifierKey);
      isShiftKeyPressed = event.getModifierState(shiftKey);

      if (!isModifierKeyPressed && !isShiftKeyPressed) return;

      // Open flow
      if (event.code === "KeyO" && isModifierKeyPressed) {
        event.preventDefault();
        shortcuts.handleOpenFlow();
      }
      // Redo
      if (event.code === "KeyZ" && isModifierKeyPressed && isShiftKeyPressed) {
        event.preventDefault();
        shortcuts.handleRedo();
      }
      // Undo
      if (event.code === "KeyZ" && isModifierKeyPressed && !isShiftKeyPressed) {
        event.preventDefault();
        shortcuts.handleUndo();
      }
      // Save as
      if (event.code === "KeyS" && isModifierKeyPressed && isShiftKeyPressed) {
        event.preventDefault();
        shortcuts.handleSaveAs();
      }
      // Save
      if (event.code === "KeyS" && isModifierKeyPressed) {
        event.preventDefault();
        shortcuts.preHandleSave();
      }
      // New flow
      if (event.code === "KeyN" && isModifierKeyPressed) {
        event.preventDefault();
        shortcuts.handleNewFlow();
      }
      // * Panel related key shortcuts * //
      // Toggle console
      if (event.code === "KeyK" && isModifierKeyPressed) {
        event.preventDefault();
        toggleConsole();
      }
      // Toggle Molstar
      if (event.code === "KeyM" && isModifierKeyPressed && isShiftKeyPressed) {
        event.preventDefault();
        toggleMolstar();
      }
      // Toggle SMILES
      if (event.code === "KeyL" && isModifierKeyPressed && isShiftKeyPressed) {
        event.preventDefault();
        toggleSmiles();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dockApi, shortcuts, toggleConsole, toggleMolstar, toggleSmiles]);

  const menus: ToolBarMenuProps[] = [
    {
      name: "Home",
      onClick: async () => {
        if (flowContext && !flowContext.flow.saved) {
          if (
            !(await horusConfirm(
              "The current flow is not saved. Are you sure you want to continue?",
            ))
          ) {
            return;
          }
        }

        navigateTo("/");
      },
    },
    {
      name: "File",
      items: [
        {
          name: "New flow",
          keyShortcut: `${modifierKeyLogo}N`,
          svgPath: <NewFlowIcon />,
          onClick: () => {
            shortcuts.handleNewFlow();
          },
        },
        {
          name: "Open flow",
          hidden: window.horusInternal.mode === "webapp",
          svgPath: <OpenFlowIcon />,
          keyShortcut: `${modifierKeyLogo}O`,
          onClick: () => {
            // Emit an event "openFlow"
            // This event will be captured by the flowReciever component
            // and will open the flow
            shortcuts.handleOpenFlow();
          },
        },
        {
          name: "Save flow",
          keyShortcut: `${modifierKeyLogo}S`,
          svgPath: <SaveIcon />,
          onClick: () => {
            shortcuts.preHandleSave();
          },
        },
        {
          name: "Save flow as...",
          keyShortcut: `${modifierKeyLogo}${shiftKeyLogo}S`,
          svgPath: <SaveAsIcon />,
          onClick: () => {
            shortcuts.handleSaveAs();
          },
        },
        {
          name: "Save template",
          svgPath: <TemplateIcon />,
          onClick: () => {
            shortcuts.handleSaveTemplate();
          },
        },
        {
          name: "File explorer",
          hidden:
            window.horusInternal.mode !== "server" &&
            window.horusInternal.mode !== "webapp",
          svgPath: <CreateFolderIcon />,
          onClick: () => {
            shortcuts.toggleFileExplorer();
          },
        },
        {
          name: "Open a file",
          onClick: () => {
            addPanel({
              dockApi: dockApi,
              component: PANEL_REGISTRY.fileEditor.component,
              panelID: `${PANEL_REGISTRY.fileEditor.id + Math.random()}`,
            });
          },
          svgPath: <LogFile />,
        },
        {
          name: "Clean recents",
          hidden: window.horusInternal.mode === "webapp",
          svgPath: <TrashLines />,
          onClick: async () => {
            if (
              !(await horusConfirm(
                "Are you sure you want to clean the recent flows?",
              ))
            ) {
              return;
            }

            horusGet("/api/cleanrecents")
              .then((r) => r.json())
              .then((data) => {
                if (!data.ok) {
                  throw new Error(data.msg);
                }

                queryClient.invalidateQueries({ queryKey: ["recentFlows"] });
              })
              .catch((e) => {
                horusAlert("Error cleaning recents: " + e);
              });
          },
        },
      ],
    },
    {
      name: "Edit",
      items: [
        {
          name: "Undo",
          onClick: () => {
            // Emit an event "undo"
            // This event will be captured by the flowReciever component
            // and will undo the last action
            shortcuts.handleUndo();
          },
          keyShortcut: `${modifierKeyLogo}Z`,
          svgPath: <BackArrow />,
        },
        {
          name: "Redo",
          onClick: () => {
            shortcuts.handleRedo();
          },
          keyShortcut: `${modifierKeyLogo}${shiftKeyLogo}Z`,
          svgPath: <ForwardArrow />,
        },
      ],
    },
    {
      name: "View",
      items: [
        {
          name: "Close all panels",
          svgPath: <CrossIcon />,
          onClick: () => {
            closeAllPanels({ dockApi });
          },
        },
        {
          name: "Open block registry",
          onClick: () => {
            addPanel({
              dockApi: dockApi,
              component: PANEL_REGISTRY.blockRegistry.component,
              panelID: PANEL_REGISTRY.blockRegistry.id,
            });
          },
          svgPath: <NewFlowIcon />,
        },
        {
          name: "Open flow panel",
          onClick: () => {
            addPanel({
              dockApi: dockApi,
              component: PANEL_REGISTRY.flow.component,
              panelID: PANEL_REGISTRY.flow.id,
            });
          },
          // Set a keyShortcut to enable keyboard navigation.
          keyShortcut: `${modifierKeyLogo}${shiftKeyLogo}M`,
        },
        {
          name: "Open Mol*",
          onClick: () => {
            addPanel({
              dockApi: dockApi,
              component: PANEL_REGISTRY.molstar.component,
              panelID: PANEL_REGISTRY.molstar.id,
            });
          },
          svgPath: <MolStarIcon />,
          // Set a keyShortcut to enable keyboard navigation.
          keyShortcut: `${modifierKeyLogo}${shiftKeyLogo}M`,
        },
        {
          name: "Open SMILES",
          svgPath: <SmilesIcon />,
          onClick: () => {
            addPanel({
              dockApi: dockApi,
              component: PANEL_REGISTRY.smiles.component,
              panelID: PANEL_REGISTRY.smiles.id,
            });
          },
          // Set a keyShortcut to enable keyboard navigation.
          keyShortcut: `${modifierKeyLogo}${shiftKeyLogo}L`,
        },
        {
          name: "Toggle console",
          onClick: () => {
            toggleConsole();
          },
          svgPath: <ConsoleIcon />,
          // Set a keyShortcut to enable keyboard navigation.
          keyShortcut: `${modifierKeyLogo}K`,
        },
      ],
    },
    {
      name: "Flow",
      items: [
        {
          name: "Center view",
          onClick: () => {
            shortcuts.centerView();
          },
          svgPath: <CenterView />,
        },
        {
          name: "Reset flow",
          onClick: () => {
            shortcuts.resetFlow();
          },
        },
        {
          name: "Pause flow",
          svgPath: <PausedIcon />,
          onClick: () => {
            shortcuts.pauseFlow();
          },
        },
        {
          name: "Stop flow",
          svgPath: <StopIcon />,
          onClick: () => {
            shortcuts.stopFlow();
          },
        },
        {
          name: "Debug flow",
          hidden: !window.horusInternal.debug,
          onClick: () => {
            togglePanel({
              dockApi: dockApi,
              panelID: "debug",
              component: "debugFlow",
            });
          },
          svgPath: <LogFile />,
        },
      ],
    },
    {
      name: "Extensions",
      items: [
        // {
        //   name: "Close extensions",
        //   svgPath: <EyeDashIcon />,
        //   keyShortcut: `${modifierKeyLogo}E`,
        //   onClick: hideExtensions,
        // },
        ...pages.map((page) => {
          return {
            name: page.name,
            svgPath: page.logo ? (
              <img src={page.logo} className="w-5 h-5" />
            ) : (
              <Chevron
                direction="right"
                style={{
                  transform: "translateX(-2px)",
                }}
              />
            ),
            onClick: () => {
              addPanel({
                dockApi: dockApi,
                component: PANEL_REGISTRY.extensions.component,
                panelID: `extensions-${page.id}-${Math.floor(
                  Math.random() * 100000,
                )}`,
                params: page,
              });
            },
          } as ToolBarItemProps;
        }),
      ],
    },
    {
      name: "Horus",
      items: [
        {
          name: "Plugins",
          svgPath: <PluginsIcon />,
          hidden: !!window.horusInternal.webApp,
          onClick: () => {
            togglePanel({
              dockApi: dockApi,
              panelID: PANEL_REGISTRY.horusPlugins.id,
              component: PANEL_REGISTRY.horusPlugins.component,
            });
          },
        },
        {
          name: "Remotes",
          svgPath: <RemoteIcon />,
          hidden: window.horusInternal.webApp?.allowRemotes == false,
          onClick: () => {
            togglePanel({
              dockApi: dockApi,
              panelID: PANEL_REGISTRY.horusRemotes.id,
              component: PANEL_REGISTRY.horusRemotes.component,
            });
          },
        },
        {
          name: "Settings",
          svgPath: <SettingsIcon />,
          onClick: () => {
            togglePanel({
              dockApi: dockApi,
              panelID: PANEL_REGISTRY.horusSettings.id,
              component: PANEL_REGISTRY.horusSettings.component,
            });
          },
        },
      ],
    },
  ];

  return (
    <div className="flex flex-row justify-between items-center toolbar">
      <div className="flex flex-row gap-1 ml-1 mr-1 h-full">
        {menus.map((menu, index) => (
          <ToolbarMenu key={index} {...menu} />
        ))}
      </div>
      <div className="mr-1">
        <HorusSearch pages={pages} />
      </div>
    </div>
  );
}
