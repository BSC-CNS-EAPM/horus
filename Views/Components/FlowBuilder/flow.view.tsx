// Import drag and drop kit
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";

// Components
import { BlockListSidebar } from "./Sidebar/block_list_view";
import { GLOBAL_IDS } from "../../Utils/globals";

// Import the flow reciver component
import { FlowCanvas } from "./Canvas/canvas";

// Import the block component
import { BlockView } from "./Blocks/block.view";

// Import the useFlowBuilder hook
import { useFlowBuilder } from "./flow.hooks";
import {
  CSSProperties,
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import { BlurredModal } from "../reusable";
import RotatingLines from "../RotatingLines/rotatinglines";
import { ServerFileExplorerModal } from "../FileExplorer/file_explorer";
import { ConnectedArrows } from "./Connections/arrows";
import { Xwrapper } from "react-xarrows";
import { DroppableEntity, Flow, FlowStatus } from "./flow.types";
import { socket } from "../../Utils/socket";

export const FlowContext = createContext<Flow | null>(null);

/**
 * Renders the flow builder component, which displays a canvas where the user can build a flow
 * along with a list of draggable blocks that can be added to the canvas.
 * @param props The props for the flow builder
 * @returns The flow builder component
 */
function FlowBuilderView() {
  // Flow builder state
  const flowBuilderState = useFlowBuilder();

  // Show the debug flow window when clicking on the debug button
  const [debugFlow, setDebugFlow] = useState<boolean>(false);

  const style: CSSProperties = {
    cursor: flowBuilderState.handleMouse.isPanning
      ? "grabbing"
      : flowBuilderState.flow.isFlowActive
      ? "wait"
      : "auto",
  };

  const toggleDebugFlow = useCallback(() => {
    setDebugFlow(!debugFlow);
  }, [debugFlow]);

  useEffect(() => {
    window.addEventListener("toggleDebugFlow", toggleDebugFlow);

    return () => {
      window.removeEventListener("toggleDebugFlow", toggleDebugFlow);
    };
  }, [toggleDebugFlow]);

  return (
    // Setup the drag and drop context
    // Added the onDragEnd event handler, so when blocks dropped
    // inside the flow reciver, we add it to the current flow
    <>
      <FlowContext.Provider value={flowBuilderState.flow.flow}>
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
              id={GLOBAL_IDS.FLOW_BUILDER_DIV}
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
                        Drag and drop blocks from the sidebar to start building
                        your flow
                      </div>
                    )}
                    {flowBuilderState.flow.flow.blocks.map((block) => {
                      return (
                        <BlockView
                          key={block.placedID}
                          block={block}
                          blockHooks={flowBuilderState.block}
                          scale={flowBuilderState.flow.scale}
                          isPaused={
                            flowBuilderState.flow.flow.status ===
                            FlowStatus.PAUSED
                          }
                          isFlowActive={flowBuilderState.flow.isFlowActive}
                        />
                      );
                    })}
                  </div>
                </Xwrapper>
              </FlowCanvas>
              <BlurredModal
                show={flowBuilderState.flow.flowLoading}
                onHide={() => {}}
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
          {/* Used for the fileExplorer event */}
          {!window.horusInternal.isDesktop &&
            flowBuilderState.misc.showFileExplorer && (
              <ServerFileExplorerModal
                open={flowBuilderState.misc.showFileExplorer}
                setOpen={flowBuilderState.misc.setShowFileExplorer}
              />
            )}
        </div>
      </FlowContext.Provider>
      {debugFlow && <DebugFlow flowBuilder={flowBuilderState} />}
    </>
  );
}

export { FlowBuilderView };

type DebugFlowProps = {
  flowBuilder: any;
};

type DebugProperties = {
  flow: {
    flow: Flow;
    scale: number;
    saved: boolean;
    isFlowActive: boolean;
    blockConnections: any[];
    flowLoading: boolean;
    flowText: string;
  };
  handleMouse: any;
  dnd: any;
  block: any;
  flowLoading: boolean;
  flowText: string;
};

function DebugFlow(props: DebugFlowProps) {
  // Parse only the properties, and not the methods
  const flowProperties = Object.keys(props.flowBuilder).reduce((acc, key) => {
    if (typeof props.flowBuilder[key] !== "function") {
      // @ts-ignore
      acc[key] = props.flowBuilder[key] as any;
    }
    return acc;
  }, {}) as DebugProperties;

  const flow: Flow = flowProperties.flow.flow;

  const [currentRoom, setCurrentRoom] = useState<string>("Not fetched");

  const fetchRoom = () => {
    socket.emit("getRoom", {}, (room: string) => {
      setCurrentRoom(room ?? "No room");
    });
  };

  return (
    <div
      className="overflow-scroll w-[500px] p-4 plugin-block m-2"
      style={{
        height: "50vh",
        position: "fixed",
        top: "10rem",
        right: "0",
      }}
    >
      <h2
        className="sticky plugin-block"
        style={{
          top: "0",
          background: "var(--grey-white)",
          height: "3.5rem",
        }}
      >
        Debug flow
      </h2>
      <div>
        <h3>Flow status</h3>
        <div>ID: {flow.savedID}</div>
        <div>Status: {flow.status}</div>
        <div>Scale: {flowProperties.flow.scale}</div>
        <div>Saved: {flowProperties.flow.scale.toString()}</div>
        <div>isFlowActive: {flowProperties.flow.isFlowActive.toString()}</div>
        <div>Flow loading: {flowProperties.flow.flowLoading.toString()}</div>
        <div>Blocks: {flow.blocks.length}</div>
        <div>Terminal: {flow.terminalOutput}</div>
      </div>
      <div>
        <h3>Socket status</h3>
        <div>Connected: {socket.connected ? "Yes" : "No"}</div>
        <div>ID: {socket.id}</div>
        <div className="flex flex-col gap-2">
          Current room: {currentRoom}
          <button className="app-button" onClick={fetchRoom}>
            Fetch room
          </button>
        </div>
      </div>
      <div>
        <h3>Raw properties</h3>
        <pre>{JSON.stringify(flowProperties, null, 2)}</pre>
      </div>
    </div>
  );
}
