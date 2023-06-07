
// =============================LIBRARIES==============================
// React basic library
import { useState } from "react";

// Import drag and drop kit
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
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

    const [placedBlocks, setPlacedBlocks] = useState<BlockProps[]>([])
    const [draggingBlock, setDraggingBlock] = useState<BlockProps>()

    const handleDragEnd = (event: DragEndEvent) => {

        const currentBlock = event.active.data.current.block

        if (currentBlock.isPlaced) {
            handleBlockSort(event)
        } else {
            addBlock(currentBlock)
        }
    }

    const addBlock = (block: BlockProps) => {
        setPlacedBlocks([...placedBlocks, { ...block, isPlaced: true }])
    }

    const handleBlockDrag = (event: DragStartEvent) => {
        const currentBlock = event.active.data.current.block
        setDraggingBlock(currentBlock)
    }

    const handleBlockSort = (event: DragEndEvent) => {
        const { active, over } = event;

        console.log("Sorting!")
    };

    return (
        // Setup the drag and drop context
        // Added the onDragEnd event handler, so when blocks dropped
        // inside the flow reciver, we add it to the current flow
        <DndContext onDragEnd={handleDragEnd} onDragStart={handleBlockDrag}>
            <div className="m-auto flex flex-row h-100">
                {/* The block list coming from the server */}
                <BlockList />
                {/* The flow reciever, where blocks are already placed */}
                <FlowReciver
                    flowName="New Flow"
                    placedBlocks={placedBlocks}
                    setPlacedBlocks={setPlacedBlocks}
                />
            </div>
            <DragOverlay>
                <Block {...draggingBlock} />
            </DragOverlay>
        </DndContext>
    )
}