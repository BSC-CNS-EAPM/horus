import { Component, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Popover } from "@headlessui/react";
import Chevron from "./Toolbar/Icons/Chevron";

type HorusPopoverProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;

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
    <Popover className="relative">
      <Popover.Group
        onMouseOver={disableHover ? () => {} : handleOpen}
        onMouseLeave={disableHover ? () => {} : handleClose}
        style={{
          margin: "0",
          padding: "0",
          height: "1.25rem",
        }}
      >
        <div onClick={handleClickTrigger}>{trigger}</div>
      </Popover.Group>
      {isOpen && (
        <Popover.Panel className="absolute zoom-out-animation" static>
          {children}
        </Popover.Panel>
      )}
    </Popover>
  );
};

function debounce(func: any, timeout = 300) {
  let timer: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // @ts-ignore
      func.apply(this, args);
    }, timeout);
  };
}

interface HorusModalProps {
  show: boolean;
  onHide?: () => void;
  header?: React.ReactNode;
  body?: React.ReactNode;
  footer?: React.ReactNode;
  fullscreen?: boolean;
  size?: "sm" | "lg" | "xl";
  contentClassName?: string;
  children?: React.ReactNode;
  noCentered?: boolean;
  backdrop?: "static" | true;
  onBackdropClick?: () => void;
}

function HorusModal(props: HorusModalProps) {
  const sizeClass = props.size ? `modal-${props.size}` : "";
  return (
    <Modal
      onBackdropClick={props.onBackdropClick ?? (() => {})}
      backdrop={props.backdrop ?? true}
      show={props.show}
      onHide={props.onHide ?? (() => {})}
      dialogClassName={sizeClass}
      contentClassName={props.contentClassName ?? ""}
      fullscreen={props.fullscreen ? true : "false"}
      size={props.size ?? "lg"}
      centered={props.noCentered ? false : true}
    >
      <div
        style={{
          overflow: "hidden",
        }}
      >
        {props.header && (
          <Modal.Header>
            <Modal.Title>{props.header}</Modal.Title>
          </Modal.Header>
        )}
        <Modal.Body>
          {props.body}
          {props.children}
        </Modal.Body>
        {props.footer && <Modal.Footer>{props.footer}</Modal.Footer>}
      </div>
    </Modal>
  );
}

type BlurredModalProps = {
  show: boolean;
  onHide: () => void;
  children: React.ReactNode;
  zIndex?: number;
};

export function BlurredModal(props: BlurredModalProps) {
  if (!props.show) return null;

  return (
    <div
      style={{
        zIndex: props.zIndex ?? 99999,
      }}
      className="blurred-modal-container flex justify-center items-center"
    >
      {/* This is the content */}
      <div className="blurred-modal-content z-30 w-fit h-fit zoom-in-animation">
        {props.children}
      </div>
      {/* This will make the background */}
      <div
        className="backdrop-blur-sm h-full w-full absolute z-20 blur-in-animation"
        onClick={props.onHide}
      ></div>
    </div>
  );
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
    console.log("Error: ", error);
    console.log("Info: ", info);
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

export { HorusModal, HorusModalProps, debounce, HorusPopover };
