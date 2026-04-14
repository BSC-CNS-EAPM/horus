// Components
import { GLOBAL_IDS } from "../../Utils/globals";
import { FlowCanvas } from "./Canvas/canvas";
import { BlockView, NoteBlockView } from "./Blocks/block.view";
import { CSSProperties, useContext, useEffect, useRef } from "react";
import { BlurredModal } from "../reusable";
import RotatingLines from "../RotatingLines/rotatinglines";
import { ServerFileExplorerModal } from "../FileExplorer/file_explorer";
import { ConnectedArrows } from "./Connections/arrows";
import Xarrow, { Xwrapper, useXarrow } from "react-xarrows";
import { BlockTypes, DroppableEntity, FlowStatus } from "./flow.types";
import { GreenOverlay } from "../GreenOverlay/GreenOverlay";
import SaveIcon from "../Toolbar/Icons/Save";
import TrashIcon from "../Toolbar/Icons/Trash";
import { FlowBuilderContext } from "../MainApp/PanelView";
import { Editor } from "@monaco-editor/react";
import { FlowBuilderHooks } from "./flow.hooks";
import {
  IconCopyPlus,
  IconClipboardCopy,
  IconClipboardText
} from "@tabler/icons-react";

// Main Component
function FlowBuilderView() {
  const flowBuilderState = useContext(FlowBuilderContext);
  const builderRef = useRef<HTMLDivElement>(null);

  if (!flowBuilderState) {
    return <>No flow context</>;
  }

  const style: CSSProperties = {
    cursor: flowBuilderState.handleMouse.isPanning
      ? "grabbing"
      : flowBuilderState.flow.isFlowActive
        ? "wait"
        : "auto"
  };

  return (
    <div
      ref={builderRef}
      className="h-full overflow-hidden"
      id={GLOBAL_IDS.FLOW_BUILDER_CONTAINER}
    >
      <FlowCanvasContainer flowBuilderState={flowBuilderState} style={style} />
    </div>
  );
}

