// React
import { useCallback, useContext, useEffect, useState } from "react";

// Editor component
import Editor, { EditorProps } from "@monaco-editor/react";
import { VariableViewProps } from "./variables";
import AppButton from "../../appbutton";
import { HorusPopover } from "../../reusable";
import CenterView from "../../Toolbar/Icons/CenterView";
import {
  DockContext,
  FlowBuilderContext,
  PANEL_REGISTRY,
  togglePanel,
} from "@/Components/MainApp/PanelView";
import { PluginVariable } from "../flow.types";

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
      <HorusSmallVariableCodeEditor
        variable={props.variable}
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
    <HorusSmallVariableCodeEditor
      variable={props.variable}
      className="w-full h-full rounded-md border-2 overflow-hidden"
      height="300px"
      defaultLanguage={props.variable.allowedValues[0] ?? "python"}
      value={props.variable.value}
      defaultValue={props.variable.defaultValue}
      onChange={(value) => props.onChange(value)}
    />
  );
}

export function HorusSmallVariableCodeEditor(
  props: EditorProps & { variable: PluginVariable }
) {
  const { dockApi } = useContext(DockContext);

  const flowContext = useContext(FlowBuilderContext);

  const isFlowActive = !!flowContext?.flow.isFlowActive;

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const panelID = `variable-code-editor-${props.variable.id}-${props.variable.placedID}`;

  useEffect(() => {
    if (dockApi) {
      dockApi.onDidRemovePanel(() => {
        const exists = dockApi.getPanel(panelID);
        setIsFullscreen(!!exists);
      });
    }
  }, [dockApi, panelID]);

  useEffect(() => {
    if (dockApi) {
      const exists = dockApi.getPanel(panelID);
      exists?.api.updateParameters({
        onChange: props.onChange,
        options: { readOnly: isFlowActive },
      });
    }
  }, [dockApi, isFlowActive, panelID, props.onChange]);

  useEffect(() => {
    if (dockApi) {
      setIsFullscreen(!!dockApi.getPanel(panelID));
    }
  }, [dockApi, panelID]);

  // When unmounting, close the code panels too
  useEffect(() => {
    return () => {
      const panel = dockApi?.getPanel(panelID);
      if (panel) {
        dockApi?.removePanel(panel);
      }
    };
  }, [dockApi, panelID]);

  if (isFullscreen) {
    return (
      <div className="flex flex-col items-center w-full justify-center gap-2">
        <span>The editor is in another panel</span>
        <AppButton
          action={() => {
            setIsFullscreen(false);
            if (dockApi) {
              const panel = dockApi.getPanel(panelID);
              if (panel) {
                dockApi.removePanel(panel);
              }
            }
          }}
        >
          Attach
        </AppButton>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div
        style={{
          position: "absolute",
          top: "0.5rem",
          right: "0.5rem",
          zIndex: 10,
        }}
      >
        <HorusPopover
          trigger={
            <AppButton
              action={() => {
                if (dockApi) {
                  setIsFullscreen(true);
                  togglePanel({
                    dockApi,
                    component: PANEL_REGISTRY.codeEditor.component,
                    title: `${props.variable.name} - Block ${props.variable.placedID} - Code Editor`,
                    panelID,
                    params: {
                      placedID: props.variable.placedID,
                      defaultLanguage: props.defaultLanguage,
                      value: props.value,
                      defaultValue: props.defaultValue,
                      onChange: props.onChange,
                    },
                  });
                }
              }}
            >
              <CenterView />
            </AppButton>
          }
        >
          <div
            className="hover-description"
            style={{
              position: "absolute",
              transform: "translateX(-40px) translateY(10px)",
            }}
          >
            Detach
          </div>
        </HorusPopover>
      </div>
      <Editor {...props} />
    </div>
  );
}
