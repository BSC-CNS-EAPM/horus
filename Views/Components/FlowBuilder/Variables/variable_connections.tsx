// React
import { CSSProperties, useContext, useEffect, useRef, useState } from "react";

// Horus components
import Xarrow from "react-xarrows";
import AppButton from "../../appbutton";
import { HorusPopover } from "../../reusable";
import SidebarView from "../../SidebarView/sidebar_view";
import {
  PluginVariableView,
  SimpleVariableView,
  VariableGroupInfoView,
} from "./variables";

// TS types
import {
  Block,
  BlockVarPair,
  DraggableEntity,
  DroppableEntity,
  PluginVariable,
  PluginVariableTypes,
} from "../flow.types";

// Icons
import Chevron from "../../Toolbar/Icons/Chevron";
import LockIcon from "../../Toolbar/Icons/Lock";

// Hooks
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { BlockHooks } from "../flow.hooks";
import { SearchComponent } from "@/Components/Search/Search";
import { FlowBuilderContext } from "@/Components/MainApp/PanelView";
import { useSettings } from "@/Main/app";

export function getBlockVarPair(
  block: Block,
  variable: PluginVariable
): BlockVarPair {
  return {
    placedID: block.placedID,
    blockID: block.id,
    blockType: block.type,
    variableID: variable.id,
    variableType: variable.type,
    variableAllowedValues: variable.allowedValues,
  } as BlockVarPair;
}

type VariableModalViewProps = {
  block: Block;
  handleVariableChange: (value: any, id: string, groupID?: string) => void;
};

export function VariableSetupView(props: VariableModalViewProps) {
  const { block, handleVariableChange } = props;

  const flowBuilderState = useContext(FlowBuilderContext);

  const isFlowActive = flowBuilderState?.flow.isFlowActive;

  const variables: PluginVariable[] = block.variables.map((variable) => {
    return {
      ...variable,
      placedID: block.placedID,
      disabled: !!isFlowActive || variable.disabled,
      block: block,
    } as PluginVariable;
  });

  const [filter, setFilter] = useState("");

  const groupedVariables = (() => {
    // Group the variables by category
    const groupedVariables: Record<string, PluginVariable[]> = {};

    const filteredVariables = filter
      ? variables.filter((variable) => {
          return (
            variable.name.toLowerCase().includes(filter.toLowerCase()) ||
            variable.description.toLowerCase().includes(filter.toLowerCase())
          );
        })
      : variables;

    filteredVariables.forEach((variable) => {
      if (!groupedVariables[variable.category]) {
        groupedVariables[variable.category] = [];
      }
      groupedVariables[variable.category]!.push(variable);
    });

    const groupedViews: Record<string, React.ReactNode[]> = {};

    for (const [category, gVariables] of Object.entries(groupedVariables)) {
      const variableViews = gVariables.map((gVar) => {
        return (
          <PluginVariableView
            key={gVar.id}
            variable={gVar}
            onChange={handleVariableChange}
            customClass="w-fit"
          />
        );
      });
      groupedViews[category] = [
        <div className="flex flex-col gap-2 flex-wrap">{variableViews}</div>,
      ];
    }
    return groupedViews;
  })();

  return (
    <div className="flex flex-col h-full p-2">
      <div className="sticky top-0 z-10">
        <div className="variables-modal-title-search gap-2 justify-between">
          <div
            className="font-semibold text-3xl break-all"
            style={{
              color: "var(--digital-grey-IV)",
            }}
          >
            {block.name}
          </div>
          <div className="flex flex-row gap-2">
            <SearchComponent
              placeholder="Search variables"
              onChange={(e) => {
                setFilter(e.target.value);
              }}
            />
          </div>
        </div>
        <hr className="my-4 p-0"></hr>
      </div>
      {block.variables && block.variables.length > 0 && (
        <SidebarView views={groupedVariables} />
      )}
    </div>
  );
}

