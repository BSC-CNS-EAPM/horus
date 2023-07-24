// =============================LIBRARIES==============================
// React basic library
import { useEffect, useRef, useState } from "react";

// Import drag and drop kit
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  pointerWithin,
  useSensor,
  useSensors,
  MouseSensor,
  getClientRect,
  MeasuringConfiguration,
} from "@dnd-kit/core";

// ====================================================================

// =============================COMPONENTS=============================
// Import the block list component
import { BlockList } from "./block_list";

// Import the flow reciver component
import { FlowReciver } from "./flow_reciver";

// Import the block component
import { Block } from "./block";
// ====================================================================

// =============================INTERFACES=============================
// Import the block interface
import { BlockProps, FlowBuilderProps } from "./flow_builder_interfaces";
// ====================================================================

import type { PointerEvent } from "react";
import { PointerSensor } from "@dnd-kit/core";

/**
 * An extended "PointerSensor" that prevent some
 * interactive html element(button, input, textarea, select, option...) from dragging
 */
export class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as any,
      handler: ({ nativeEvent: event }: PointerEvent) => {
        if (
          !event.isPrimary ||
          event.button !== 0 ||
          isInteractiveElement(event.target as Element)
        ) {
          return false;
        }

        return true;
      },
    },
  ];
}

function isInteractiveElement(element: Element | null) {
  const interactiveElements = [
    "button",
    "input",
    "textarea",
    "select",
    "option",
  ];
  if (
    element?.tagName &&
    interactiveElements.includes(element.tagName.toLowerCase())
  ) {
    return true;
  }

  return false;
}

