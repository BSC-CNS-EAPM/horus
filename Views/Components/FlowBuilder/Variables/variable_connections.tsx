// React
import { CSSProperties, useEffect, useRef, useState } from "react";

// Horus components
import SidebarView from "../../SidebarView/sidebar_view";
import AppButton from "../../appbutton";
import { SearchComponent } from "../../Toolbar/toolbar";
import { InputView, PluginVariableView, SimpleVariableView } from "./variables";
import { BlurredModal } from "../../reusable";
import Xarrow from "react-xarrows";

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

// Hooks
import { BlockHooks } from "../flow.hooks";
import { useDraggable, useDroppable } from "@dnd-kit/core";

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
  handleChange: (value: any, id: string, groupID?: string) => void;
  handleClose?: () => void;
};

export function VariableModalView(props: VariableModalViewProps) {
  const { block, handleChange } = props;

  const variables = block.variables;

  const [filteredVariables, setFilteredVariables] = useState(variables);

  const filterVariables = (event: any) => {
    const value = event.target.value;
    const filteredVariables = variables.filter((variable) => {
      return (
        variable.name.toLowerCase().includes(value.toLowerCase()) ||
        variable.description.toLowerCase().includes(value.toLowerCase())
      );
    });

    setFilteredVariables(filteredVariables);
  };

  const getGroupedVariables = () => {
    // Group the variables by category
    const groupedVariables: Record<string, PluginVariable[]> = {};

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
            onChange={handleChange}
            customClass="w-fit"
          />
        );
      });
      groupedViews[category] = [
        <div className="flex flex-col gap-2 flex-wrap">{variableViews}</div>,
      ];
    }

    // Add a section for the inputs
    groupedViews["Block inputs"] = [
      <div className="flex flex-row gap-2 flex-wrap">
        <InputView groups={block.inputs} />
      </div>,
    ];

    // And for the outputs
    groupedViews["Block outputs"] = [
      <div className="flex flex-row gap-2 flex-wrap">
        {block.outputs.map((variable, index) => (
          <SimpleVariableView
            key={
              variable.id + "-" + index + "-" + block.id + "-" + block.placedID
            }
            variable={variable}
          />
        ))}
      </div>,
    ];

    return groupedViews;
  };

  return (
    <BlurredModal
      show
      onHide={() => {
        props?.handleClose?.();
      }}
      maxContentSize={{
        height: "h-[85%]",
        width: "w-[60%]",
      }}
    >
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10">
          <div className="variables-modal-title-search">
            <div
              className="font-semibold text-3xl"
              style={{
                color: "var(--digital-grey-IV)",
              }}
            >
              {block.name}
            </div>
            <div className="flex flex-row gap-2">
              <SearchComponent
                placeholder="Search variables"
                onChange={filterVariables}
              />
              {props.handleClose && (
                <AppButton action={props.handleClose}>Close</AppButton>
              )}
            </div>
          </div>
          <hr className="my-4 p-0"></hr>
        </div>
        {block.variables && block.variables.length > 0 && (
          <SidebarView views={getGroupedVariables()} />
        )}
      </div>
    </BlurredModal>
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

  const { setNodeRef, transform, listeners, attributes } = useDraggable({
    id: id,
    data: {
      blockVarPair: getBlockVarPair(block, variable),
      type: DraggableEntity.CONNECTOR,
    },
  });

  let style: CSSProperties = {
    cursor: "grab",
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
      transform: `translate(${transform.x * scale}px, ${
        transform.y * scale
      }px)`,
      zIndex: 100,
      cursor: "grabbing",
    };
  }

  const ref = useRef(null);

  useEffect(() => {
    setNodeRef(ref.current);
  }, [ref]);

  return (
    <div
      id={id}
      className="flex flex-row gap-1 align-center items-center justify-between variable-squared h-full"
    >
      <div className="cut-text">{variable.name}</div>
      <div style={style} id={id} ref={ref} {...listeners} {...attributes}>
        {transform ? (
          <Xarrow
            SVGcanvasStyle={{ scale: `${scale}` }}
            start={id}
            end={ref}
            endAnchor={"right"}
            dashness={{ animation: -2 }}
            color={"var(--pop-code)"}
            headShape={"circle"}
            path="grid"
          />
        ) : (
          <Chevron direction="right" />
        )}
      </div>
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

  if (!visibleInputs) return null;

  return (
    <div className="flex flex-row gap-1 variable-ball-group variable-ball-group-shown half-variable-connector-container cursor-auto justify-between">
      <div className="flex flex-col gap-1 h-full">
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
          handleSelectedInputGroupChange={props.handleSelectedInputGroupChange}
        />
      </div>
      <div className="flex flex-col gap-1 h-full">
        {block.outputs.map((output, index) => (
          <OutputVariableBallConnector
            key={index}
            block={block}
            variable={output}
          />
        ))}
      </div>
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

  return (
    <div className="flex flex-row gap-1 items-center justify-between text-center p-0 m-0">
      <AppButton
        action={() => {
          handleSelectedInputGroupChange("down");
        }}
      >
        <Chevron direction="left" />
      </AppButton>
      <div className="app-button">
        {selectedPageIndex + 1} / {block.inputs.length}
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
  const compareAllowedValues = (
    variableType: PluginVariableTypes,
    otherVariableType: PluginVariableTypes,
    allowedValues: Array<string>,
    tryingToConnect: Array<string>
  ) => {
    if (
      variableType === PluginVariableTypes.ANY ||
      otherVariableType === PluginVariableTypes.ANY
    ) {
      return true;
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

    for (let i = 0; i < allowedValues.length; i++) {
      if (tryingToConnect.includes(allowedValues[i]!)) {
        return true;
      }
    }
    return false;
  };

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

  let classNameVariableBall: string = "variable-ball";
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
    classNameVariableBall = "variable-ball";
  }

  const isAlreadyConnected = props.block.variableConnections.find(
    (connection) => connection.destination.variableID === props.variable.id
  );

  if (isAlreadyConnected) {
    classNameVariableBall = "variable-ball variable-ball-connected";
  }

  return (
    <div
      ref={setNodeRef}
      id={id}
      className="flex flex-row gap-1 align-center items-center variable-squared h-full"
    >
      <div className={classNameVariableBall} />
      <div className="cut-text">{props.variable.name}</div>
    </div>
  );
}
