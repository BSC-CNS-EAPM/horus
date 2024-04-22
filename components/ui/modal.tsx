import * as React from "react";

import "./modal.css";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) {
    return;
  }

  return (
    <div className={`modal ${isOpen ? "modal-open" : ""}`} onClick={onClose}>
      <div className="modal-content">
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
