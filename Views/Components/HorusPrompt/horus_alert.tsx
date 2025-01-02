import { useState, useEffect, useRef, useCallback } from "react";

import "./horus_prompt.css";
import { render, unmountComponentAtNode } from "react-dom";
import AppButton from "../appbutton";
import { BlurredModal } from "../reusable";

export const useAlert = () => {
  const [showAlert, setShowAlert] = useState(false);
  const [message, setMessage] = useState("");
  const [resolveCallback, setResolveCallback] = useState<null | (() => void)>(
    null,
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
    // If the element exists, remove it first
    if (!document.getElementById("alert-root")) {
      const alertRoot = document.createElement("div");
      alertRoot.id = "alert-root";
      document.documentElement.appendChild(alertRoot);
    }
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
        document.getElementById("alert-root"),
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
      if (event.key === "Enter") {
        event.preventDefault();
        onSubmit(); // Call the onSubmit function
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
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
    <BlurredModal show={true} onHide={() => {}}>
      <div className="prompt-container">
        <p className="plugin-variable-name text-xl">{message}</p>
        <form
          onSubmit={() => onSubmit()}
          className="flex flex-row justify-center"
        >
          <AppButton type="submit">OK</AppButton>
          <input
            type="text"
            ref={inputRef}
            style={{
              width: 0,
              height: 0,
              opacity: "0",
              position: "absolute",
              zIndex: -1,
            }}
          />
        </form>
      </div>
    </BlurredModal>
  );
};
