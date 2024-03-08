// Desc: This is the toolbar component

// React
import { ChangeEvent, Fragment, useEffect, useState } from "react";

// Useful components from HeadlessUI
import { Menu, Transition } from "@headlessui/react";

// Horus components
import { FlowBuilderView } from "../FlowBuilder/flow.view";
import RotatingLines from "../RotatingLines/rotatinglines";
import SplashScreen from "../MainApp/welcome_screen";
import RecentUserFlows, {
  PredefinedFlows,
  useGetRecentFlows,
} from "../FlowStatus/recent_flows";
import PluginPagesView, { loadPage, usePluginPages } from "./extensions_list";

// Icons
import NewFlowIcon from "./Icons/New";
import PluginsIcon from "./Icons/Plugins";
import OpenFlowIcon from "./Icons/Open";
import MolStarIcon from "./Icons/MolStar";
import EyeIcon from "./Icons/Eye";
import EyeDashIcon from "./Icons/EyeDash";
import Chevron from "./Icons/Chevron";
import TrashIcon from "./Icons/Trash";
import LogFile from "./Icons/LogFile";

// Horus web-server utils
import { horusGet } from "../../Utils/utils";

// Styles
import "../nbdbutton.css";
import "./toolbar.css";
import { Flow, PluginPage } from "../FlowBuilder/flow.types";

// import RotatingLines from "../RotatingLines/rotatinglines";

interface ToolBarItemProps {
  name: string;
  hidden?: boolean;
  link?: string;
  svgPath: React.ReactNode;
  onClick?: () => void;
  keyShortcut?: string;
  children?: React.ReactNode;
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
      className="toolbar-item"
      onClick={async () => {
        props.onClick?.();
      }}
    >
      <MenuIcon active={active || isOpen} svgPath={props.svgPath} />
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

interface ToolBarMenuProps {
  name: string;
  hidden?: boolean;
  svgPath: React.ReactNode;
  items?: ToolBarItemProps[];
  link?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

function ToolbarMenu(props: ToolBarMenuProps) {
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
            <Menu.Items className="absolute p-md-2 mt-2 w-56 origin-top-left rounded-xl bg-white toolbar-menu outline-none">
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

  // Handle the keydown event
  if (event.code === "KeyK" && isModifierKeyPressed) {
    event.preventDefault();
    toggleConsole();
  }

  if (event.code === "KeyM" && isModifierKeyPressed && isShiftKeyPressed) {
    event.preventDefault();
    toggleMolstar();
  }

  if (event.code === "KeyZ" && isModifierKeyPressed && isShiftKeyPressed) {
    event.preventDefault();
    redoEvent();
  }
  if (event.code === "KeyZ" && isModifierKeyPressed && !isShiftKeyPressed) {
    event.preventDefault();
    undoEvent();
  }
  if (event.code === "KeyS" && isModifierKeyPressed && isShiftKeyPressed) {
    event.preventDefault();
    saveAsEvent();
  }
  if (event.code === "KeyS" && isModifierKeyPressed) {
    event.preventDefault();
    saveEvent();
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

const saveEvent = () => {
  // Emit a save event
  const event = new CustomEvent("saveFlow");
  window.dispatchEvent(event);
};

const saveAsEvent = () => {
  // Emit a save event
  const event = new CustomEvent("saveFlowAs");
  window.dispatchEvent(event);
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
      svgPath: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
          />
        </svg>
      ),
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
      svgPath: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      ),
      items: [
        {
          name: "New",
          svgPath: <NewFlowIcon />,
          onClick: () => {
            // Emit an event "newFlow"
            // This event will be captured by the flowReciever component
            // and will clear the flow

            // Set the secondary view to the flow builder
            const mainView = <FlowBuilderView />;

            const mainViewEvent = new CustomEvent("mainView", {
              detail: mainView,
            });
            window.dispatchEvent(mainViewEvent);

            const newFlowEvent = new CustomEvent("newFlow", {
              detail: {},
            });
            window.dispatchEvent(newFlowEvent);
          },
        },
        {
          name: "Open",
          svgPath: <OpenFlowIcon />,
          onClick: () => {
            // Emit an event "openFlow"
            // This event will be captured by the flowReciever component
            // and will open the flow
            const event = new CustomEvent("openFlow", {
              detail: {},
            });
            window.dispatchEvent(event);
          },
        },
        {
          name: "Save",
          keyShortcut: `${modifierKeyLogo}S`,
          svgPath: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
          ),
          onClick: () => {
            saveEvent();
          },
        },
        {
          name: "Save as...",
          keyShortcut: `${modifierKeyLogo}${shiftKeyLogo}S`,
          svgPath: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
          ),
          onClick: () => {
            saveAsEvent();
          },
        },
        {
          name: "File explorer",
          hidden: window.horusInternal.isDesktop,
          svgPath: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
              />
            </svg>
          ),
          onClick: () => {
            fileExplorerEvent();
          },
        },
        {
          name: "Clean recents",
          svgPath: <TrashIcon />,
          onClick: () => {
            cleanRecents();
          },
        },
      ],
    },
    {
      name: "Edit",
      svgPath: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
          />
        </svg>
      ),
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
          svgPath: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
              />
            </svg>
          ),
        },
        {
          name: "Redo",
          onClick: () => {
            redoEvent();
          },
          keyShortcut: `${modifierKeyLogo}${shiftKeyLogo}Z`,
          svgPath: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"
              />
            </svg>
          ),
        },
      ],
    },
    {
      name: "View",
      svgPath: <EyeIcon />,
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
          svgPath: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          ),
          // Set a keyShortcut to enable keyboard navigation.
          keyShortcut: `${modifierKeyLogo}K`,
        },
        {
          name: "Center view",
          onClick: () => {
            const centerEvent = new CustomEvent("centerView");
            window.dispatchEvent(centerEvent);
          },
          svgPath: (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                />
              </svg>
            </>
          ),
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
      svgPath: <PluginsIcon />,
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
              loadPage(page.url, page.name);
            },
          } as ToolBarItemProps;
        }),
      ],
    },
  ];

  return (
    <div className="flex flex-row justify-between toolbar">
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
  loadPage: (url: string, pagename: string) => void;
};

function HorusSearch(props: HorusSearchProps) {
  const [predefinedFilteredFlows, setPredefinedFilteredFlows] = useState<
    Flow[]
  >([]);
  const [recentFilteredFlows, setRecentFilteredFlows] = useState<Flow[]>([]);
  const [filteredPages, setFilteredPages] = useState<PluginPage[]>(props.pages);

  // Get the recent flows with the custom hook
  const [
    fetchingRecents,
    recentFlows,
    predefinedFlows,
    getFlows,
    toggleInterval,
  ] = useGetRecentFlows();

  const filterSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target?.value;

    if (value === "" || value === undefined) {
      setPredefinedFilteredFlows(predefinedFlows);
      setRecentFilteredFlows(recentFlows);
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
  };

  useEffect(() => {
    setPredefinedFilteredFlows(predefinedFlows);
  }, [predefinedFlows]);

  useEffect(() => {
    setRecentFilteredFlows(recentFlows);
  }, [recentFlows]);

  useEffect(() => {
    setFilteredPages(props.pages);
  }, [props.pages]);

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

  const hasContent =
    recentFilteredFlows.length > 0 ||
    predefinedFilteredFlows.length > 0 ||
    filteredPages.length > 0;

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
      <SearchComponent placeholder="Search Horus..." onChange={filterSearch} />
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
