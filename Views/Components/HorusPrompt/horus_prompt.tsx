import { useState, useEffect, useRef, useCallback } from "react";

import "./horus_prompt.css";

// Ignore React18 errors until frontend-rewrite
// @ts-ignore
import { render, unmountComponentAtNode } from "react-dom";
import AppButton from "../appbutton";
import { BlurredModal } from "../reusable";

export const usePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [message, setMessage] = useState("");
  const [resolveCallback, setResolveCallback] = useState<
    null | ((msg: string | null) => void)
  >(null);

  const horusPrompt = (msg: string) => {
    return new Promise((resolve) => {
      setMessage(msg);
      setResolveCallback(() => {
        return resolve;
      });
      setShowPrompt(true);
    }) as Promise<string | null>;
  };

  useEffect(() => {
    // If the element exists, remove it first
    if (!document.getElementById("prompt-root")) {
      const promptRoot = document.createElement("div");
      promptRoot.id = "prompt-root";
      document.documentElement.appendChild(promptRoot);
    }
  }, []);

  useEffect(() => {
    const handleSubmit = (inputValue: string | null) => {
      setShowPrompt(false);
      if (resolveCallback) {
        resolveCallback(inputValue);
      }
    };

    if (showPrompt) {
      render(
        <PromptComponent message={message} onSubmit={handleSubmit} />,
        document.getElementById("prompt-root"),
      );
    } else {
      unmountComponentAtNode(document.getElementById("prompt-root")!);
    }
  }, [showPrompt, message, resolveCallback]);

  return horusPrompt;
};

const PromptComponent = ({
  message,
  onSubmit,
}: {
  message: string;
  onSubmit: (inputValue: string | null) => void;
}) => {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(inputValue);
  };

  const handleEvent = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onSubmit(inputValue); // Call the onSubmit function
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onSubmit(null);
      }
    },
    [inputValue, onSubmit],
  );

  useEffect(() => {
    const inputRefCurrent = inputRef.current;

    if (inputRefCurrent) {
      inputRefCurrent.focus();
      inputRefCurrent.addEventListener("keydown", handleEvent);
    }

    return () => {
      if (inputRefCurrent) {
        inputRefCurrent.removeEventListener("keydown", handleEvent);
      }
    };
  }, [inputValue, onSubmit, handleEvent]);

  return (
    <BlurredModal show={true} onHide={() => onSubmit(null)}>
      <div className="prompt-container">
        <p className="plugin-variable-name text-xl">{message}</p>
        <form ref={formRef} onSubmit={handleSubmit}>
          <input
            className="plugin-variable-value border-b-2"
            type="text"
            value={inputValue ?? ""}
            onChange={(e) => setInputValue(e.target.value)}
            ref={inputRef}
          />
          <div className="flex gap-2 justify-center">
            <AppButton action={() => onSubmit(null)}>Cancel</AppButton>
            <AppButton type="submit">OK</AppButton>
          </div>
        </form>
      </div>
    </BlurredModal>
  );
};