export default function FlowBuilder(props: FlowBuilderProps) {
  const [placedBlocks, setPlacedBlocks] = useState<BlockProps[]>([]);
  const [draggingBlock, setDraggingBlock] = useState<BlockProps>();

  const mousePos = useRef({ x: 0, y: 0 });

  // Saved state
  const [saved, _setSaved] = useState(true);
  const currentSaved = useRef(saved);

  const setSaved = (value: boolean) => {
    currentSaved.current = value;
    _setSaved(value);
  };

  const placedIDCounter = useRef(1);

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingBlock(undefined);

    const { active, over, delta } = event;

    // Check for an arrow-block connection
    if (active.data.current.type === "connector") {
      handleArrowBlockConnection(event);
      return;
    }

    // Get the current dragged block
    const currentBlock = active.data.current?.block;

    if (!currentBlock) {
      return;
    }

    setSaved(false);

    // If its already placed, its a moving operations
    if (currentBlock.isPlaced) {
      handleBlockMove(event);
      return;
    }

    // If it is dropped inside the flow reciver
    // we add it to the current flow
    if (
      over &&
      over.id === "flow-reciver" &&
      currentBlock.parent === undefined
    ) {
      addBlockToFlow(currentBlock, event);
      return;
    }

    // Get the over block
    const overBlock = over?.data?.current?.block;

    if (!overBlock) {
      return;
    }
  };

  const handleArrowBlockConnection = (event: DragEndEvent) => {
    const { active, over } = event;

    // Get the current dragged arrow block
    const currentBlock = active.data.current?.block as BlockProps;

    // Get the over block
    const overBlock = over?.data?.current?.block as BlockProps;

    if (!currentBlock || !overBlock) {
      return;
    }

    connectArrowBlock(setPlacedBlocks, currentBlock, overBlock);
  };

  const handleBlockMove = (event: DragEndEvent) => {
    const { active, delta } = event;

    // Get the current dragged block
    const currentBlock = active.data.current?.block;

    if (!currentBlock) {
      return;
    }

    // Get the current position
    const currentPosition = currentBlock.coords;

    if (!currentPosition) {
      return;
    }

    const { over } = event;

    // If the over block is not the flow reciver, we don't move the block
    if (!over?.id) {
      return;
    }

    // Set the new position
    const newBlock = {
      ...currentBlock,
      coords: {
        x: currentPosition.x + delta.x,
        y: currentPosition.y + delta.y,
      },
    };

    // Update the state
    setPlacedBlocks((blocks) => {
      const index = blocks.findIndex(
        (b) => b.placedID === currentBlock?.placedID
      );

      const updatedBlocks = [...blocks];
      updatedBlocks[index] = newBlock;

      return updatedBlocks;
    });

    // Update the saved state
    setSaved(false);
  };

  function convertRemToPixels(rem) {
    return (
      rem * parseFloat(getComputedStyle(document.documentElement).fontSize)
    );
  }

  const addBlockToFlow = (block: BlockProps, event: DragEndEvent) => {
    const newBlock: BlockProps = {
      ...block,
      isPlaced: true,
      placedID: placedIDCounter.current,
      coords: {
        x: mousePos.current.x - convertRemToPixels(20),
        y: mousePos.current.y - convertRemToPixels(5 + 3.34),
      },
      variables: block.variables.map((variable) => {
        return {
          ...variable,
          placedID: placedIDCounter.current,
        };
      }),
    };

    const newPlacedBlocks = [...placedBlocks, newBlock];

    // Update the state
    setPlacedBlocks(newPlacedBlocks);

    // Update the placedIDCounter
    placedIDCounter.current += 1;
  };

  const handleBlockDrag = (event: DragStartEvent) => {
    // Get the current dragged block
    const { active } = event;

    if (active.data.current.type === "connector") {
      return;
    }

    const currentBlock = event.active.data.current.block;

    if (currentBlock.isPlaced) {
      return;
    }

    setDraggingBlock(currentBlock);
  };

  const mouseSensor = useSensor(SmartPointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });

  const handleMouseMove = (event) => {
    mousePos.current = {
      x: event.clientX - event.target.offsetLeft,
      y: event.clientY - event.target.offsetTop,
    };
  };

  const sensors = useSensors(mouseSensor);

  const measuring: MeasuringConfiguration = {
    droppable: {
      measure: getClientRect,
    },
  };

  // Events
  useEffect(() => {
    // Set a window event listener for the mousemove event
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    // Setup the drag and drop context
    // Added the onDragEnd event handler, so when blocks dropped
    // inside the flow reciver, we add it to the current flow
    <DndContext
      onDragEnd={handleDragEnd}
      onDragStart={handleBlockDrag}
      collisionDetection={pointerWithin}
      sensors={sensors}
      measuring={measuring}
    >
      <div className="m-auto flex flex-row h-100">
        {/* The block list coming from the server */}
        <BlockList />
        {/* The flow reciever, where blocks are already placed */}
        <FlowReciver
          flowName="New Flow"
          placedBlocks={placedBlocks}
          setPlacedBlocks={setPlacedBlocks}
          openFlow={props.openFlow}
          currentSaved={currentSaved}
          setSaved={setSaved}
          placedIDCounter={placedIDCounter}
        />
      </div>
      <DragOverlay dropAnimation={null}>
        {
          // If there is a block being dragged, show it
          draggingBlock && (
            <div
              style={{
                cursor: "grabbing",
              }}
            >
              <Block {...draggingBlock} isOnAir={true} />
            </div>
          )
        }
      </DragOverlay>
    </DndContext>
  );
}

export function connectArrowBlock(
  setPlacedBlocks: React.Dispatch<React.SetStateAction<BlockProps[]>>,
  currentBlock: BlockProps,
  overBlock: BlockProps
) {
  // Create a new block with the new connection
  // Adding to the connectedTo array the over block
  const newBlock = {
    ...currentBlock,
    connectedTo: currentBlock.connectedTo
      ? [...currentBlock.connectedTo, overBlock]
      : [overBlock],
  };

  // Update the over block with the new connection
  const newOverBlock = {
    ...overBlock,
    appearsOn: overBlock.appearsOn
      ? [...overBlock.appearsOn, newBlock]
      : [newBlock],
  };

  // Update the state
  setPlacedBlocks((blocks) => {
    const index = blocks.findIndex(
      (b) => b.placedID === currentBlock?.placedID
    );
    const newBlocks = [...blocks];
    newBlocks[index] = newBlock;

    const overIndex = newBlocks.findIndex(
      (b) => b.placedID === overBlock?.placedID
    );
    newBlocks[overIndex] = newOverBlock;

    return newBlocks;
  });
}