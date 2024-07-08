// React
import { useCallback, useState } from "react";

// Editor component
import Editor from "@monaco-editor/react";
import { VariableViewProps } from "./variables";

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
      <Editor
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

export function PythonVariableView(props: VariableViewProps) {
  return (
    <Editor
      className="w-full h-full rounded-md border-red border-2 overflow-hidden"
      height="300px"
      defaultLanguage={props.variable.allowedValues[0] ?? "python"}
      value={props.variable.value}
      defaultValue={props.variable.defaultValue}
      onChange={(value) => props.onChange(value)}
    />
  );
}