function OutputVariableBallConnector({
  block,
  variable,
}: {
  block: Block;
  variable: PluginVariable;
}) {
  const id = `output-drag-${variable.id}-${block.placedID}-connector`;

  const { setNodeRef, transform, listeners, attributes, over } = useDraggable({
    id: id,
    data: {
      blockVarPair: getBlockVarPair(block, variable),
      type: DraggableEntity.CONNECTOR,
    },
  });

  let style: CSSProperties = {
    cursor: variable.disabled ? "not-allowed !important" : "grab",
    pointerEvents: variable.disabled ? "none" : "auto",
  };
  let scale = 1;

  if (transform) {
    // Get the scale of the flow canvas
    const flowCanvas = document.getElementById(DroppableEntity.SCALED_CANVAS)!;
    scale =
      1 /
      parseFloat(
        flowCanvas.style.transform.match(/scale\((.*?)\)/)?.[1] || "1"
      );
    style = {
      transform: `translate(${transform.x * scale - 15}px, ${
        transform.y * scale + 15
      }px)`,
      zIndex: 100,
      cursor: "grabbing",
    };
  }

  const ref = useRef(null);

  useEffect(() => {
    if (!variable.disabled) {
      setNodeRef(ref.current);
    }
  }, [ref]);

  const settings = useSettings();

  const arrowAppareance = settings?.["arrowLook"]?.value ?? "Curved";
  const path =
    arrowAppareance === "Curved" || arrowAppareance === "Extra curved"
      ? "smooth"
      : "grid";
  const curveness = arrowAppareance === "Extra curved" ? 1 : 0.35;

  let arrowColor = "var(--pop-code)";

  if (over?.id.toString().includes("connect")) {
    const overBlockVarPair: BlockVarPair | undefined =
      over.data?.current?.["blockVarPair"];

    if (overBlockVarPair) {
      const allowedConnection = compareAllowedValues(
        variable.type,
        overBlockVarPair.variableType,
        variable.allowedValues ?? [],
        overBlockVarPair.variableAllowedValues ?? []
      );

      arrowColor = allowedConnection ? "var(--pop-code)" : "var(--red-error)";
    }
  }

  return (
    <div id={id} className="w-full h-full">
      {transform && (
        <Xarrow
          SVGcanvasStyle={{
            scale: `${scale}`,
          }}
          start={id}
          end={ref}
          endAnchor={"right"}
          dashness={{ animation: -2 }}
          color={arrowColor}
          headShape={"circle"}
          path={path}
          curveness={curveness}
        />
      )}
      <HorusPopover
        cancelStyle
        triggerClassName={`flex flex-row gap-1 align-center items-center justify-between variable-squared h-full w-full ${
          variable.disabled && "cursor-not-allowed"
        }`}
        trigger={
          <>
            <div className="cut-text-nohover w-full">{variable.name}</div>
            <div
              style={{
                ...style,
              }}
              id={id}
              ref={variable.disabled ? null : ref}
              {...listeners}
              {...attributes}
            >
              {transform ? null : variable.disabled ? (
                <LockIcon />
              ) : (
                <Chevron direction="right" />
              )}
            </div>
          </>
        }
      >
        <div
          className="flex flex-col gap-2 rounded-xl p-2 shadow-md w-full flex-1"
          style={{
            border: "1px solid var(--pop-code)",
            position: "absolute",
            top: "4px",
            zIndex: Number.MAX_SAFE_INTEGER,
            minWidth: "400px",
            background: "white",
          }}
        >
          <SimpleVariableView variable={variable} />
        </div>
      </HorusPopover>
    </div>
  );
}

type PlacedBlockVariablesProps = {
  block: Block;
  blockHooks: BlockHooks;
  handleSelectedInputGroupChange: (direction: "up" | "down") => void;
};

