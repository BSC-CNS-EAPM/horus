// Desc: This is the toolbar component
import { Menu, Transition } from "@headlessui/react";
import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import "../nbdbutton.css";
import { horusGet } from "../../Utils/utils";
import { FlowBuilderView } from "../FlowBuilder/flow_builder_view";
import "./toolbar.css";
import { socket } from "../../Utils/socket";
import { SettingsView } from "../../Settings/settings";
import { FlowStatusView } from "../FlowStatus/flow_status";
import RotatingLines from "../RotatingLines/rotatinglines";
import { PluginPage } from "../FlowBuilder/flow_builder_types";
// import RotatingLines from "../RotatingLines/rotatinglines";

export const loadPage = async (url: string, pagename: string) => {
  // Emit an event to the iframe
  const event = new CustomEvent("mainViewURL", { detail: { url, pagename } });
  window.dispatchEvent(event);
};

interface ToolBarItemProps {
  name: string;
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
  const navigate = useNavigate();

  const navigateTo = async () => {
    await navigate(props.link);
  };
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
        await navigateTo();
        props.onClick?.();
      }}
    >
      <MenuIcon active={active || isOpen} svgPath={props.svgPath} />
      <div>{props.name}</div>
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
  svgPath: React.ReactNode;
  items?: ToolBarItemProps[];
  link?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

function ToolbarMenu(props: ToolBarMenuProps) {
  return (
    <div>
      {props.link || props.onClick ? (
        <ToolBarItem {...props} />
      ) : (
        <Menu>
          <div>
            <Menu.Button>
              <ToolBarItem {...props} />
            </Menu.Button>
          </div>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute p-md-2 mt-2 w-56 origin-top-left divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {/* // Here the items will be rendered */}
              {props.items?.map((item) => (
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
              ))}
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
  onChange: (event) => void;
  showIcon?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

function SearchComponent(props: SearchProps) {
  const { placeholder, onChange, showIcon = true } = props;
  return (
    <div className="app-button flex flex-row">
      <input
        type="text"
        placeholder={placeholder}
        className=""
        onChange={onChange}
        onFocus={props.onFocus}
        onBlur={props.onBlur}
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
    alert("Error cleaning recents: " + data.error);
    return;
  }
};

document.addEventListener("keydown", handleKeyDown);

const hideExtensions = () => {
  const event = new CustomEvent("mainViewURL");
  window.dispatchEvent(event);
};

export default function HorusToolbar() {
  // This is the toolbar component
  // Will lie on top of the page and will contain the
  // user menu, search bar, etc.

  const [pluginPages, setPluginPages] = useState<PluginPage[]>([]);

  const getPluginPages = async () => {
    const response = await horusGet("/api/plugins/listpages");

    if (!response) {
      return;
    }

    if (!response.ok) {
      return;
    }

    const data: [PluginPage] = await response.json();

    setPluginPages(data);
  };

  useEffect(() => {
    // Fetch the pages from the server api
    getPluginPages();

    // Add a scoket listener to update the extensions list after a plugin is installed/uninstalled
    socket.on("pluginChanges", getPluginPages);

    return () => {
      socket.off("pluginChanges", getPluginPages);
    };
  }, []);

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
        // Set the secondary view to null
        hideExtensions();

        // Show the flow builder in the main view
        const event = new CustomEvent("mainView", {
          detail: <FlowBuilderView />,
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
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          ),
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
                d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
              />
            </svg>
          ),
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
          name: "Clean recents",
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
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          ),
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
            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
      items: [
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
      ],
    },
    {
      name: "Extensions",
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
            d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z"
          />
        </svg>
      ),
      items: [
        {
          name: "Plugin manager",
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
                d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122"
              />
            </svg>
          ),
          onClick: () => {
            const page = {
              name: "Plugin manager",
              url: "/plugins",
            };
            loadPage(page.url, page.name);
          },
        },
        {
          name: "Hide extensions",
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
                d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
              />
            </svg>
          ),
          onClick: hideExtensions,
        },
        ...pluginPages
          .filter((page) => !page.hidden)
          .map(
            (page) =>
              !page.hidden && {
                name: page.name,
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
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                ),
                onClick: () => {
                  loadPage(page.url, page.name);
                },
              }
          ),
      ],
    },
    {
      name: "Settings",
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
            d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
      onClick: () => {
        // Set the secondary view to null
        const event = new CustomEvent("mainView", {
          detail: <SettingsView />,
        });
        window.dispatchEvent(event);
      },
    },
  ];

  return (
    <div className="z-20 flex flex-row justify-between toolbar mt-1">
      <div className="flex flex-row gap-1 ml-1 mr-1">
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
  pages: any;
  loadPage: any;
};

