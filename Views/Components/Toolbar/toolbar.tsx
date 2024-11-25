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
import { useCallback, useContext, useEffect } from "react";

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
    togglePanel({
      dockApi: dockApi,
      component: PANEL_REGISTRY.smiles.component,
      panelID: PANEL_REGISTRY.smiles.id,
    });
  }, [dockApi]);

  const toggleMolstar = useCallback(() => {
    togglePanel({
      dockApi: dockApi,
      component: PANEL_REGISTRY.molstar.component,
      panelID: PANEL_REGISTRY.molstar.id,
    });
  }, [dockApi]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      let isModifierKeyPressed = false;
      let isShiftKeyPressed = false;
      if (event.getModifierState) {
        isModifierKeyPressed = event.getModifierState(modifierKey);
        isShiftKeyPressed = event.getModifierState(shiftKey);
      }

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
      link: "/",
      onClick: async () => {
        if (flowContext && !flowContext.flow.saved) {
          if (
            !(await horusConfirm(
              "The current flow is not saved. Are you sure you want to continue?"
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
          name: "New",
          keyShortcut: `${modifierKeyLogo}N`,
          svgPath: <NewFlowIcon />,
          onClick: () => {
            shortcuts.handleNewFlow();
          },
        },
        {
          name: "Open",
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
          name: "Save",
          keyShortcut: `${modifierKeyLogo}S`,
          svgPath: <SaveIcon />,
          onClick: () => {
            shortcuts.preHandleSave();
          },
        },
        {
          name: "Save as...",
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
          name: "Clean recents",
          hidden: window.horusInternal.mode === "webapp",
          svgPath: <TrashLines />,
          onClick: async () => {
            if (
              !(await horusConfirm(
                "Are you sure you want to clean the recent flows?"
              ))
            ) {
              return;
            }

            // Emit a save event
            const response = await horusGet("/api/cleanrecents");

            if (!response) {
              await horusAlert("Error cleaning recents");
              return;
            }

            const data = await response.json();

            if (!data.ok) {
              await horusAlert("Error cleaning recents: " + data.msg);
              return;
            }
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
          name: "Toggle Mol*",
          onClick: () => {
            togglePanel({
              dockApi: dockApi,
              component: "molstar",
              panelID: "molstar",
            });
          },
          svgPath: <MolStarIcon />,
          // Set a keyShortcut to enable keyboard navigation.
          keyShortcut: `${modifierKeyLogo}${shiftKeyLogo}M`,
        },
        {
          name: "Toggle SMILES",
          svgPath: <SmilesIcon />,
          onClick: () => {
            togglePanel({
              dockApi: dockApi,
              component: "smiles",
              panelID: "smiles",
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
            const centerEvent = new CustomEvent("centerView");
            window.dispatchEvent(centerEvent);
          },
          svgPath: <CenterView />,
        },
        {
          name: "Reset flow",
          onClick: () => {
            const centerEvent = new CustomEvent("resetFlow");
            window.dispatchEvent(centerEvent);
          },
        },
        {
          name: "Pause flow",
          svgPath: <PausedIcon />,
          onClick: () => {
            const centerEvent = new CustomEvent("pauseFlow");
            window.dispatchEvent(centerEvent);
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
                  Math.random() * 100000
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
              panelID: "horusPlugins",
              component: "horusPlugins",
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
              panelID: "horusRemotes",
              component: "horusRemotes",
            });
          },
        },
        {
          name: "Settings",
          svgPath: <SettingsIcon />,
          onClick: () => {
            togglePanel({
              dockApi: dockApi,
              panelID: "horusSettings",
              component: "horusSettings",
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
