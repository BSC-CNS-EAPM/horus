import { Component, useState } from "react";
import { Popover } from "@headlessui/react";
import Chevron from "./Toolbar/Icons/Chevron";
import { horusPost } from "../Utils/utils";
import { createPortal } from "react-dom";
import { Link, LinkProps } from "react-router-dom";

type HorusPopoverProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  overrideClassName?: string;
  triggerClassName?: string;
  cancelStyle?: boolean;

  onOpen?: () => void;
  onClose?: () => void;
  disableHover?: boolean;
};

const HorusPopover = (props: HorusPopoverProps) => {
  const { trigger, children, disableHover } = props;

  const [isOpen, setIsOpen] = useState(false);
  const handleOpen = () => {
    setIsOpen(true);
    if (props?.onOpen) props?.onOpen();
  };
  const handleClose = () => {
    setIsOpen(false);
    if (props?.onClose) props?.onClose();
  };

  const handleClickTrigger = () => {
    setIsOpen(!isOpen);
  };

  return (
    <Popover
      className={props.overrideClassName ? props.overrideClassName : "relative"}
    >
      <Popover.Group
        onMouseOver={disableHover ? () => {} : handleOpen}
        onMouseLeave={disableHover ? () => {} : handleClose}
        style={
          props.cancelStyle
            ? undefined
            : {
                margin: "0",
                padding: "0",
                height: "1.25rem",
              }
        }
      >
        <div className={props.triggerClassName} onClick={handleClickTrigger}>
          {trigger}
        </div>
      </Popover.Group>
      {isOpen && (
        <Popover.Panel
          className="absolute zoom-out-animation"
          style={{ zIndex: Number.MAX_SAFE_INTEGER }}
          static
        >
          {children}
        </Popover.Panel>
      )}
    </Popover>
  );
};

function debounce(func: any, timeout = 300) {
  let timer: Timer;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // @ts-ignore
      func.apply(this, args);
    }, timeout);
  };
}

type BlurredModalProps = {
  show: boolean;
  onHide: () => void;
  children: React.ReactNode;
  zIndex?: number;
  // As TailwindCSS classes
  maxContentSize?: {
    height?: string;
    width?: string;
  };
  noMargin?: boolean;
  overRoot?: boolean;
  noCentered?: boolean;
};

export function BlurredModal(props: BlurredModalProps) {
  if (!props.show) return null;

  const modalView = (
    <div
      style={{
        zIndex: props.zIndex ?? 1000,
      }}
      className={`blurred-modal-container flex justify-center ${
        !props.noCentered && "items-center"
      }`}
    >
      {/* This is the content */}
      <div
        style={{
          margin: props.noCentered ? "2rem" : props.noMargin ? 0 : undefined,
          padding: props.noMargin ? 0 : undefined,
          borderRadius: props.noMargin ? "15px" : undefined,
          overflow: "auto",
          // overflow: props.noMargin ? "hidden" : undefined,
          height: props.maxContentSize?.height,
          width: props.maxContentSize?.width,
        }}
        className={`z-30 absolute blurred-modal-content zoom-in-animation ${
          !props.maxContentSize?.width && "max-w-[60%]"
        }  ${!props.maxContentSize?.height && "max-h-[85%]"}`}
      >
        {props.children}
      </div>
      {/* This will make the background */}
      <div
        id="horus-modal-backdrop"
        className="backdrop-blur h-full w-full absolute z-20 blur-in-animation"
        onClick={props.onHide}
      ></div>
    </div>
  );

  if (props.overRoot) {
    return createPortal(modalView, document.body.firstElementChild!);
  }

  return modalView;
}

type ErrorBoundaryProps = {
  fallback: React.ReactNode;
  children: React.ReactNode;
};

export class ErrorBoundary extends Component {
  override state: { hasError: boolean };
  override props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
    this.props = props;
  }

  static getDerivedStateFromError(_: any) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  override componentDidCatch(error: any, info: any) {
    console.error("Error: ", error);
    console.info("Info: ", info);
  }

  override render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export function MovingChevron({ down }: { down: boolean }) {
  return (
    <div
      className={`cursor-pointer transition-all transform ${
        down ? null : "rotate-180"
      }`}
    >
      <Chevron direction="up" />
    </div>
  );
}

export { debounce, HorusPopover };

export function saveFile(file: File) {
  // If we ar eon desktop mode, use the /savecontents endpoint,
  // otherwise, create a download link
  if (window.horusInternal.isDesktop) {
    // Post the file to the /savecontents endpoint
    const form = new FormData();

    form.append("file", file, file.name);
    const headers = {
      Accept: "application/json",
    };

    horusPost("/api/savecontents", headers, form)
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        if (!data.ok) {
          alert(data.msg);
        }
      })
      .catch((error) => {
        alert("There was an error saving the file: " + error);
      });
  } else {
    // Convert your blob into a Blob URL (a special url that points to an object in the browser's memory)
    const blobUrl = URL.createObjectURL(file);

    // Create a link element
    const link = document.createElement("a");

    // Set link's href to point to the Blob URL
    link.href = blobUrl;
    link.download = file.name;

    // Append link to the body
    document.body.appendChild(link);

    // Dispatch click event on the link
    // This is necessary as link.click() does not work on the latest firefox
    link.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );

    // Remove link from body
    document.body.removeChild(link);
  }
}

// Will download the file (if its available for the user)
// and return the Blob
export function getFile(path: string) {
  const url = new URL(
    window.location.origin + window.__HORUS_ROOT__ + "/api/filepicker/download"
  );

  url.searchParams.append("path", path);

  return new Promise<Blob>((resolve, reject) => {
    fetch(url.toString())
      .then((res) => {
        // If the response is json, the fail
        if (res.headers.get("content-type")?.includes("application/json")) {
          reject("Could not open file");
        }
        return res.blob();
      })
      .then((blob) => {
        resolve(blob);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

export function HorusLink(props: LinkProps) {
  return <Link {...props} to={window.__HORUS_ROOT__ + props.to} />;
}
