import { useState, useEffect } from "react";

import "./horus_prompt.css";
import { render, unmountComponentAtNode } from "react-dom";
import AppButton from "../appbutton";

export const useConfirm = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [resolveCallback, setResolveCallback] = useState<
    null | ((confirmed: boolean) => void)
  >(null);

  const horusConfirm = (msg: string) => {
    return new Promise((resolve) => {
      setMessage(msg);
      setResolveCallback(() => {
        return resolve;
      });
      setShowConfirm(true);
    }) as Promise<boolean>;
  };

  useEffect(() => {
    const confirmRoot = document.createElement("div");
    confirmRoot.id = "confirm-root";
    document.body.appendChild(confirmRoot);

    return () => {
      document.body.removeChild(confirmRoot);
    };
  }, []);

  useEffect(() => {
    const handleSubmit = (confirmed: boolean) => {
      setShowConfirm(false);
      if (resolveCallback) {
        resolveCallback(confirmed);
      }
    };

    if (showConfirm) {
      render(
        <ConfirmComponent message={message} onSubmit={handleSubmit} />,
        document.getElementById("confirm-root")
      );
    } else {
      unmountComponentAtNode(document.getElementById("confirm-root")!);
    }
  }, [showConfirm, message, resolveCallback]);

  return horusConfirm;
};

const ConfirmComponent = ({
  message,
  onSubmit,
}: {
  message: string;
  onSubmit: (confirmed: boolean) => void;
}) => {
  return (
    <div className="prompt-overlay backdrop-blur-sm">
      <div className="prompt-container flex flex-col items-center">
        <p className="plugin-variable-name">{message}</p>
        <div className="flex flex-row gap-2">
          <AppButton action={() => onSubmit(false)}>Cancel</AppButton>
          <AppButton action={() => onSubmit(true)}>OK</AppButton>
        </div>
      </div>
    </div>
  );
};
