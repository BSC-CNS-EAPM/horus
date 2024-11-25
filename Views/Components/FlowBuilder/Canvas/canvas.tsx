// DND
import { useDroppable } from "@dnd-kit/core";

// Types
import { DroppableEntity, Flow, FlowStatus } from "../flow.types";

// Hooks
import { FlowHooks, HandleMouseHooks, useFlowShortcuts } from "../flow.hooks";

// Icons
import ZoomInIcon from "../../Toolbar/Icons/ZoomIn";
import ZoomOutIcon from "../../Toolbar/Icons/ZoomOut";
import Slider from "rc-slider";

// Flow status view and stop button
import StopIcon from "../../Toolbar/Icons/Stop";
import { FlowStatusView } from "../../FlowStatus/flow_status";
import { FlowElapsed } from "../../FlowStatus/flow_elapsed";
import NewFlowIcon from "@/Components/Toolbar/Icons/New";
import AppButton from "@/Components/appbutton";
import {
  DockContext,
  PANEL_REGISTRY,
  togglePanel,
} from "@/Components/MainApp/PanelView";
import { useContext } from "react";
import { HorusPopover } from "@/Components/reusable";

type FlowCanvasProps = {
  flowHooks: FlowHooks;
  mouseHooks: HandleMouseHooks;
  children: React.ReactNode;
};

export function FlowCanvas(props: FlowCanvasProps) {
  // Extract the flow from the props
  const { isFlowActive } = props.flowHooks;
  const { mouseHooks, children } = props;

  const { setNodeRef } = useDroppable({
    id: DroppableEntity.CANVAS,
    disabled: isFlowActive,
  });

  return (
    <>
      <FlowTopBar flowHooks={props.flowHooks} />
      <div
        className="flow-canvas"
        ref={setNodeRef}
        id={DroppableEntity.CANVAS.valueOf()}
        onMouseDown={mouseHooks.handleMouseDown as any}
        onMouseUp={mouseHooks.handleMouseUp as any}
        onMouseLeave={mouseHooks.handleMouseUp as any}
        onMouseMove={mouseHooks.handleMousePan as any}
      >
        <div
          style={{
            pointerEvents: isFlowActive ? "none" : "auto",
            filter: isFlowActive ? "opacity(0.8)" : "none",
          }}
        >
          {children}
        </div>
      </div>
      <FlowBottomToolbar flowHooks={props.flowHooks} />
    </>
  );
}

function FlowBottomToolbar({ flowHooks }: { flowHooks: FlowHooks }) {
  const { dockApi } = useContext(DockContext);

  return (
    <div
      className="flex flex-row items-end justify-between gap-2 w-full p-2"
      style={{
        position: "absolute",
        bottom: 0,
      }}
    >
      <div
        id="add-block"
        style={{
          paddingTop: "0.5rem",
          paddingBottom: "0.5rem",
        }}
      >
        <HorusPopover
          trigger={
            <AppButton
              action={() => {
                togglePanel({
                  dockApi,
                  panelID: PANEL_REGISTRY.blockRegistry.id,
                  component: PANEL_REGISTRY.blockRegistry.component,
                });
              }}
            >
              <NewFlowIcon />
            </AppButton>
          }
        >
          <div
            className="hover-description"
            style={{
              transform: "translateY(-70px) translateX(70px)",
            }}
          >
            Toggle the Block Registry panel
          </div>
        </HorusPopover>
      </div>
      <CanvasZoom flowHooks={flowHooks} />
    </div>
  );
}

function CanvasZoom({ flowHooks }: { flowHooks: FlowHooks }) {
  const { handleScaleChange, scale } = flowHooks;

  return (
    <div className="flex flex-row gap-2 w-48 items-center justify-center">
      <div
        className="app-button bg-white"
        onClick={() => {
          handleScaleChange(scale - 0.1);
        }}
      >
        <ZoomOutIcon className="w-10 h-10" />
      </div>
      <div
        className="w-full h-full"
        onClick={() => {
          handleScaleChange(1);
        }}
      >
        <Slider
          min={0.1}
          max={1.5}
          step={0.01}
          value={scale}
          onChange={handleScaleChange}
          disabled={true}
        />
      </div>
      <div
        className="app-button bg-white"
        onClick={() => {
          handleScaleChange(scale + 0.1);
        }}
      >
        <ZoomInIcon className="w-10 h-10" />
      </div>
    </div>
  );
}

