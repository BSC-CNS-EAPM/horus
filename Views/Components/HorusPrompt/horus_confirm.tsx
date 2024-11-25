import { useState, useEffect, useRef, useCallback } from "react";

import "./horus_prompt.css";
import { render, unmountComponentAtNode } from "react-dom";
import AppButton from "../appbutton";
import { BlurredModal } from "../reusable";

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
    // If the element exists, do not create
    if (!document.getElementById("confirm-root")) {
      const confirmRoot = document.createElement("div");
      confirmRoot.id = "confirm-root";
      document.documentElement.appendChild(confirmRoot);
    }
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
      if (event.key === "Enter") {
        event.preventDefault();
        onSubmit(true); // Call the onSubmit function
      }
      if (event.key === "Escape") {
        event.preventDefault();
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
    <BlurredModal show={true} onHide={() => onSubmit(false)}>
      <div className="prompt-container">
        <p className="plugin-variable-name text-xl">{message}</p>
        <form onSubmit={() => onSubmit(true)}>
          <div className="flex flex-row gap-2 justify-center">
            <AppButton action={() => onSubmit(false)}>Cancel</AppButton>
            <AppButton type="submit">OK</AppButton>
          </div>
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
