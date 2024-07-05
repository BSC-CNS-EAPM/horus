import { useState, useEffect } from "react";

import "./horus_prompt.css";
import { render, unmountComponentAtNode } from "react-dom";
import AppButton from "../appbutton";

export const useAlert = () => {
  const [showAlert, setShowAlert] = useState(false);
  const [message, setMessage] = useState("");
  const [resolveCallback, setResolveCallback] = useState<null | (() => void)>(
    null
  );

  const horusAlert = (msg: string) => {
    return new Promise((resolve) => {
      setMessage(msg);
      setResolveCallback(() => {
        return resolve;
      });
      setShowAlert(true);
    }) as Promise<undefined>;
  };

  useEffect(() => {
    const alertRoot = document.createElement("div");
    alertRoot.id = "alert-root";
    document.body.appendChild(alertRoot);

    return () => {
      document.body.removeChild(alertRoot);
    };
  }, []);

  useEffect(() => {
    const handleSubmit = () => {
      setShowAlert(false);
      if (resolveCallback) {
        resolveCallback();
      }
    };

    if (showAlert) {
      render(
        <AlertComponent message={message} onSubmit={handleSubmit} />,
        document.getElementById("alert-root")
      );
    } else {
      unmountComponentAtNode(document.getElementById("alert-root")!);
    }
  }, [showAlert, message, resolveCallback]);

  return horusAlert;
};

const AlertComponent = ({
  message,
  onSubmit,
}: {
  message: string;
  onSubmit: () => void;
}) => {
  return (
    <div className="prompt-overlay backdrop-blur-sm">
      <div className="prompt-container flex flex-col items-center">
        <p className="plugin-variable-name">{message}</p>
        <AppButton action={() => onSubmit()}>OK</AppButton>
      </div>
    </div>
  );
};
