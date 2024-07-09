import { useState, useEffect, useRef, useCallback } from "react";

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
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleEvent = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.key === "Enter") {
        onSubmit(); // Call the onSubmit function
      }
      if (event.key === "Escape") {
        onSubmit();
      }
    },
    [onSubmit]
  );

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.addEventListener("keydown", handleEvent);
    }

    return () => {
      if (inputRef.current) {
        inputRef.current.removeEventListener("keydown", handleEvent);
      }
    };
  }, [onSubmit, handleEvent]);

  return (
    <div className="prompt-overlay backdrop-blur-sm">
      <div className="prompt-container flex flex-col items-center">
        <p className="plugin-variable-name">{message}</p>
        <form onSubmit={() => onSubmit()}>
          <input
            type="text"
            ref={inputRef}
            style={{
              width: 0,
              height: 0,
              opacity: "0",
              position: "absolute",
            }}
          />
          <AppButton type="submit">OK</AppButton>
        </form>
      </div>
    </div>
  );
};