export function PlacedBlockVariables(props: PlacedBlockVariablesProps) {
  const { block } = props;

  if (block.type === "input") {
    const outputVar = block.outputs[0];

    if (!outputVar) return null;

    return (
      <div className="cursor-auto">
        <OutputVariableBallConnector block={block} variable={outputVar} />
      </div>
    );
  }

  const visibleInputs = block.inputs.find(
    (input) => input.id === block.selectedInputGroup
  );

  return (
    <div className="flex flex-row gap-1 cursor-auto max-w-[350px]">
      {visibleInputs && (
        <div
          className="flex flex-col gap-1 h-full"
          style={{
            width: "100%",
            maxWidth: block.outputs.length > 0 ? "173px" : "100%",
          }}
        >
          {visibleInputs.variables.map((variable, index) => (
            <VariableInputConnectView
              key={index}
              variable={variable}
              block={block}
              connectingVariable={props.blockHooks.connectingVariable}
            />
          ))}
          <VariableInputSelector
            block={block}
            handleSelectedInputGroupChange={
              props.handleSelectedInputGroupChange
            }
          />
        </div>
      )}
      {block.outputs.length > 0 && (
        <div
          className="flex flex-col gap-1 h-full flex-1"
          style={{
            maxWidth: visibleInputs ? "173px" : "100%",
          }}
        >
          {block.outputs.map((output, index) => (
            <OutputVariableBallConnector
              key={index}
              block={block}
              variable={output}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VariableInputSelector({
  block,
  handleSelectedInputGroupChange,
}: {
  block: Block;
  handleSelectedInputGroupChange: (direction: "up" | "down") => void;
}) {
  if (block.inputs.length <= 1 || block.variableConnections.length > 0)
    return null;

  const selectedPageIndex = block.inputs.findIndex(
    (input) => input.id === block.selectedInputGroup
  );

  const selectedVariableInputGroup = block.inputs.find(
    (i) => i.id === block.selectedInputGroup
  );

  if (!selectedVariableInputGroup) return null;

  return (
    <div className="flex flex-row gap-1 items-center justify-between text-center p-0 m-0">
      <AppButton
        action={() => {
          handleSelectedInputGroupChange("down");
        }}
      >
        <Chevron direction="left" />
      </AppButton>
      <div className="app-button w-full text-center justify-center align-center items-center">
        <HorusPopover
          overrideClassName="w-full"
          trigger={
            <span>
              {selectedPageIndex + 1} of {block.inputs.length}
            </span>
          }
        >
          <div
            style={{
              position: "absolute",
              zIndex: Number.MAX_SAFE_INTEGER,
              minWidth: "400px",
              background: "white",
            }}
          >
            <VariableGroupInfoView group={selectedVariableInputGroup} />
          </div>
        </HorusPopover>
      </div>
      <AppButton
        action={() => {
          handleSelectedInputGroupChange("up");
        }}
      >
        <Chevron direction="right" />
      </AppButton>
    </div>
  );
}

type VariableConnectViewProps = {
  variable: PluginVariable;
  block: Block;
  connectingVariable: BlockVarPair | null;
};

function VariableInputConnectView(props: VariableConnectViewProps) {
  const blockVarPair: BlockVarPair = getBlockVarPair(
    props.block,
    props.variable
  );

  const id = `connect-${props.variable.id}-${props.block.placedID}`;

  const { setNodeRef, isOver, active } = useDroppable({
    id: id,
    data: {
      blockVarPair: blockVarPair,
      type: DroppableEntity.VARIABLE_CONNECTION,
    },
  });

  let allowedValues: Array<string> = [];

  if (props.variable?.allowedValues) {
    allowedValues = props.variable.allowedValues as Array<string>;
  }

  let classNameVariableBall: string = `variable-ball ${
    props.variable.required && "variable-ball-required"
  }`;

  if (props.connectingVariable) {
    const acceptConnection = compareAllowedValues(
      props.variable.type,
      props.connectingVariable.variableType,
      allowedValues as Array<string>,
      (props.connectingVariable.variableAllowedValues as Array<string>) ||
        ([] as Array<string>)
    );
    if (acceptConnection) {
      classNameVariableBall = "variable-ball variable-ball-accept";
    } else if (!acceptConnection) {
      classNameVariableBall = "variable-ball variable-ball-reject";
    }
  }

  const activePair = active?.data?.current?.["blockVarPair"] as BlockVarPair;

  if (isOver && activePair) {
    const acceptConnection = compareAllowedValues(
      props.variable.type,
      activePair.variableType,
      allowedValues as Array<string>,
      (activePair.variableAllowedValues as Array<string>) ||
        ([] as Array<string>)
    );

    if (acceptConnection) {
      classNameVariableBall =
        "variable-ball variable-ball-accept variable-ball-flashing";
    } else if (!acceptConnection) {
      classNameVariableBall =
        "variable-ball variable-ball-reject variable-ball-flashing";
    }
  }
  // If the active block is not a "connect", don't show the animation
  if (active?.data?.current?.["type"] !== "connector") {
    classNameVariableBall = `variable-ball ${
      props.variable.required && "variable-ball-required"
    }`;
  }

  const isAlreadyConnected = props.block.variableConnections.find(
    (connection) => connection.destination.variableID === props.variable.id
  );

  if (isAlreadyConnected) {
    const acceptConnection = compareAllowedValues(
      props.variable.type,
      isAlreadyConnected.origin.variableType,
      allowedValues as Array<string>,
      (isAlreadyConnected.origin.variableAllowedValues as Array<string>) ||
        ([] as Array<string>)
    );

    if (acceptConnection) {
      classNameVariableBall = "variable-ball variable-ball-connected";
    } else {
      classNameVariableBall = "variable-ball variable-ball-reject";
    }
  }

  return (
    <div
      ref={props.variable.disabled ? null : setNodeRef}
      id={id}
      className="h-full w-full"
    >
      <HorusPopover
        cancelStyle
        triggerClassName={`flex flex-row gap-1 align-center items-center variable-squared h-full w-full ${
          props.variable.disabled && "cursor-not-allowed"
        }`}
        trigger={
          <>
            {props.variable.disabled ? (
              <LockIcon />
            ) : (
              <div className={classNameVariableBall} />
            )}
            <div className="cut-text-nohover">{props.variable.name}</div>
          </>
        }
      >
        <div
          className="flex flex-col gap-2 rounded-xl p-2 shadow-md w-full flex-1"
          style={{
            border: "1px solid var(--pop-code)",
            position: "absolute",
            top: "4px",
            zIndex: Number.MAX_SAFE_INTEGER,
            minWidth: "400px",
            background: "white",
          }}
        >
          <SimpleVariableView variable={props.variable} />
        </div>
      </HorusPopover>
    </div>
  );
}

export function compareAllowedValues(
  variableType: PluginVariableTypes,
  otherVariableType: PluginVariableTypes,
  allowedValues: Array<string>,
  tryingToConnect: Array<string>
) {
  if (
    variableType === PluginVariableTypes.ANY ||
    otherVariableType === PluginVariableTypes.ANY
  ) {
    return true;
  }

  // For file type and group, check that the allowedValues of variable and other variable match
  if (
    variableType === PluginVariableTypes.FILE &&
    otherVariableType === PluginVariableTypes.FILE
  ) {
    if (allowedValues.includes("*") || tryingToConnect.includes("*")) {
      return true;
    }
  }

  // If its of type CUSTOM, check that at least one of the allowed values in either variable matches
  if (
    variableType === PluginVariableTypes.CUSTOM &&
    otherVariableType === PluginVariableTypes.CUSTOM
  ) {
    if (allowedValues.includes("*") || tryingToConnect.includes("*")) {
      return true;
    }

    for (let i = 0; i < allowedValues.length; i++) {
      if (tryingToConnect.includes(allowedValues[i]!)) {
        return true;
      }
    }
  }

  // If the input and output are different than FILE
  // check the type instead of the allowed values
  if (
    variableType !== PluginVariableTypes.FILE &&
    variableType !== PluginVariableTypes.GROUP &&
    variableType !== PluginVariableTypes._LIST &&
    variableType === otherVariableType
  ) {
    return true;
  }

  for (let i = 0; i < allowedValues.length; i++) {
    if (tryingToConnect.includes(allowedValues[i]!)) {
      return true;
    }
  }

  return false;
}
