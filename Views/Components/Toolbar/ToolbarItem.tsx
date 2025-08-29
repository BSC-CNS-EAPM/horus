import { Fragment, useEffect, useState } from "react";
import Chevron from "./Icons/Chevron";
// Useful components from HeadlessUI
import { Menu, Transition } from "@headlessui/react";

export interface ToolBarItemProps {
  name: string;
  hidden?: boolean;
  link?: string;
  svgPath?: React.ReactNode;
  onClick?: () => void;
  keyShortcut?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  isMain?: boolean;
}
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
      {!props.isMain && (
        <div>
          <MenuIcon
            active={active || isOpen}
            svgPath={
              props.svgPath ?? <Chevron direction="right" stroke="none" />
            }
          />
        </div>
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

  if (props.items?.length === 0 && !(props.link || props.onClick)) {
    return <></>;
  }

  return (
    <div className="h-full cursor-pointer">
      {props.link || props.onClick ? (
        <ToolBarItem {...props} isMain={true} />
      ) : (
        <Menu>
          <Menu.Button className={"h-full"}>
            <ToolBarItem {...props} isMain={true} />
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
              className="absolute p-md-2 p-2 mt-3 w-56 origin-top-left rounded-xl bg-white toolbar-menu outline-none overflow-y-auto"
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
      className="mr-2 h-6 w-6"
      aria-hidden="true"
    >
      {svgPath}
    </svg>
  );
};
