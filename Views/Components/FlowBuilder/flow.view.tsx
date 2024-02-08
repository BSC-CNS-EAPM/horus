// Import drag and drop kit
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";

// Components
import { BlockListSidebar } from "./Sidebar/block_list_view";

// Import the flow reciver component
import { FlowCanvas } from "./Canvas/canvas";

// Import the block component
import { BlockView } from "./Blocks/block.view";

// Import the useFlowBuilder hook
import { useFlowBuilder } from "./flow.hooks";
import { CSSProperties } from "react";
import { BlurredModal } from "../reusable";
import RotatingLines from "../RotatingLines/rotatinglines";
import { ServerFileExplorerModal } from "../FileExplorer/file_explorer";
import { ConnectedArrows } from "./Connections/arrows";
import { Xwrapper } from "react-xarrows";
import { DroppableEntity } from "./flow.types";

export enum FlowBuilderIDs {
  FLOW_BUILDER_DIV = "flow-builder-div",
}

/**
 * Renders the flow builder component, which displays a canvas where the user can build a flow
 * along with a list of draggable blocks that can be added to the canvas.
 * @param props The props for the flow builder
 * @returns The flow builder component
 */
function FlowBuilderView() {
  // Flow builder state
  const flowBuilderState = useFlowBuilder();

  const style: CSSProperties = {
    cursor: flowBuilderState.handleMouse.isPanning
      ? "grabbing"
      : flowBuilderState.flow.isFlowActive
      ? "wait"
      : "auto",
  };

  return (
    // Setup the drag and drop context
    // Added the onDragEnd event handler, so when blocks dropped
    // inside the flow reciver, we add it to the current flow
    <div
      className="h-full"
      onMouseMove={flowBuilderState.handleMouse.handleMouseMove}
    >
      <DndContext
        onDragEnd={flowBuilderState.dnd.handleDragEnd}
        onDragStart={flowBuilderState.dnd.handleDragStart}
        collisionDetection={pointerWithin}
        sensors={flowBuilderState.dnd.dndTweaks.sensors}
        measuring={flowBuilderState.dnd.dndTweaks.measuring}
      >
        <div
          className="m-auto flex flex-row h-100 relative"
          id={FlowBuilderIDs.FLOW_BUILDER_DIV}
          style={style}
        >
          {/* The block list coming from the server */}
          <BlockListSidebar />
          {/* The flow reciever, where blocks are already placed */}
          <FlowCanvas
            flowHooks={flowBuilderState.flow}
            mouseHooks={flowBuilderState.handleMouse}
          >
            <Xwrapper>
              {flowBuilderState.flow.blockConnections.map((connection) => {
                return (
                  <ConnectedArrows
                    key={`${connection.origin.placedID}-${connection.destination.placedID}`}
                    connection={connection}
                    blockHooks={flowBuilderState.block}
                    scale={flowBuilderState.flow.scale}
                  />
                );
              })}
              <div
                style={{
                  transform: `scale(${flowBuilderState.flow.scale})`,
                }}
                className="scaled-flow-canvas"
                id={DroppableEntity.SCALED_CANVAS}
              >
                {flowBuilderState.flow.flow.blocks.length === 0 && (
                  <div
                    className="text-center text-gray-400 flex justify-center items-center h-full w-full"
                    style={{
                      position: "absolute",
                      transform: "translate(-50%, 0)",
                      width: "40vw",
                    }}
                  >
                    Drag and drop blocks from the sidebar to start building your
                    flow
                  </div>
                )}
                {flowBuilderState.flow.flow.blocks.map((block) => {
                  return (
                    <BlockView
                      key={block.placedID}
                      block={block}
                      blockHooks={flowBuilderState.block}
                      scale={flowBuilderState.flow.scale}
                    />
                  );
                })}
              </div>
            </Xwrapper>
          </FlowCanvas>
          <BlurredModal
            show={flowBuilderState.flow.flowLoading}
            onHide={() => {}}
            zIndex={1000}
          >
            <div className="flex flex-col items-center w-full h-full gap-2 justify-center p-8">
              <RotatingLines />
              <div className="text-xl font-semibold">
                {flowBuilderState.flow.flowText}
              </div>
            </div>
          </BlurredModal>
        </div>
        <DragOverlay
          dropAnimation={null}
          style={{ cursor: "grabbing !important" }}
        >
          {
            // If there is a block being dragged, show it
            flowBuilderState.dnd.draggingBlock && (
              <BlockView
                block={flowBuilderState.dnd.draggingBlock}
                blockHooks={flowBuilderState.block}
                onAir={true}
              />
            )
          }
        </DragOverlay>
      </DndContext>
      <ServerFileExplorerModal
        key={"serverFilePicker-flow-reciver"}
        fileProps={flowBuilderState.misc.fileProps}
        open={flowBuilderState.misc.serverFilePickerOpen}
        setOpen={flowBuilderState.misc.setServerFilePickerOpen}
      />
    </div>
  );
}

export { FlowBuilderView };
