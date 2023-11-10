import React, { useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Popover } from "@headlessui/react";

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
        <Popover.Panel className="absolute" static>
          {children}
        </Popover.Panel>
      )}
    </Popover>
  );
};

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

interface HorusModalProps {
  show: boolean;
  onHide?: () => void;
  header: React.ReactNode;
  body?: React.ReactNode;
  footer: React.ReactNode;
  fullscreen?: boolean;
  size?: "sm" | "lg" | "xl";
  contentClassName?: string;
  children?: React.ReactNode;
}

function HorusModal(props: HorusModalProps) {
  const sizeClass = props.size ? `modal-${props.size}` : "";
  return (
    <Modal
      show={props.show}
      onHide={props.onHide}
      dialogClassName={sizeClass}
      contentClassName={props.contentClassName}
      fullscreen={props.fullscreen ? true : "false"}
      size={props.size}
    >
      <Modal.Header>
        <Modal.Title>{props.header}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {props.body}
        {props.children}
      </Modal.Body>
      <Modal.Footer>{props.footer}</Modal.Footer>
    </Modal>
  );
}

export { HorusModal, HorusModalProps, debounce, HorusPopover };