// Subcomponents
function FlowCanvasContainer({
  flowBuilderState,
  style
}: {
  flowBuilderState: FlowBuilderHooks;
  style: CSSProperties;
}) {
  const updateArrow = useXarrow();

  useEffect(() => {
    const interval = setInterval(() => {
      updateArrow();
    }, 10);

    setTimeout(() => {
      clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowBuilderState.flow.scale]);

  return (
    <Xwrapper>
      <div
        id={GLOBAL_IDS.FLOW_BUILDER_DIV}
        className="h-full w-full overflow-hidden relative"
        style={style}
        onDragOver={flowBuilderState.handleMouse.handleDragOver}
        onDrop={flowBuilderState.handleMouse.handleDrop}
        onDragLeave={flowBuilderState.handleMouse.handleDragDropEnd}
      >
        {flowBuilderState.handleMouse.isDraggingFlowFile && (
          <GreenOverlay>
            <div className="flex flex-col gap-2 items-center justify-center font-semibold">
              <SaveIcon className="w-16 h-16" />
              Drop a .flow or .zip file
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
        {flowBuilderState.block.selectedPlacedIDs.size > 0 && (
          <SelectionActionBar
            count={flowBuilderState.block.selectedPlacedIDs.size}
            onDuplicate={flowBuilderState.block.duplicateSelectedBlocks}
            onDelete={flowBuilderState.block.deleteSelectedBlocks}
            onClear={flowBuilderState.block.clearSelection}
            onExport={flowBuilderState.block.copySelectedBlocksToClipboard}
          />
        )}
        <PasteButton
          onPaste={flowBuilderState.block.pasteBlocksFromClipboard}
        />
      </div>
    </Xwrapper>
  );
}

function SelectionActionBar({
  count,
  onDuplicate,
  onDelete,
  onClear,
  onExport
}: {
  count: number;
  onDuplicate: () => void;
  onDelete: () => void;
  onClear: () => void;
  onExport: () => void;
}) {
  return (
    <div
      className="flex flex-row items-center gap-3 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 pointer-events-auto"
      style={{
        position: "absolute",
        bottom: "4rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50
      }}
    >
      <span className="text-sm text-gray-500 font-medium whitespace-nowrap">
        {count} block{count !== 1 ? "s" : ""} selected
      </span>
      <div className="w-px h-5 bg-gray-200" />
      <button
        title="Export selected blocks (⌘C)"
        onClick={onExport}
        className="hover:text-blue-500 transition-colors"
      >
        <IconClipboardCopy className="w-5 h-5" />
      </button>
      <button
        title="Duplicate selected"
        onClick={onDuplicate}
        className="hover:text-blue-500 transition-colors"
      >
        <IconCopyPlus className="w-5 h-5" />
      </button>
      <button
        title="Delete selected"
        onClick={onDelete}
        className="transition-colors"
        style={{ color: "var(--red-error)" }}
      >
        <TrashIcon style={{ height: "1.25rem", width: "1.25rem" }} />
      </button>
      <div className="w-px h-5 bg-gray-200" />
      <button
        title="Clear selection"
        onClick={onClear}
        className="text-gray-400 hover:text-gray-600 text-sm font-medium leading-none"
      >
        ✕
      </button>
    </div>
  );
}

function PasteButton({ onPaste }: { onPaste: () => void }) {
  return (
    <button
      title="Paste blocks (⌘V)"
      onClick={onPaste}
      className="flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-lg p-2 pointer-events-auto hover:text-blue-500 transition-colors"
      style={{
        position: "absolute",
        bottom: "4rem",
        right: "1rem",
        zIndex: 50
      }}
    >
      <IconClipboardText className="w-5 h-5" />
    </button>
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
  flowBuilderState
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
  flowBuilderState
}: {
  flowBuilderState: FlowBuilderHooks;
}) {
  return (
    <div
      style={{
        transform: `scale(${flowBuilderState.flow.scale})`
      }}
      className="scaled-flow-canvas"
      id={DroppableEntity.SCALED_CANVAS}
    >
      {flowBuilderState.flow.flow.blocks.map((block) =>
        block.type === BlockTypes.NOTE ? (
          <NoteBlockView
            key={block.placedID}
            block={block}
            blockHooks={flowBuilderState.block}
            scale={flowBuilderState.flow.scale}
            selectedPlacedIDs={flowBuilderState.block.selectedPlacedIDs}
            onToggleSelect={flowBuilderState.block.toggleBlockSelection}
          />
        ) : (
          <BlockView
            key={block.placedID}
            block={block}
            blockHooks={flowBuilderState.block}
            scale={flowBuilderState.flow.scale}
            isPaused={flowBuilderState.flow.flow.status === FlowStatus.PAUSED}
            isFlowActive={flowBuilderState.flow.isFlowActive}
            selectedPlacedIDs={flowBuilderState.block.selectedPlacedIDs}
            onToggleSelect={flowBuilderState.block.toggleBlockSelection}
          />
        )
      )}
    </div>
  );
}

function ModalContainer({
  flowBuilderState
}: {
  flowBuilderState: FlowBuilderHooks;
}) {
  return (
    <BlurredModal show={flowBuilderState.flow.flowLoading} onHide={() => {}}>
      <div className="flex flex-col items-center w-full h-full gap-2 justify-center p-8">
        <RotatingLines />
        <div className="text-xl font-semibold">
          {flowBuilderState.flow.flowText}
        </div>
      </div>
    </BlurredModal>
  );
}

function ServerFileExplorerContainers({
  flowBuilderState
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
      language="json"
      value={JSON.stringify(flow, null, 2)}
      onChange={(value) => {
        if (value) {
          handleFlowChange(() => JSON.parse(value));
        }
      }}
    />
  );
}
