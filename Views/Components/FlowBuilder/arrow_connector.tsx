import { useEffect, useRef } from "react";
import Xarrow, { refType, useXarrow, Xwrapper } from "react-xarrows";
import { BlockProps } from "./flow_builder_interfaces";
import { useDraggable } from "@dnd-kit/core";

interface ArrowConnectorProps {
  // The block that the arrow is coming from (html ref)
  from: React.MutableRefObject<any> | string;
  block: BlockProps;
}

function ArrowBlockConnector(props: ArrowConnectorProps) {
  const { from, block } = props;

  const ref = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `${block.placedID}-${block.id}-connector`,
    data: {
      type: "connector",
      block: block,
    },
  });

  useEffect(() => {
    setNodeRef(ref.current);
  }, [ref]);

  var style = {
    transform: null,
    alignItems: "center",
    textAling: "center",
  };

  if (transform) {
    style.transform = `translate(${transform.x}px, ${transform.y}px)`;
  }

  return (
    <>
      <div
        className={"connect-blocks"}
        ref={ref}
        style={style}
        {...listeners}
        {...attributes}
      >
        <div className="placed-id">{block.placedID}</div>
        {transform && <Xarrow start={from} end={ref} />}
      </div>
    </>
  );
}

interface PlacedXarrowProps {
  block: BlockProps;
  connectedBlock: BlockProps;
  setPlacedBlocks: React.Dispatch<React.SetStateAction<BlockProps[]>>;
}

function PlacedXarrow(props: PlacedXarrowProps) {
  const { block, connectedBlock, setPlacedBlocks } = props;

  return (
    <div
      onClick={(e) => {
        unconnectArrowBlock(setPlacedBlocks, block, connectedBlock);
      }}
    >
      <Xarrow
        start={`${block?.placedID}-${block.id}`}
        end={`${connectedBlock?.placedID}-${connectedBlock.id}`}
        key={`${block?.placedID}-${block.id}-${connectedBlock?.placedID}-${connectedBlock.id}`}
      />
    </div>
  );
}

export { ArrowBlockConnector, PlacedXarrow };

function unconnectArrowBlock(
  setPlacedBlocks: React.Dispatch<React.SetStateAction<BlockProps[]>>,
  currentBlock: BlockProps,
  connectedBlock: BlockProps
) {
  // Remove the connected block from the connectedTo array of the current block
  const newConnectedTo = currentBlock.connectedTo?.filter(
    (block) => block.placedID !== connectedBlock.placedID
  );

  // Remove the current block from the appearsOn array of the connected block
  const newAppearsOn = connectedBlock.appearsOn?.filter(
    (block) => block.placedID !== currentBlock.placedID
  );

  // Update the state
  setPlacedBlocks((blocks) => {
    const index = blocks.findIndex(
      (b) => b.placedID === currentBlock?.placedID
    );
    const newBlocks = [...blocks];
    newBlocks[index] = {
      ...newBlocks[index],
      connectedTo: newConnectedTo,
    };

    const overIndex = newBlocks.findIndex(
      (b) => b.placedID === connectedBlock?.placedID
    );
    newBlocks[overIndex] = {
      ...newBlocks[overIndex],
      appearsOn: newAppearsOn,
    };

    return newBlocks;
  });
}
