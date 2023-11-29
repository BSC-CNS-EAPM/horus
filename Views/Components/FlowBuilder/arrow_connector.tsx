import { useEffect, useRef, useState } from "react";
import Xarrow from "react-xarrows";
import { Block, PluginVariable } from "./flow_builder_types";
import { useDraggable } from "@dnd-kit/core";
import { BlockVarPair } from "./flow_builder_types";

interface ArrowConnectorProps {
  /**
   * The variable that the arrow is coming from (html ref)
   */
  from: React.MutableRefObject<any> | string;

  /**
   * The block that the arrow is coming from
   */
  block: Block;
}

function ArrowBlockConnector(props: ArrowConnectorProps) {
  const { from, block } = props;

  const ref = useRef<HTMLDivElement>(null);

  const blockVarPair: BlockVarPair = {
    placedID: block.placedID,
    blockID: block.id,
    blockType: block.type,

    variableID: null,
    variableType: null,
    variableAllowedValues: null,
  };

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `${block.placedID}-${block.id}-connector`,
    data: {
      type: "connector",
      blockVarPair: blockVarPair,
    },
  });

  useEffect(() => {
    setNodeRef(ref.current);
  }, [ref]);

  var style: React.CSSProperties = {
    transform: null,
    alignItems: "center",
    textAlign: "center",
    cursor: "grab",
    filter: "brightness(0%)",
  };

  let arrow = "arrow-right";
  if (transform) {
    style.transform = `translate(${transform.x}px, ${transform.y}px)`;
    style.cursor = "grabbing";
    arrow = null;
  }

  return (
    <div
      ref={ref}
      className="connect-blocks"
      style={style}
      {...listeners}
      {...attributes}
    >
      <div className={arrow}>
        {transform && (
          <Xarrow
            start={from}
            end={ref}
            endAnchor={"right"}
            dashness={{ animation: -2 }}
            color={"black"}
          />
        )}
      </div>
    </div>
  );
}

function CyclesView(props: {
  currentCycle: number;
  cycleNumber: number;
  destination: BlockVarPair;
  setCycles: (destination: BlockVarPair, cycleNumber: number) => void;
}) {
  const { destination, cycleNumber, setCycles, currentCycle } = props;

  const [inputValue, setInputValue] = useState(cycleNumber);

  const updateCycleNumber = (e: any) => {
    const value = parseInt(e.target.value);
    if (value > 0) {
      setCycles(destination, value);
      setInputValue(cycleNumber);
    }
  };

  const handleOnChangeEvent = (e: any) => {
    const value = parseInt(e.target.value);
    if (value > 0) {
      setInputValue(value);
    }
  };

  const handleBlur = (e) => {
    updateCycleNumber(e);
  };

  useEffect(() => {
    setInputValue(cycleNumber);
  }, [cycleNumber]);

  return (
    <div className="cycles-box flex flex-row gap-1 w-48 justify-around bg-white">
      Cycles:
      <div className="text-center flex flex-row gap-2">
        <div>{currentCycle}</div>
        <div>/</div>
        <div className="w-12">
          <input
            type="number"
            value={inputValue}
            onChange={handleOnChangeEvent}
            onBlur={handleBlur}
          />
        </div>
      </div>
    </div>
  );
}

type VariableConnectionArrowProps = {
  connection: {
    origin: BlockVarPair;
    destination: BlockVarPair;
  };
  unconnectVariables: (connection: {
    origin: BlockVarPair;
    destination: BlockVarPair;
  }) => void;
  currentCycle: number;
  isCyclic: boolean;
  cycleNumber: number;
  updateCyclesCount: (destination: BlockVarPair, cycleNumber: number) => void;
};

function VariableConnectionArrow(props: VariableConnectionArrowProps) {
  const { origin, destination } = props.connection;
  const {
    unconnectVariables,
    isCyclic,
    currentCycle,
    cycleNumber,
    updateCyclesCount,
  } = props;

  const start = `output-drag-${origin.variableID}-${origin.placedID}-connector`;
  const end = `connect-${destination.variableID}-${destination.placedID}`;

  const key = `variable-connection-arrow-${start}-${end}-${isCyclic}-${cycleNumber}`;

  return (
    <div
      key={key}
      id="variable-connection-arrow"
      onClick={(e: any) => {
        const isPath = e.target.tagName.toLowerCase() === "path";
        if (isPath) {
          unconnectVariables(props.connection);
        }
      }}
      className="absolute"
    >
      <Xarrow
        start={start}
        end={end}
        key={start + end}
        endAnchor={["left", "bottom", "top"]}
        startAnchor={["right", "top", "bottom"]}
        color={isCyclic ? "#f57f17" : "#0d47a1"}
        curveness={0.8}
        labels={
          isCyclic
            ? {
                middle: (
                  <CyclesView
                    cycleNumber={cycleNumber}
                    setCycles={updateCyclesCount}
                    destination={destination}
                    currentCycle={currentCycle}
                  />
                ),
              }
            : null
        }
      />
    </div>
  );
}

type BlockConnectionArrowProps = {
  currentBlock: Block;
  connectedBlock: Block;
  unconnectBlocks: (currentBlock: Block, connectedBlock: Block) => void;
};

function BlockConnectionArrow(props: BlockConnectionArrowProps) {
  const { currentBlock, connectedBlock, unconnectBlocks } = props;

  const start = `${currentBlock.placedID}-${currentBlock.id}`;
  const end = `${connectedBlock.placedID}-${connectedBlock.id}`;

  return (
    <div
      key={"div-block-connect" + start + end}
      onClick={(e) => {
        unconnectBlocks(currentBlock, connectedBlock);
      }}
    >
      <Xarrow
        start={start}
        end={end}
        key={start + end}
        startAnchor={["left", "right", "top"]}
        endAnchor={["left", "right", "top"]}
        animateDrawing={0.25}
        color="black"
      />
    </div>
  );
}

export { ArrowBlockConnector, VariableConnectionArrow, BlockConnectionArrow };
