import { useState, useEffect, useRef, useCallback } from "react";

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
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleEvent = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.key === "Enter") {
        onSubmit(true); // Call the onSubmit function
      }
      if (event.key === "Escape") {
        onSubmit(false);
      }
    },
    [onSubmit]
  );

  useEffect(() => {
    if (inputRef.current) {
      // Focus again in a timeout, somehow another element can retain focus
      setTimeout(() => {
        inputRef.current?.focus();
      }, 1000);

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
        <form onSubmit={() => onSubmit(true)}>
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
          <div className="flex flex-row gap-2">
            <AppButton action={() => onSubmit(false)}>Cancel</AppButton>
            <AppButton type="submit">OK</AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};
