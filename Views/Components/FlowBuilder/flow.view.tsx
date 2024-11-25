// Components
import { GLOBAL_IDS } from "../../Utils/globals";
import { FlowCanvas } from "./Canvas/canvas";
import { BlockView } from "./Blocks/block.view";
import { CSSProperties, useContext, useEffect, useRef } from "react";
import { BlurredModal } from "../reusable";
import RotatingLines from "../RotatingLines/rotatinglines";
import { ServerFileExplorerModal } from "../FileExplorer/file_explorer";
import { ConnectedArrows } from "./Connections/arrows";
import Xarrow, { useXarrow } from "react-xarrows";
import { DroppableEntity, FlowStatus } from "./flow.types";
import { GreenOverlay } from "../GreenOverlay/GreenOverlay";
import SaveIcon from "../Toolbar/Icons/Save";
import { FlowBuilderContext } from "../MainApp/PanelView";
import { Editor } from "@monaco-editor/react";
import { createPortal } from "react-dom";
import useResizeObserver from "@react-hook/resize-observer";
import { FlowBuilderHooks } from "./flow.hooks";

// Main Component
function FlowBuilderView() {
  const flowBuilderState = useContext(FlowBuilderContext);
  const builderRef = useRef<HTMLDivElement>(null);
  const updateXarrow = useXarrow();

  useResizeObserver(builderRef, () => {
    updateXarrow();
  });

  useEffect(() => {
    updateXarrow();
  }, [updateXarrow, flowBuilderState?.flow.scale]);

  if (!flowBuilderState) {
    return <>No flow context</>;
  }

  const style: CSSProperties = {
    cursor: flowBuilderState.handleMouse.isPanning
      ? "grabbing"
      : flowBuilderState.flow.isFlowActive
        ? "wait"
        : "auto",
  };

  return (
    <div
      ref={builderRef}
      className="h-full overflow-hidden"
      onMouseMove={updateXarrow}
      id={GLOBAL_IDS.FLOW_BUILDER_CONTAINER}
    >
      <FlowCanvasContainer flowBuilderState={flowBuilderState} style={style} />
    </div>
  );
}

// Subcomponents
function FlowCanvasContainer({
  flowBuilderState,
  style,
}: {
  flowBuilderState: FlowBuilderHooks;
  style: CSSProperties;
}) {
  return (
    <div
      id={GLOBAL_IDS.FLOW_BUILDER_DIV}
      className="h-full w-full overflow-hidden"
      style={style}
      onDragOver={flowBuilderState.handleMouse.handleDragOver}
      onDrop={flowBuilderState.handleMouse.handleDrop}
      onDragLeave={flowBuilderState.handleMouse.handleDragDropEnd}
    >
      {flowBuilderState.handleMouse.isDraggingFlowFile && (
        <GreenOverlay>
          <div className="flex flex-col gap-2 items-center justify-center font-semibold">
            <SaveIcon className="w-16 h-16" />
            Drop a .flow file
          </div>
        </GreenOverlay>
      )}
      <FlowCanvas
        flowHooks={flowBuilderState.flow}
        mouseHooks={flowBuilderState.handleMouse}
      >
        {flowBuilderState.flow.flow.blocks.length === 0 ? (
          <EmptyCanvas />
        ) : (
          <>
            <div className="relative">
              <ConnectedArrowsList flowBuilderState={flowBuilderState} />
            </div>
            <ScaledCanvas flowBuilderState={flowBuilderState} />
          </>
        )}
      </FlowCanvas>
    </div>
  );
}

function EmptyCanvas() {
  return (
    <>
      <div id="empty-canvas" className="text-center text-gray-400 w-full">
        Drag and drop blocks from the block registry
      </div>
      <Xarrow
        start="empty-canvas"
        end="add-block"
        startAnchor={["bottom"]}
        endAnchor={["top"]}
        color="#9ca3af55"
      />
    </>
  );
}

function ConnectedArrowsList({
  flowBuilderState,
}: {
  flowBuilderState: FlowBuilderHooks;
}) {
  return (
    <>
      {flowBuilderState.flow.blockConnections.map((connection) => (
        <ConnectedArrows
          key={`${connection.origin.placedID}-${connection.destination.placedID}`}
          connection={connection}
          blockHooks={flowBuilderState.block}
          scale={flowBuilderState.flow.scale}
        />
      ))}
    </>
  );
}

function ScaledCanvas({
  flowBuilderState,
}: {
  flowBuilderState: FlowBuilderHooks;
}) {
  return (
    <div
      style={{
        transform: `scale(${flowBuilderState.flow.scale})`,
      }}
      className="scaled-flow-canvas"
      id={DroppableEntity.SCALED_CANVAS}
    >
      {flowBuilderState.flow.flow.blocks.map((block) => (
        <BlockView
          key={block.placedID}
          block={block}
          blockHooks={flowBuilderState.block}
          scale={flowBuilderState.flow.scale}
          isPaused={flowBuilderState.flow.flow.status === FlowStatus.PAUSED}
          isFlowActive={flowBuilderState.flow.isFlowActive}
        />
      ))}
    </div>
  );
}

function ModalContainer({
  flowBuilderState,
}: {
  flowBuilderState: FlowBuilderHooks;
}) {
  return (
    <>
      {createPortal(
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
        </BlurredModal>,
        document.documentElement
      )}
    </>
  );
}

function ServerFileExplorerContainers({
  flowBuilderState,
}: {
  flowBuilderState: FlowBuilderHooks;
}) {
  return (
    <>
      <ServerFileExplorerModal
        key={"serverFilePicker-flow-reciver"}
        fileProps={flowBuilderState.misc.fileProps}
        open={flowBuilderState.misc.serverFilePickerOpen}
        setOpen={flowBuilderState.misc.setServerFilePickerOpen}
      />
      {!window.horusInternal.isDesktop &&
        flowBuilderState.misc.showFileExplorer && (
          <ServerFileExplorerModal
            open={flowBuilderState.misc.showFileExplorer}
            setOpen={flowBuilderState.misc.setShowFileExplorer}
          />
        )}
    </>
  );
}

export { FlowBuilderView, ModalContainer, ServerFileExplorerContainers };

export function DebugFlow() {
  const flowBuilderState = useContext(FlowBuilderContext);

  if (!flowBuilderState) {
    return <>Error loading flow</>;
  }

  const { flow, handleFlowChange } = flowBuilderState.flow;

  return (
    <Editor
      value={JSON.stringify(flow, null, 2)}
      onChange={(value) => {
        if (value) {
          handleFlowChange(JSON.parse(value));
        }
      }}
    />
  );
}