function HorusSearch(props: HorusSearchProps) {
  const [predefinedFlows, setPredefinedFlows] = useState([]);
  const [recentFlows, setRecentFlows] = useState([]);
  const [predefinedFilteredFlows, setPredefinedFilteredFlows] = useState([]);
  const [recentFilteredFlows, setRecentFilteredFlows] = useState([]);
  const [fetchingRecents, setFetchingRecents] = useState(true);
  const [filteredPages, setFilteredPages] = useState(props.pages);

  const getFlows = async () => {
    setFetchingRecents(true);
    const responsePredefined = await horusGet("/api/plugins/flows");

    if (!responsePredefined) {
      return;
    }

    const data = await responsePredefined.json();

    if (!responsePredefined.ok) {
      alert("Error getting flows: " + data.error);
      return;
    }

    setPredefinedFlows(data.flows);

    const recentFlowsResponse = await horusGet("/api/recentflows");

    if (!recentFlowsResponse) {
      alert("Error getting recent flows");
      return;
    }

    const recentFlowsData = await recentFlowsResponse.json();

    if (!recentFlowsData.ok) {
      alert("Error getting recent flows: " + recentFlowsData.error);
      return;
    }

    let flows = recentFlowsData.flows;

    // Sort the flows by the flow.date field (yyyy-mm-dd hh:mm:ss)
    flows.sort((a: any, b: any) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      return dateB.getTime() - dateA.getTime();
    });

    setRecentFlows(flows);
    setFetchingRecents(false);
  };

  const filterSearch = (event) => {
    const value = event.target.value;

    if (value === "" || value === undefined) {
      setPredefinedFilteredFlows(predefinedFlows);
      setRecentFilteredFlows(recentFlows);
      setFilteredPages(props.pages);
      return;
    }

    const filteredFlows = predefinedFlows.filter((flow) => {
      return (
        flow.name.toLowerCase().includes(value.toLowerCase()) ||
        flow.plugin_name.toLowerCase().includes(value.toLowerCase())
      );
    });

    setPredefinedFilteredFlows(filteredFlows);

    const filteredRecentFlows = recentFlows.filter((flow) => {
      return (
        flow.name.toLowerCase().includes(value.toLowerCase()) ||
        flow.path.toLowerCase().includes(value.toLowerCase())
      );
    });

    setRecentFilteredFlows(filteredRecentFlows);

    const filteredPages = props.pages.filter((page) => {
      return (
        page.name.toLowerCase().includes(value.toLowerCase()) ||
        page.description.toLowerCase().includes(value.toLowerCase()) ||
        page.plugin.toLowerCase().includes(value.toLowerCase())
      );
    });

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
    }
  }, [isOnFocus]);

  const openFlow = (flow) => {
    const event = new CustomEvent("openFlow", {
      detail: { savedID: flow.savedID, path: flow.path },
    });
    window.dispatchEvent(event);
  };

  const hasFlows =
    recentFilteredFlows.length > 0 || predefinedFilteredFlows.length > 0;

  function RecentFlowsView() {
    return (
      <>
        {fetchingRecents ? (
          <div className="flex flex-col justify-center text-center pt-4">
            <RotatingLines
              style={{
                height: "2rem",
                width: "2rem",
              }}
            />
            <div>Loading recent flows...</div>
          </div>
        ) : (
          recentFilteredFlows.length > 0 && (
            <RecentUserFlows
              recentFilteredFlows={recentFilteredFlows}
              openFlow={openFlow}
            />
          )
        )}
        {predefinedFilteredFlows.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="predefined-flow-name font-bold">
              Predefined flows
            </div>
            {predefinedFilteredFlows?.map((flow) => (
              <div
                key={flow.savedID}
                onClick={() => {
                  openFlow(flow);
                }}
                className="predefined-flow"
              >
                <div className="predefined-flow-name">{flow.name}</div>
                <div className="predefined-flow-plugin">
                  {flow.plugin_name} - Plugin flow
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div
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
      {isOnFocus && (hasFlows || filteredPages.length > 0) && (
        <div className="absolute flex flex-col gap-1 predefined-flow-box">
          {hasFlows && <RecentFlowsView />}
          {filteredPages && (
            <PluginPagesView pages={filteredPages} loadPage={props.loadPage} />
          )}
        </div>
      )}
    </div>
  );
}

type PluginPageViewProps = {
  pages: Array<PluginPage>;
  loadPage: any;
};

function PluginPagesView(props: PluginPageViewProps) {
  const { pages, loadPage } = props;

  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="predefined-flow-name font-bold">Extensions</div>
      {pages
        ?.filter((page) => !page.hidden)
        .map((page) => (
          <div
            key={page.id}
            onClick={() => {
              loadPage(page.url, page.name);
            }}
            className="predefined-flow"
          >
            <div className="predefined-flow-name">{page.name}</div>
            <div className="predefined-flow-plugin">{page.description}</div>
          </div>
        ))}
    </div>
  );
}

type RecentUserFlowProps = {
  recentFilteredFlows: any;
  openFlow: any;
};

function RecentUserFlows(props: RecentUserFlowProps) {
  const { recentFilteredFlows, openFlow } = props;

  return (
    <div className="flex flex-col gap-1">
      <div className="predefined-flow-name font-bold">Recent flows</div>
      {recentFilteredFlows.map((flow) => (
        <div
          key={flow.savedID}
          onClick={() => {
            openFlow(flow);
          }}
          className={"predefined-flow"}
        >
          <div className="flex flex-row justify-between">
            <div className="predefined-flow-name">{flow.name}</div>
            <FlowStatusView status={flow.status} />
          </div>
          <div className="predefined-flow-plugin">{flow.path}</div>
        </div>
      ))}
    </div>
  );
}

export { SearchComponent };