function FlowTopBar(props: { flowHooks: FlowHooks }) {
  const {
    flow,
    saved,
    handleFlowChange,
    stopFlow,
    executeFlow: resumeFlow,
  } = props.flowHooks;

  const hasPendingActions = flow.pendingActions.length > 0;
  const hasPendingSmilesActions = flow.pendingSmilesActions.length > 0;
  const hasActions = hasPendingActions || hasPendingSmilesActions;

  return (
    <div className="absolute flex flex-row top-bar-flow-reciver gap-2 p-2">
      <FlowNameInput
        flow={flow}
        saved={saved}
        handleFlowChange={handleFlowChange}
      />
      {flow.startedTime && <FlowElapsedDisplay flow={flow} saved={saved} />}
      <FlowStatusControl
        hasActions={hasActions}
        flow={flow}
        saved={saved}
        stopFlow={stopFlow}
        resumeFlow={resumeFlow}
      />
    </div>
  );
}

function FlowNameInput({
  flow,
  saved,
  handleFlowChange,
}: {
  flow: Flow;
  saved: boolean;
  handleFlowChange: (newFlow: Flow) => void;
}) {
  return (
    <input
      style={{
        borderColor: saved ? "var(--digital-grey-IV)" : "orange",
        width: "100%",
      }}
      className="flow-name flow-title"
      type="text"
      id="flow-name"
      placeholder={"Flow Name"}
      onChange={(e) => handleFlowChange({ ...flow, name: e.target.value })}
      value={flow.name}
    />
  );
}

function FlowElapsedDisplay({ flow, saved }: { flow: Flow; saved: boolean }) {
  return (
    <div
      className="flex flex-col gap-0 items-center text-center justify-center bg-white flow-name"
      style={{
        borderColor: saved ? "var(--digital-grey-IV)" : "orange",
        minWidth: "100px",
      }}
    >
      <FlowElapsed
        startedTime={flow.startedTime}
        finishedTime={flow.finishedTime}
        elapsed={flow.elapsed}
      />
    </div>
  );
}

function FlowStatusControl({
  flow,
  saved,
  hasActions,
  stopFlow,
  resumeFlow,
}: {
  flow: Flow;
  saved: boolean;
  hasActions: boolean;
  stopFlow: () => void;
  resumeFlow: () => void;
}) {
  return (
    <div
      className={`flex flex-col gap-0 items-center text-center justify-center bg-white flow-name ${
        flow.status === FlowStatus.RUNNING ||
        flow.status === FlowStatus.QUEUED ||
        flow.status === FlowStatus.PAUSED
          ? "cursor-pointer"
          : "cursor-default"
      }`}
      onClick={() => {
        (flow.status === FlowStatus.RUNNING ||
          flow.status === FlowStatus.QUEUED) &&
          stopFlow();

        flow.status === FlowStatus.PAUSED && resumeFlow();
      }}
      style={{
        borderColor: saved ? "var(--digital-grey-IV)" : "orange",
        minWidth: "200px",
      }}
    >
      <FlowStatusIcons flow={flow} saved={saved} />
      {hasActions && <FlowActionsIndicator />}
    </div>
  );
}

function FlowStatusIcons({ flow, saved }: { flow: Flow; saved: boolean }) {
  const shortcuts = useFlowShortcuts();

  return (
    <div className="flex flex-row gap-1 items-center justify-center">
      {(flow.status === FlowStatus.RUNNING ||
        flow.status === FlowStatus.QUEUED) && (
        <>
          <StopIcon className="text-red-500 w-6 h-6" />
          <div
            className="h-6 mx-2"
            style={{ border: "0.5px solid var(--digital-grey-IV)" }}
          ></div>
        </>
      )}
      {saved ? (
        <div className="grid place-items-center">
          <FlowStatusView status={flow.status} />
        </div>
      ) : (
        <div
          onClick={() => {
            shortcuts.preHandleSave();
          }}
          className="flex flex-row gap-2"
          style={{
            cursor: "pointer",
          }}
        >
          <FlowStatusView status={FlowStatus.UNSAVED} />
        </div>
      )}
    </div>
  );
}

function FlowActionsIndicator() {
  return (
    <div
      className="text-xs text-green-500 text-center"
      style={{
        position: "absolute",
        bottom: "-1.5rem",
      }}
    >
      Applying actions
    </div>
  );
}
