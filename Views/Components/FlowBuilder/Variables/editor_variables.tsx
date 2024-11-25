// React
import { useCallback, useState } from "react";

// Editor component
import Editor, { EditorProps } from "@monaco-editor/react";
import { VariableViewProps } from "./variables";
import AppButton from "../../appbutton";
import { createPortal } from "react-dom";
import { BlurredModal, HorusPopover } from "../../reusable";
import CenterView from "../../Toolbar/Icons/CenterView";

export function ObjectVariableView(props: VariableViewProps) {
  const [isWrongValue, setIsWrongValue] = useState<boolean>(false);

  const parseValueForDisplay = (value: object | null): string | null => {
    // Parse the value as a string to display in the editor
    // We should convert the Object to a JSON string

    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return null;
    }
  };

  const [currentValueAsString, setCurrentValueAsString] = useState<
    string | null
  >(parseValueForDisplay(props.variable.value));

  const parseValueForSave = useCallback(
    (value?: string) => {
      // Update the current value
      setCurrentValueAsString(value ?? "{}");

      try {
        props.onChange(JSON.parse(value ?? "{}"));
        setIsWrongValue(false);
      } catch (error) {
        setIsWrongValue(true);
      }
    },
    [props]
  );

  return (
    <div className="flex flex-col w-full h-full gap-1 justify-center">
      {isWrongValue && (
        <div className="text-red-500 text-center w-full">Invalid JSON</div>
      )}
      <HorusCodeEditor
        className="w-full h-full rounded-md border-red border-2 overflow-hidden"
        height="300px"
        defaultLanguage="json"
        value={currentValueAsString ?? undefined}
        defaultValue={props.variable.defaultValue ?? "{}"}
        onChange={parseValueForSave}
      />
    </div>
  );
}

export function CodeVariableView(props: VariableViewProps) {
  return (
    <HorusCodeEditor
      className="w-full h-full rounded-md border-red border-2 overflow-hidden"
      height="300px"
      defaultLanguage={props.variable.allowedValues[0] ?? "python"}
      value={props.variable.value}
      defaultValue={props.variable.defaultValue}
      onChange={(value) => props.onChange(value)}
    />
  );
}

function HorusCodeEditor(props: EditorProps) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const EditorView = (
    <div className="w-full h-full flex flex-col gap-3">
      <HorusPopover
        trigger={
          <AppButton
            action={() => {
              setIsFullscreen(!isFullscreen);
            }}
          >
            <CenterView />
          </AppButton>
        }
      >
        <div
          className="hover-description p-2"
          style={{
            position: "absolute",
            transform: "translateX(70px) translateY(5px)",
          }}
        >
          Toggle fullscreen
        </div>
      </HorusPopover>
      <Editor {...props} height={isFullscreen ? "95%" : props.height} />
    </div>
  );

  if (isFullscreen) {
    return createPortal(
      <BlurredModal
        onHide={() => setIsFullscreen(false)}
        show
        maxContentSize={{
          width: "95%",
          height: "95%",
        }}
      >
        {EditorView}
      </BlurredModal>,
      document.documentElement
    );
  }

  return EditorView;
}
