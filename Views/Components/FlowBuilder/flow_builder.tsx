// =============================LIBRARIES==============================
// React basic library
import { useEffect, useRef, useState } from "react";

// Import drag and drop kit
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  MouseSensor,
  useSensors,
  pointerWithin,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
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

export default function FlowBuilder(props: FlowBuilderProps) {
  const [placedBlocks, setPlacedBlocks] = useState<BlockProps[]>([]);
  const [draggingBlock, setDraggingBlock] = useState<BlockProps>();

  const placedIDCounter = useRef(1);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Get the current dragged block
    const currentBlock = active.data.current?.block;

    if (!currentBlock) {
      return;
    }

    // If its a sorting operation
    if (currentBlock?.isPlaced && currentBlock.parent === undefined) {
      handleBlockSort(event);
      return;
    }

    // If it is dropped inside the flow reciver
    // we add it to the current flow
    if (
      over &&
      over.id === "flow-reciver" &&
      currentBlock.parent === undefined
    ) {
      addBlockToFlow(currentBlock);
      return;
    }

    // Get the over block
    const overBlock = over?.data?.current?.block;

    if (!overBlock) {
      return;
    }

    // If it is dropped inside a sub block container
    if (
      over &&
      over.id === `${overBlock.placedID}-sub-block-${currentBlock.parent?.id}`
    ) {
      addSubBlock(event);
      return;
    }

    // If its a sorting operation inside a sub block container
    if (over && overBlock.parent?.id === currentBlock?.parent?.id) {
      handleSubBlockSort(event);
      return;
    }
  };

  const addBlockToFlow = (block: BlockProps) => {
    setPlacedBlocks([
      ...placedBlocks,
      { ...block, isPlaced: true, placedID: placedIDCounter.current++ },
    ]);
    // Log the new placed block
    console.log(placedBlocks);
  };

  const addSubBlock = (event: DragEndEvent) => {
    const { active, over } = event;

    // Get the current dragged block
    const block = active.data.current.block;

    if (!block || block.isPlaced) {
      return;
    }

    // Get the parent block
    const parent = placedBlocks.find(
      (b) => b.placedID === over.data.current?.block.placedID
    );

    // Define the placedSubBlocks array if it's not defined
    if (!parent?.placedSubBlocks) {
      parent.placedSubBlocks = [];
    }

    // Remove from the parent the placedSubBlocks so no circular structure is created
    const newParent = { ...parent };
    delete newParent.placedSubBlocks;

    // Add to the parent .placedSubBlocks the current block
    parent?.placedSubBlocks?.push({
      ...block,
      isPlaced: true,
      placedID: placedIDCounter.current++,
      parent: newParent,
    });

    // Update the parent block
    setPlacedBlocks((blocks) => {
      const index = blocks.findIndex((b) => b.placedID === parent?.placedID);
      blocks[index] = parent;
      return blocks;
    });
  };

  const handleBlockDrag = (event: DragStartEvent) => {
    const currentBlock = event.active.data.current.block;
    setDraggingBlock(currentBlock);
  };

  const handleBlockSort = (event: DragEndEvent) => {
    const { active, over } = event;

    const currentBlock = active?.data?.current?.block;
    const overBlock = over?.data?.current?.block;

    if (!currentBlock || !overBlock) {
      return;
    }

    if (active.id !== over.id) {
      setPlacedBlocks((blocks) => {
        const oldIndex = blocks.findIndex(
          (b) => b.placedID === currentBlock.placedID
        );
        const newIndex = blocks.findIndex(
          (b) => b.placedID === overBlock.placedID
        );

        return arrayMove(blocks, oldIndex, newIndex);
      });
    }
  };

  const handleSubBlockSort = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const parent = placedBlocks.find(
        (b) => b.placedID === over.data.current.block.parent?.placedID
      );

      if (parent?.placedSubBlocks) {
        parent.placedSubBlocks = arrayMove(
          parent.placedSubBlocks,
          parent.placedSubBlocks.findIndex(
            (b) => b.placedID === active.data.current.block.placedID
          ),
          parent.placedSubBlocks.findIndex(
            (b) => b.placedID === over.data.current.block.placedID
          )
        );
      }

      setPlacedBlocks((blocks) => {
        const index = blocks.findIndex((b) => b.placedID === parent?.placedID);
        blocks[index] = parent;
        return blocks;
      });
    }
  };

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5,
    },
  });

  const sensors = useSensors(mouseSensor);

  return (
    // Setup the drag and drop context
    // Added the onDragEnd event handler, so when blocks dropped
    // inside the flow reciver, we add it to the current flow
    <DndContext
      onDragEnd={handleDragEnd}
      onDragStart={handleBlockDrag}
      sensors={sensors}
      collisionDetection={pointerWithin}
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
        />
      </div>
      <DragOverlay dropAnimation={null}>
        <Block {...draggingBlock} isOnAir={true} />
      </DragOverlay>
    </DndContext>
  );
}
