
// =============================LIBRARIES==============================
// React basic library
import { useState } from "react";

// Import drag and drop kit
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useSensor, MouseSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from "@dnd-kit/sortable";
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

        // Get the current dragged block
        const currentBlock = event.active.data.current.block

        // Get where it is dropped
        const { over } = event;

        // If its a sorting operation
        if (currentBlock.isPlaced && currentBlock.parent === undefined) {
            handleBlockSort(event)
            return
        }

        // If it is dropped inside the flow reciver
        // we add it to the current flow
        if (over && over.id === "flow-reciver" && currentBlock.parent === undefined) {
            addBlockToFlow(currentBlock)
            return
        }

        // If it is dropped inside a sub block container
        if (over && over.id === `sub-block-${currentBlock.parent?.id}`) {
            addSubBlock(currentBlock)
            return
        }

        // If its a sorting operation inside a sub block container
        if (over && over.data.current?.block.parent?.id === currentBlock.parent?.id) {
            handleSubBlockSort(event)
            return
        }
    }

    const addBlockToFlow = (block: BlockProps) => {
        setPlacedBlocks([...placedBlocks, { ...block, isPlaced: true, placedID: placedBlocks.length }])
    }

    const addSubBlock = (block: BlockProps) => {
        // Get the parent block
        const parent = placedBlocks.find((b) => b.id === block.parent?.id)

        // Define the placedSubBlocks array if it's not defined
        if (!parent?.placedSubBlocks) {
            parent.placedSubBlocks = []
        }

        // Add to the parent .placedSubBlocks the current block
        parent?.placedSubBlocks?.push({ ...block, isPlaced: true, placedID: parent.placedSubBlocks.length })

        // Update the parent block
        setPlacedBlocks((blocks) => {
            const index = blocks.findIndex((b) => b.id === parent?.id)
            blocks[index] = parent
            return blocks
        }
        )

    }

    const handleBlockDrag = (event: DragStartEvent) => {
        const currentBlock = event.active.data.current.block
        setDraggingBlock(currentBlock)
    }

    const handleBlockSort = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setPlacedBlocks((blocks) => {
                const oldIndex = blocks.findIndex((b) => b.id === active.id);
                const newIndex = blocks.findIndex((b) => b.id === over.id);

                return arrayMove(blocks, oldIndex, newIndex);
            });
        }
    };

    const handleSubBlockSort = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            const parent = placedBlocks.find((b) => b.id === active.data.current.block.parent?.id)

            if (parent?.placedSubBlocks) {
                parent.placedSubBlocks = arrayMove(parent.placedSubBlocks, parent.placedSubBlocks.findIndex((b) => b.id === active.id), parent.placedSubBlocks.findIndex((b) => b.id === over.id))
            }

            setPlacedBlocks((blocks) => {
                const index = blocks.findIndex((b) => b.id === parent?.id)
                blocks[index] = parent
                return blocks
            })
        }
    }

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
        <DndContext onDragEnd={handleDragEnd} onDragStart={handleBlockDrag} sensors={sensors}>
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