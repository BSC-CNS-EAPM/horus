// Import drag and drop kit
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";

// Components
import { BlockListView } from "./block_list_view";

// Import the flow reciver component
import { FlowReciver } from "./flow_reciver_view";

// Import the block component
import { BlockView } from "./block_view";

// Import the useFlowBuilder hook
import { useFlowBuilder } from "./flow_builder_hooks";

/**
 * Renders the flow builder component, which displays a canvas where the user can build a flow
 * along with a list of draggable blocks that can be added to the canvas.
 * @param props The props for the flow builder
 * @returns The flow builder component
 */
function FlowBuilderView() {
  // Flow builder state
  const flowBuilderState = useFlowBuilder();

  return (
    // Setup the drag and drop context
    // Added the onDragEnd event handler, so when blocks dropped
    // inside the flow reciver, we add it to the current flow
    <DndContext
      onDragEnd={flowBuilderState.handleDragEnd}
      onDragStart={flowBuilderState.handleBlockDrag}
      collisionDetection={pointerWithin}
      sensors={flowBuilderState.dndTweaks.sensors}
      measuring={flowBuilderState.dndTweaks.measuring}
    >
      <div className="m-auto flex flex-row h-100" id="flow-builder-div">
        {/* The block list coming from the server */}
        <BlockListView
          flowBuilderController={flowBuilderState.flowBuilderController}
        />
        {/* The flow reciever, where blocks are already placed */}
        <FlowReciver
          flowName="New Flow"
          placedBlocks={flowBuilderState.placedBlocks}
          setPlacedBlocks={flowBuilderState.setPlacedBlocks}
          currentSaved={flowBuilderState.currentSaved}
          setSaved={flowBuilderState.setSaved}
          placedIDCounter={flowBuilderState.placedIDCounter}
          flowBuilderController={flowBuilderState.flowBuilderController}
          unconnectBlocks={flowBuilderState.unconnectBlocks}
          unconnectVariables={flowBuilderState.unconnectVariables}
          isConnecting={flowBuilderState.isConnecting}
          tryingToConnect={flowBuilderState.tryingToConnect}
        />
      </div>
      <DragOverlay dropAnimation={null}>
        {
          // If there is a block being dragged, show it
          flowBuilderState.draggingBlock && (
            <div
              style={{
                cursor: "grabbing",
              }}
            >
              <BlockView {...flowBuilderState.draggingBlock} />
            </div>
          )
        }
      </DragOverlay>
    </DndContext>
  );
}

export { FlowBuilderView };
