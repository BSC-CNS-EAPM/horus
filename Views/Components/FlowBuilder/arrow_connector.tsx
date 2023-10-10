import { useEffect, useRef } from "react";
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

type VariableConnectionArrowProps = {
  connection: {
    origin: BlockVarPair;
    destination: BlockVarPair;
  };
  unconnectVariables: (connection: {
    origin: BlockVarPair;
    destination: BlockVarPair;
  }) => void;
  isSecond: boolean;
  cycleNumber: number;
};

function VariableConnectionArrow(props: VariableConnectionArrowProps) {
  const { origin, destination } = props.connection;
  const { unconnectVariables, isSecond, cycleNumber } = props;

  const start = `output-drag-${origin.variableID}-${origin.placedID}-connector`;
  const end = `connect-${destination.variableID}-${destination.placedID}`;

  return (
    <div
      key={"div-variable" + start + end}
      onClick={(e) => {
        unconnectVariables(props.connection);
      }}
    >
      <Xarrow
        start={start}
        end={end}
        key={start + end}
        endAnchor={["left"]}
        startAnchor={["right"]}
        color={isSecond ? "#f57f17" : "#0d47a1"}
        labels={
          isSecond && {
            start: <div>Cycles: {cycleNumber}</div>,
          }
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
