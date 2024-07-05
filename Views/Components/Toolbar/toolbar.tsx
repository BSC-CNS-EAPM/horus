// Desc: This is the toolbar component

// React
import { ChangeEvent, Fragment, useEffect, useState } from "react";

// Useful components from HeadlessUI
import { Menu, Transition } from "@headlessui/react";

// Horus components
import RotatingLines from "../RotatingLines/rotatinglines";
import SplashScreen from "../MainApp/welcome_screen";
import RecentUserFlows, {
  PredefinedFlows,
  openFlow,
  useGetRecentFlows,
} from "../FlowStatus/recent_flows";
import PluginPagesView, { loadPage, usePluginPages } from "./extensions_list";

// Icons
import NewFlowIcon from "./Icons/New";
import OpenFlowIcon from "./Icons/Open";
import MolStarIcon from "./Icons/MolStar";
import EyeDashIcon from "./Icons/EyeDash";
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

// Horus web-server utils
import { horusGet } from "../../Utils/utils";

// Styles
import "../appbutton.css";
import "./toolbar.css";

// Types
import { Flow, PluginPage } from "../FlowBuilder/flow.types";
interface ToolBarItemProps {
  name: string;
  hidden?: boolean;
  link?: string;
  svgPath?: React.ReactNode;
  onClick?: () => void;
  keyShortcut?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

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

function ToolBarItem(props: ToolBarItemProps) {
  const [active, setActive] = useState(false);

  const handleMouseOver = () => {
    setActive(true);
  };

  const handleMouseLeave = () => {
    setActive(false);
  };

  const [isOpen, setIsOpen] = useState(false);

  // If the path is the same as the link, then the button is active
  useEffect(() => {
    if (window.location.pathname === props.link) {
      setIsOpen(true);
    }
  }, [props.link]);

  return (
    <div
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
      className={
        "toolbar-item" + (props.disabled ? " toolbar-item-disabled" : "")
      }
      onClick={async () => {
        props.onClick?.();
      }}
    >
      {props.svgPath && (
        <MenuIcon active={active || isOpen} svgPath={props.svgPath} />
      )}
      <div className="cut-text">{props.name}</div>
      {props.children}
      {props.keyShortcut ? (
        <div className="ml-auto toolbar-item-key-shortcut">
          {props.keyShortcut}
        </div>
      ) : (
        <></>
      )}
    </div>
  );
}

export interface ToolBarMenuProps {
  name: string;
  hidden?: boolean;
  svgPath?: React.ReactNode;
  items?: ToolBarItemProps[];
  link?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
}

export function ToolbarMenu(props: ToolBarMenuProps) {
  if (props.hidden) {
    return <></>;
  }

  return (
    <div className="h-full">
      {props.link || props.onClick ? (
        <ToolBarItem {...props} />
      ) : (
        <Menu>
          <Menu.Button className={"h-full"}>
            <ToolBarItem {...props} />
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items
              className="absolute p-md-2 mt-3 w-56 origin-top-left rounded-xl bg-white toolbar-menu outline-none overflow-y-scroll"
              style={{
                maxHeight: "calc(100vh - 4rem)",
                width: "auto",
              }}
            >
              {/* // Here the items will be rendered */}
              {props.items?.map((item) =>
                item.hidden ? null : (
                  <Menu.Item key={item.name}>
                    {({ close }) => (
                      <ToolBarItem
                        key={item.name}
                        {...item}
                        onClick={() => {
                          item.onClick?.();
                          close();
                        }}
                      />
                    )}
                  </Menu.Item>
                )
              )}
            </Menu.Items>
          </Transition>
        </Menu>
      )}
    </div>
  );
}

interface IconProps {
  active: boolean;
  svgPath: React.ReactNode;
}

const MenuIcon = ({ active, svgPath }: IconProps) => {
  // Colors of the stroke
  const strokeColor = active ? "#1A56DB" : "#1A56DB";

  // Color of the fill
  const fillColor = "transparent";

  // If the svgPath provided is directly a <svg> element, then we return it
  if (typeof svgPath === "object") {
    return svgPath;
  }

  return (
    <svg
      viewBox="0 0 20 20"
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth="2"
      className="mr-2 h-5 w-5"
      aria-hidden="true"
    >
      {svgPath}
    </svg>
  );
};

interface SearchProps {
  placeholder: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  showIcon?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
}

function SearchComponent(props: SearchProps) {
  const { placeholder, onChange, showIcon = true, className } = props;
  return (
    <div className={`app-button flex flex-row ${className}`}>
      <input
        id="search-input"
        type="text"
        placeholder={placeholder}
        className="w-full outline-none"
        onChange={onChange}
        onFocus={props.onFocus}
        onBlur={props.onBlur}
        // Disable browser completion
        autoComplete="off"
      />
      {showIcon && (
        <button>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="white"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

const handleKeyDown = (event: KeyboardEvent) => {
  const isModifierKeyPressed = event.getModifierState(modifierKey);
  const isShiftKeyPressed = event.getModifierState(shiftKey);

  // Toggle console
  if (event.code === "KeyK" && isModifierKeyPressed) {
    event.preventDefault();
    toggleConsole();
  }
  // Open flow
  if (event.code === "KeyO" && isModifierKeyPressed) {
    event.preventDefault();
    openFlowEvent();
  }
  // Toggle Molstar
  if (event.code === "KeyM" && isModifierKeyPressed && isShiftKeyPressed) {
    event.preventDefault();
    toggleMolstar();
  }
  // Redo
  if (event.code === "KeyZ" && isModifierKeyPressed && isShiftKeyPressed) {
    event.preventDefault();
    redoEvent();
  }
  // Undo
  if (event.code === "KeyZ" && isModifierKeyPressed && !isShiftKeyPressed) {
    event.preventDefault();
    undoEvent();
  }
  // Save as
  if (event.code === "KeyS" && isModifierKeyPressed && isShiftKeyPressed) {
    event.preventDefault();
    saveAsEvent();
  }
  // Save
  if (event.code === "KeyS" && isModifierKeyPressed) {
    event.preventDefault();
    saveEvent();
  }
  // New flow
  if (event.code === "KeyN" && isModifierKeyPressed) {
    event.preventDefault();
    newFlowEvent();
  }
};

const toggleMolstar = () => {
  const centerEvent = new CustomEvent("toggleMolstar");
  window.dispatchEvent(centerEvent);
};

const toggleConsole = () => {
  // Emit a toggleConsole event
  const event = new CustomEvent("toggleConsole");
  window.dispatchEvent(event);
};

const undoEvent = () => {
  // Emit an undo event
  const event = new CustomEvent("undo");
  window.dispatchEvent(event);
};

const redoEvent = () => {
  // Emit an undo event
  const event = new CustomEvent("redo");
  window.dispatchEvent(event);
};

export const saveEvent = () => {
  // Emit a save event
  const event = new CustomEvent("saveFlow");
  window.dispatchEvent(event);
};

const newFlowEvent = () => {
  // Emit an event "newFlow"
  // This event will be captured by the flowReciever component
  // and will clear the flow
  const newFlowEvent = new CustomEvent("newFlow");
  window.dispatchEvent(newFlowEvent);
};

const openFlowEvent = () => {
  const event = new CustomEvent("openFlow", {
    detail: {},
  });
  window.dispatchEvent(event);
};

const saveAsEvent = () => {
  // Emit a save event
  const event = new CustomEvent("saveFlowAs");
  window.dispatchEvent(event);
};

const saveTemplate = () => {
  // Open a modal in the document showing the tempaltes view
  window.dispatchEvent(new CustomEvent("saveTemplate"));
};

const fileExplorerEvent = () => {
  // Emit a file explorer event
  const event = new CustomEvent("toggleFileExplorer");
  window.dispatchEvent(event);
};

const cleanRecents = async () => {
  if (!confirm("Are you sure you want to clean the recent flows?")) {
    return;
  }

  // Emit a save event
  const response = await horusGet("/api/cleanrecents");

  if (!response) {
    alert("Error cleaning recents");
    return;
  }

  const data = await response.json();

  if (!data.ok) {
    alert("Error cleaning recents: " + data.msg);
    return;
  }
};

document.addEventListener("keydown", handleKeyDown);

const hideExtensions = () => {
  const event = new CustomEvent("loadExtension");
  window.dispatchEvent(event);
};

export default function HorusToolbar() {
  // This is the toolbar component
  // Will lie on top of the page and will contain the
  // user menu, search bar, etc.

  const pluginPages = usePluginPages();

  const menus: ToolBarMenuProps[] = [
    {
      name: "Home",
      link: "/",
      onClick: () => {
        // confirm the user if the flow is not saved
        const currentFlow: (Flow & { saved: boolean }) | null = window.horus
          .getFlow
          ? window.horus.getFlow()
          : null;

        if (currentFlow && !currentFlow.saved) {
          if (
            !confirm(
              "The current flow is not saved. Are you sure you want to continue?"
            )
          ) {
            return;
          }
        }

        // Show the flow builder in the main view
        const event = new CustomEvent("start-working", {
          detail: <SplashScreen />,
        });
        window.dispatchEvent(event);
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
            newFlowEvent();
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
            openFlowEvent();
          },
        },
        {
          name: "Save",
          keyShortcut: `${modifierKeyLogo}S`,
          svgPath: <SaveIcon />,
          onClick: () => {
            saveEvent();
          },
        },
        {
          name: "Save as...",
          keyShortcut: `${modifierKeyLogo}${shiftKeyLogo}S`,
          svgPath: <SaveAsIcon />,
          onClick: () => {
            saveAsEvent();
          },
        },
        {
          name: "Save template",
          svgPath: <TemplateIcon />,
          onClick: () => {
            saveTemplate();
          },
        },
        {
          name: "File explorer",
          hidden:
            window.horusInternal.mode !== "server" &&
            window.horusInternal.mode !== "webapp",
          svgPath: <CreateFolderIcon />,
          onClick: () => {
            fileExplorerEvent();
          },
        },
        {
          name: "Clean recents",
          hidden: window.horusInternal.mode === "webapp",
          svgPath: <TrashLines />,
          onClick: () => {
            cleanRecents();
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
            undoEvent();
          },
          keyShortcut: `${modifierKeyLogo}Z`,
          svgPath: <BackArrow />,
        },
        {
          name: "Redo",
          onClick: () => {
            redoEvent();
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
          name: "Toggle Mol*",
          onClick: () => {
            toggleMolstar();
          },
          svgPath: <MolStarIcon />,
          // Set a keyShortcut to enable keyboard navigation.
          keyShortcut: `${modifierKeyLogo}${shiftKeyLogo}M`,
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
        {
          name: "Center view",
          onClick: () => {
            const centerEvent = new CustomEvent("centerView");
            window.dispatchEvent(centerEvent);
          },
          svgPath: <CenterView />,
        },
        {
          name: "Debug flow",
          hidden: !window.horusInternal.debug,
          onClick: () => {
            const centerEvent = new CustomEvent("toggleDebugFlow");
            window.dispatchEvent(centerEvent);
          },
          svgPath: <LogFile />,
        },
      ],
    },
    {
      name: "Extensions",
      items: [
        {
          name: "Hide extensions",
          svgPath: <EyeDashIcon />,
          onClick: hideExtensions,
        },
        ...pluginPages.map((page) => {
          return {
            name: page.name,
            svgPath: <Chevron direction="right" stroke="none" />,
            onClick: () => {
              loadPage(page);
            },
          } as ToolBarItemProps;
        }),
      ],
    },
  ];

  return (
    <div
      className="flex flex-row justify-between items-center"
      style={{
        padding: "5px",
      }}
    >
      <div className="flex flex-row gap-1 ml-1 mr-1 h-full">
        {menus.map((menu, index) => (
          <ToolbarMenu key={index} {...menu} />
        ))}
      </div>
      <div className="mr-1">
        <HorusSearch pages={pluginPages} loadPage={loadPage} />
      </div>
    </div>
  );
}

type HorusSearchProps = {
  pages: PluginPage[];
  loadPage: (page: PluginPage) => void;
};

function HorusSearch(props: HorusSearchProps) {
  const [predefinedFilteredFlows, setPredefinedFilteredFlows] = useState<
    Flow[]
  >([]);
  const [recentFilteredFlows, setRecentFilteredFlows] = useState<Flow[]>([]);

  const [filteredTemplates, setFilteredTemplates] = useState<Flow[]>([]);

  const [filteredPages, setFilteredPages] = useState<PluginPage[]>(props.pages);

  const [filterTerm, setFilterTerm] = useState("");

  const webAppMode = window.horusInternal.mode === "webapp";

  // Get the recent flows with the custom hook
  const [
    fetchingRecents,
    recentFlows,
    predefinedFlows,
    templates,
    getFlows,
    toggleInterval,
  ] = useGetRecentFlows(webAppMode);

  useEffect(() => {
    const value = filterTerm;

    if (value === "" || value === undefined) {
      setPredefinedFilteredFlows(predefinedFlows);
      setRecentFilteredFlows(recentFlows);
      setFilteredTemplates(templates);
      setFilteredPages(props.pages);
      return;
    }

    const filteredFlows = predefinedFlows.filter((flow) => {
      return (
        flow.name.toLowerCase().includes(value.toLowerCase()) ||
        (flow.pluginName ?? "Unnamed plugin")
          .toLowerCase()
          .includes(value.toLowerCase())
      );
    });

    setPredefinedFilteredFlows(filteredFlows);

    const filteredRecentFlows = recentFlows.filter((flow) => {
      return (
        flow.name.toLowerCase().includes(value.toLowerCase()) ||
        (flow.path ?? "Unknown path")
          .toLowerCase()
          .includes(value.toLowerCase())
      );
    });

    setRecentFilteredFlows(filteredRecentFlows);

    const filteredTemp = templates.filter((flow) => {
      return flow.name.toLowerCase().includes(value.toLowerCase());
    });

    setFilteredTemplates(filteredTemp);

    const filteredPages: PluginPage[] = props.pages.filter(
      (page: PluginPage) => {
        return (
          page.name.toLowerCase().includes(value.toLowerCase()) ||
          page.description.toLowerCase().includes(value.toLowerCase()) ||
          page.plugin.toLowerCase().includes(value.toLowerCase())
        );
      }
    );

    setFilteredPages(filteredPages);
  }, [filterTerm, predefinedFlows, recentFlows, templates, props.pages]);

  const [isOnFocus, setIsOnFocus] = useState(false);

  useEffect(() => {
    if (isOnFocus) {
      getFlows();
      toggleInterval(true);
    } else {
      toggleInterval(false);
    }
  }, [isOnFocus, getFlows, toggleInterval]);

  const hasFlows =
    recentFilteredFlows.length > 0 || predefinedFilteredFlows.length > 0;

  function RecentFlowsView() {
    return (
      <>
        {fetchingRecents ? (
          <div className="flex flex-col justify-center items-center text-center">
            <RotatingLines size={"2rem"} />
            <div>Loading recent flows...</div>
          </div>
        ) : (
          <RecentUserFlows flows={recentFilteredFlows} />
        )}
      </>
    );
  }

  function TemplatesView() {
    return (
      <div className="flex flex-col gap-1">
        {filteredTemplates?.map((flow) => (
          <div
            key={flow.savedID}
            onClick={() => {
              openFlow(flow);
            }}
            className="predefined-flow"
          >
            <div className="predefined-flow-name">{flow.name}</div>
            <div className="predefined-flow-plugin">Template</div>
          </div>
        ))}
      </div>
    );
  }

  const hasContent =
    recentFilteredFlows.length > 0 ||
    predefinedFilteredFlows.length > 0 ||
    filteredPages.length > 0 ||
    filteredTemplates.length > 0;

  return (
    <div
      className="h-full overflow-y-scroll"
      onFocus={() => {
        setIsOnFocus(true);
      }}
      onBlur={() => {
        setTimeout(() => {
          setIsOnFocus(false);
        }, 100);
      }}
    >
      <SearchComponent
        placeholder="Search Horus..."
        onChange={(e) => {
          setFilterTerm(e.target.value);
        }}
      />
      {isOnFocus && (
        <div
          className="flex flex-col gap-2 absolute p-2 mt-3 origin-top-right rounded-xl bg-white toolbar-menu overflow-y-scroll zoom-out-animation"
          style={{
            right: 4,
            maxHeight: "calc(100vh - 4rem)",
          }}
        >
          {!hasContent && (
            <div className="predefined-flow text-center">Nothing found...</div>
          )}
          {hasFlows && (
            <div className="plugin-variable">
              <div className="predefined-flow-name font-semibold">
                Recent flows
              </div>
              <RecentFlowsView />
            </div>
          )}
          {predefinedFilteredFlows.length > 0 && (
            <div className="plugin-variable">
              <div className="predefined-flow-name font-semibold">
                Preset flows
              </div>
              <PredefinedFlows flows={predefinedFilteredFlows} />
            </div>
          )}
          {filteredTemplates.length > 0 && (
            <div className="plugin-variable">
              <div className="predefined-flow-name font-semibold">
                Templates
              </div>
              <TemplatesView />
            </div>
          )}
          {filteredPages.length > 0 && (
            <div className="plugin-variable">
              <div className="predefined-flow-name font-semibold">
                Extensions
              </div>
              <PluginPagesView pages={filteredPages} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { SearchComponent };
