import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AppButton from "../appbutton";
import { BlurredModal, HorusPopover } from "../reusable";
import SaveIcon from "../Toolbar/Icons/Save";
import * as monaco from "monaco-editor";
import { Editor } from "@monaco-editor/react";

type HorusLazyLogProps = {
  logText: string;
  filename?: string;
  format?: "shell" | "log" | "json";
};

export function HorusLazyLog(props: HorusLazyLogProps) {
  const { logText, filename, format = "shell" } = props;

  const parsedLogText = logText || "No logs";

  const [fullScreen, setFullScreen] = useState<boolean>(false);

  const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
  const codeRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!codeRef.current) return;

    if (isAtBottom) {
      const editor = codeRef.current;
      const model = editor.getModel();
      if (model) {
        editor.revealLine(model.getLineCount());
      }
    }
  }, [isAtBottom, parsedLogText]);

  const LoggingView = (
    <div
      className="flex flex-col h-full relative"
      style={
        fullScreen
          ? {
              position: "absolute",
              width: "100%",
            }
          : undefined
      }
    >
      <div
        className="flex flex-row justify-between items-center gap-2"
        style={{
          position: "absolute",
          marginTop: "0.5rem",
          marginLeft: "0.5rem",
          right: "1.5rem",
          zIndex: 1001,
        }}
      >
        <HorusPopover
          trigger={
            <AppButton
              action={() => {
                const file = new File(
                  [parsedLogText],
                  `${filename ?? "logs.log"}`,
                  {
                    type: "text/plain",
                  },
                );
                window.horus.saveFile(file);
              }}
            >
              <SaveIcon />
            </AppButton>
          }
        >
          <div
            className="hover-description"
            style={{
              position: "absolute",
              transform: "translateX(-30px) translateY(10px)",
            }}
          >
            Save logs
          </div>
        </HorusPopover>
      </div>

      <Editor
        value={logText}
        language={format}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
        }}
        onMount={(editor) => {
          codeRef.current = editor;
          editor.onDidScrollChange(() => {
            const scrollHeight = editor.getScrollHeight();
            const scrollTop = editor.getScrollTop();
            const clientHeight = editor.getLayoutInfo().height;
            setIsAtBottom(scrollTop + clientHeight === scrollHeight);
          });
        }}
      />
    </div>
  );

  if (fullScreen) {
    return createPortal(
      <BlurredModal
        onHide={() => setFullScreen(false)}
        show
        maxContentSize={{
          width: "95%",
          height: "95%",
        }}
      >
        {LoggingView}
      </BlurredModal>,
      document.documentElement,
    );
  }

  return LoggingView;
}
